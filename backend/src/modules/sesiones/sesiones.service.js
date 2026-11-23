import { esIngresoTardio } from '../acceso/ingresoTardio.js';
import { crearErrorHttp } from '../acceso/errores.js';
import { calcularEvaluacion } from '../evaluacion/evaluacion.js';
import { EventosParticipacion } from '../participacion/eventosParticipacion.js';
import { crearNotificacionInterna } from '../participacion/notificacionInterna.js';
import { ESTADOS_SESION, MOTIVOS_CIERRE, SesionSimulacion } from './sesion.state.js';
import { validarSesionParaResponder } from './validarSesionParaResponder.js';

const DIA_MS = 24 * 60 * 60 * 1000;

function filaASesion(fila) {
  return new SesionSimulacion({
    id: Number(fila.id),
    actividadId: Number(fila.actividadId),
    estudianteId: Number(fila.estudianteId),
    numeroIntento: Number(fila.numeroIntento),
    estado: fila.estado,
    inicio: fila.inicio ?? null,
    fin: fila.fin ?? null,
    segundosConsumidos: Number(fila.segundosConsumidos ?? 0),
    motivoCierre: fila.motivoCierre ?? null
  });
}

function publica(fila) {
  const base = {
    id: Number(fila.id),
    actividadId: Number(fila.actividadId),
    estudianteId: Number(fila.estudianteId),
    numeroIntento: Number(fila.numeroIntento),
    estado: fila.estado,
    inicio: fila.inicio ?? null,
    fin: fila.fin ?? null,
    segundosConsumidos: Number(fila.segundosConsumidos ?? 0),
    motivoCierre: fila.motivoCierre ?? null
  };
  // casoId viene del JOIN con ActividadProgramada (necesario para el frontend estudiante).
  if (fila.casoId != null) {
    base.casoId = Number(fila.casoId);
  }
  return base;
}

function ventanaMasUnDia(fila, ahora) {
  return ahora.getTime() >= new Date(fila.fechaFin).getTime() + DIA_MS;
}

function tiempoDeSesionAgotado(fila, ahora) {
  if (!fila.inicio || fila.tiempoLimiteSegundos == null) return false;
  const inicio = new Date(fila.inicio).getTime();
  return ahora.getTime() > inicio + Number(fila.tiempoLimiteSegundos) * 1000;
}

function transicionar(fila, motivo, ahora) {
  if (fila.estado === ESTADOS_SESION.SIN_INICIAR) {
    if (motivo !== MOTIVOS_CIERRE.CIERRE_AUTOMATICO && motivo !== MOTIVOS_CIERRE.CIERRE_DOCENTE) {
      throw crearErrorHttp('La sesión no está en curso.', 409);
    }
    return {
      ...publica(fila),
      estado: ESTADOS_SESION.FINALIZADO,
      inicio: null,
      fin: ahora,
      segundosConsumidos: 0,
      motivoCierre: motivo
    };
  }

  const sesion = filaASesion(fila);
  try {
    sesion.finalizar({ fechaFin: ahora, motivoCierre: motivo });
  } catch (error) {
    throw crearErrorHttp(error.message, 409);
  }
  return sesion.toJSON();
}

function validarIdentificador(valor, nombre) {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw crearErrorHttp(`${nombre} debe ser un entero positivo.`, 400);
  }
}

function convertirSesionBD(registro) {
  return new SesionSimulacion({
    id: registro.id,
    actividadId: registro.actividad_id,
    estudianteId: registro.estudiante_id,
    numeroIntento: registro.numeroIntento,
    estado: registro.estado,
    inicio: registro.inicio,
    fin: registro.fin,
    segundosConsumidos: registro.segundosConsumidos,
    motivoCierre: registro.motivoCierre
  });
}

export function crearServicioSesiones(repositorio, reloj = () => new Date()) {
  if (!repositorio || typeof repositorio.enTransaccion !== 'function') {
    throw new TypeError('Se requiere el repositorio de sesiones.');
  }

  /**
   * Inicia una sesión individual o recupera
   * la sesión que ya se encuentra en curso.
   */
  async function iniciarSesion({ actividadId, estudianteId }) {
    validarIdentificador(actividadId, 'actividadId');
    validarIdentificador(estudianteId, 'estudianteId');

    return repositorio.enTransaccion(async (conexion) => {
      const actividad = await repositorio.obtenerActividad(conexion, actividadId);

      if (!actividad) {
        throw crearErrorHttp('La actividad no existe.', 404);
      }

      if (actividad.estado !== 'Iniciada') {
        throw crearErrorHttp(
          'La actividad no se encuentra habilitada para iniciar sesiones.',
          409
        );
      }

      const autorizacion = await repositorio.obtenerAutorizacion(
        conexion,
        actividadId,
        estudianteId
      );

      if (!autorizacion || autorizacion.estado !== 'Autorizado') {
        throw crearErrorHttp(
          'El estudiante no está autorizado para esta actividad.',
          403
        );
      }

      const ahora = reloj();

      if (ahora < new Date(actividad.fechaInicio) ||
          ahora > new Date(actividad.fechaFin)) {
        throw crearErrorHttp(
          'La actividad está fuera de su horario permitido.',
          403
        );
      }

      const ultimaSesion = await repositorio.obtenerUltimaSesion(
        conexion,
        actividadId,
        estudianteId
      );

      // El límite de intentos lo establece el docente al programar
      // la actividad.
      const intentosPermitidos = actividad.intentosPermitidos;

      if (
        !Number.isSafeInteger(intentosPermitidos) ||
        intentosPermitidos < 1
      ) {
        throw crearErrorHttp(
          'La actividad tiene una configuración de intentos inválida.',
          500
        );
      }

      let numeroIntento = 1;

      if (ultimaSesion) {
        // Si ya existe una sesión en curso, se recupera.
        // No se consume un intento adicional.
        if (ultimaSesion.estado === ESTADOS_SESION.EN_CURSO) {
          return convertirSesionBD(ultimaSesion).toJSON();
        }

        // Si finalizó, se comprueba si quedan intentos.
        if (ultimaSesion.estado === ESTADOS_SESION.FINALIZADO) {
          if (ultimaSesion.numeroIntento >= intentosPermitidos) {
            throw crearErrorHttp(
              'El estudiante ha agotado los intentos permitidos para esta actividad.',
              409
            );
          }

          numeroIntento = ultimaSesion.numeroIntento + 1;
        } else {
          throw crearErrorHttp(
            'La sesión anterior tiene un estado no válido.',
            409
          );
        }
      }

      // Se crea una sesión nueva sin modificar las anteriores.
      const sesion = new SesionSimulacion({
        actividadId,
        estudianteId,
        numeroIntento
      });

      sesion.iniciar(ahora);

      return repositorio.insertarSesion(conexion, sesion.toJSON());
    });
  }

  /**
   * Finaliza una sesión del estudiante con evaluación (mismo camino que finalizarPropia).
   * Evita el cierre “sin nota” que dejaba deuda de dos ciclos de vida distintos.
   */
  async function finalizarSesion({
    sesionId,
    estudianteId,
    motivoCierre = MOTIVOS_CIERRE.FINALIZACION
  }) {
    validarIdentificador(sesionId, 'sesionId');
    validarIdentificador(estudianteId, 'estudianteId');
    return aplicarCierre(sesionId, motivoCierre, reloj(), {
      permitido: (fila) => Number(fila.estudianteId) === Number(estudianteId)
    });
  }

  async function aplicarCierre(sesionId, motivo, ahora, actor) {
    return repositorio.enTransaccion(async (tx) => {
      const fila = await tx.obtenerPorId(sesionId, true);
      if (!fila) throw crearErrorHttp('La sesión no existe.', 404);
      if (actor && !actor.permitido(fila)) {
        throw crearErrorHttp('No tiene autorización para cerrar esta sesión.', 403);
      }
      if (fila.estado === ESTADOS_SESION.FINALIZADO) {
        return { sesion: publica(fila), evaluacion: await tx.obtenerEvaluacion(fila.id) };
      }

      const motivoEfectivo = motivo === MOTIVOS_CIERRE.FINALIZACION && (
        ventanaMasUnDia(fila, ahora) || tiempoDeSesionAgotado(fila, ahora)
      )
        ? (ventanaMasUnDia(fila, ahora) ? MOTIVOS_CIERRE.CIERRE_AUTOMATICO : MOTIVOS_CIERRE.TIEMPO_AGOTADO)
        : motivo;

      const estadoAnterior = fila.estado;
      const sesion = transicionar(fila, motivoEfectivo, ahora);
      const guardadas = await tx.guardar(sesion, estadoAnterior);
      if (!guardadas) {
        throw crearErrorHttp('La sesión ya fue cerrada.', 409);
      }

      await tx.marcarRespuestas(sesion.id);
      const datos = await tx.datosParaEvaluar(fila.casoId, sesion.id, fila.rubricaId);
      const calculo = calcularEvaluacion(datos);
      const evaluacionId = await tx.insertarEvaluacion({
        sesionId: sesion.id,
        actividadId: sesion.actividadId,
        rubricaId: Number(fila.rubricaId),
        resultado: calculo.resultado,
        retroalimentacionGeneral: calculo.retroalimentacionGeneral,
        fecha: ahora
      });
      await tx.insertarCriterios(evaluacionId, calculo.criterios.map((criterio) => ({
        ...criterio,
        rubricaId: Number(fila.rubricaId)
      })));

      const eventos = new EventosParticipacion();
      let aviso = null;
      eventos.suscribir((evento) => {
        aviso = crearNotificacionInterna(evento);
      });
      eventos.notificar({
        tipo: 'participacionFinalizada',
        estudianteId: sesion.estudianteId,
        sesionId: sesion.id
      });

      await tx.insertarNotificacion({
        usuarioId: sesion.estudianteId,
        actividadId: sesion.actividadId,
        sesionId: sesion.id,
        tipo: 'Retroalimentacion',
        asunto: 'Participación finalizada',
        mensaje: aviso?.mensaje ?? 'Tu participación ha finalizado correctamente',
        fecha: ahora
      });
      await tx.insertarNotificacion({
        usuarioId: sesion.estudianteId,
        actividadId: sesion.actividadId,
        sesionId: sesion.id,
        tipo: 'Calificacion',
        asunto: 'Calificación de la simulación',
        mensaje: `Tu calificación es ${calculo.resultado}. ${calculo.retroalimentacionGeneral}`,
        fecha: ahora
      });
      await tx.actualizarAsistencia(
        sesion.actividadId,
        sesion.estudianteId,
        estadoAnterior === ESTADOS_SESION.SIN_INICIAR ? 'Ausente' : 'Presente'
      );

      return {
        sesion,
        evaluacion: {
          id: evaluacionId,
          resultado: calculo.resultado,
          retroalimentacionGeneral: calculo.retroalimentacionGeneral,
          correctas: calculo.correctas,
          total: calculo.total,
          respondidas: calculo.respondidas,
          criterios: calculo.criterios
        }
      };
    });
  }

  return {
    iniciarSesion,
    finalizarSesion,

    /**
     * RF-23: valida y bloquea Actividad → Autorización → Sesión
     * para que Participación pueda registrar una respuesta.
     */
    async validarSesionParaResponder(sesionId, estudianteId, ahora = new Date()) {
      return repositorio.enTransaccion(async (tx) => {
        const contexto = await tx.obtenerContextoParaResponder(sesionId, estudianteId);
        try {
          return validarSesionParaResponder(contexto, estudianteId, ahora);
        } catch (error) {
          throw crearErrorHttp(error.message, error.statusCode || 409);
        }
      });
    },

    preparar(actividadId) {
      return repositorio.preparar(actividadId);
    },

    async cerrarVencidas(ahora = new Date()) {
      const vencidas = await repositorio.listarVencidas(ahora);
      const cerradas = [];
      for (const fila of vencidas) {
        const motivo = ventanaMasUnDia(fila, ahora)
          ? MOTIVOS_CIERRE.CIERRE_AUTOMATICO
          : MOTIVOS_CIERRE.TIEMPO_AGOTADO;
        cerradas.push(await aplicarCierre(fila.id, motivo, ahora));
      }
      return cerradas;
    },

    async iniciarPropia(actividadId, estudianteId, ahora = new Date()) {
      await this.cerrarVencidas(ahora);
      const fila = await repositorio.obtenerPorEstudiante(actividadId, estudianteId);
      if (!fila) {
        throw crearErrorHttp('No hay sesión para esta actividad. El docente debe iniciarla primero.', 404);
      }
      if (Number(fila.estudianteId) !== Number(estudianteId)) {
        throw crearErrorHttp('La sesión no pertenece a este estudiante.', 403);
      }
      if (fila.estado === ESTADOS_SESION.FINALIZADO) {
        throw crearErrorHttp('La sesión ya finalizó.', 409);
      }
      if (fila.estado === ESTADOS_SESION.EN_CURSO) {
        return publica(fila);
      }
      if (fila.estadoActividad !== 'Iniciada') {
        throw crearErrorHttp('La actividad todavía no está iniciada.', 409);
      }
      const inicioVentana = new Date(fila.fechaInicio).getTime();
      const finVentana = new Date(fila.fechaFin).getTime();
      if (ahora.getTime() < inicioVentana || ahora.getTime() > finVentana) {
        throw crearErrorHttp('La actividad está fuera de la ventana de acceso.', 403);
      }
      // RF-22: no se puede iniciar si ya pasó la mitad del tiempo (ver acceso/ingresoTardio.js).
      if (esIngresoTardio(fila, ahora)) {
        const error = crearErrorHttp(
          'Ingreso tardío: ya pasó el tiempo permitido para iniciar esta actividad. Habla con tu docente.',
          403
        );
        error.codigo = 'INGRESO_TARDIO';
        throw error;
      }

      const sesion = filaASesion(fila);
      try {
        sesion.iniciar(ahora);
      } catch (error) {
        throw crearErrorHttp(error.message, 409);
      }
      const guardadas = await repositorio.guardar(sesion.toJSON(), ESTADOS_SESION.SIN_INICIAR);
      if (!guardadas) {
        throw crearErrorHttp('No se pudo iniciar la sesión.', 409);
      }
      await repositorio.actualizarAsistencia(fila.actividadId, fila.estudianteId, 'Presente');
      const abierta = sesion.toJSON();
      if (fila.casoId != null) {
        abierta.casoId = Number(fila.casoId);
      }
      return abierta;
    },

    async consultarPropia(actividadId, estudianteId) {
      const fila = await repositorio.obtenerPorEstudiante(actividadId, estudianteId);
      if (!fila || Number(fila.estudianteId) !== Number(estudianteId)) {
        throw crearErrorHttp('No hay sesión para esta actividad.', 404);
      }
      const evaluacion = fila.estado === ESTADOS_SESION.FINALIZADO
        ? await repositorio.obtenerEvaluacion(fila.id)
        : null;
      return { sesion: publica(fila), evaluacion };
    },

    async consultar(sesionId, actor) {
      const fila = await repositorio.obtenerPorId(sesionId);
      if (!fila) throw crearErrorHttp('La sesión no existe.', 404);
      const propia = Number(fila.estudianteId) === Number(actor.id);
      const delDocente = Number(fila.docenteId) === Number(actor.id);
      if (!propia && !delDocente && !actor.esAdmin) {
        throw crearErrorHttp('No tiene autorización para consultar esta sesión.', 403);
      }
      const evaluacion = fila.estado === ESTADOS_SESION.FINALIZADO
        ? await repositorio.obtenerEvaluacion(fila.id)
        : null;
      return { sesion: publica(fila), evaluacion };
    },

    async listarPorActividad(actividadId, actor) {
      validarIdentificador(actividadId, 'actividadId');
      const filas = await repositorio.listarPorActividad(actividadId);
      if (!filas.length) {
        // Verifica que la actividad exista vía una sesión vacía: consulta actividad.
        const actividad = await repositorio.enTransaccion(async (tx) =>
          repositorio.obtenerActividad(tx, actividadId)
        );
        if (!actividad) throw crearErrorHttp('La actividad no existe.', 404);
        if (!actor.esAdmin && Number(actividad.docente_id ?? actividad.docenteId) !== Number(actor.id)) {
          throw crearErrorHttp('No tiene autorización para monitorear esta actividad.', 403);
        }
        return [];
      }
      const docenteId = Number(filas[0].docenteId);
      if (!actor.esAdmin && docenteId !== Number(actor.id)) {
        throw crearErrorHttp('No tiene autorización para monitorear esta actividad.', 403);
      }
      return filas.map((fila) => ({
        ...publica(fila),
        nombres: fila.nombres || null,
        apellidos: fila.apellidos || null,
        correo: fila.correo || null,
        casoId: fila.casoId != null ? Number(fila.casoId) : null
      }));
    },

    finalizarPropia(sesionId, estudianteId, ahora = new Date()) {
      return aplicarCierre(sesionId, MOTIVOS_CIERRE.FINALIZACION, ahora, {
        permitido: (fila) => Number(fila.estudianteId) === Number(estudianteId)
      });
    },

    cerrarPorDocente(sesionId, docenteId, ahora = new Date(), esAdmin = false) {
      return aplicarCierre(sesionId, MOTIVOS_CIERRE.CIERRE_DOCENTE, ahora, {
        permitido: (fila) => esAdmin || Number(fila.docenteId) === Number(docenteId)
      });
    }
  };
}
