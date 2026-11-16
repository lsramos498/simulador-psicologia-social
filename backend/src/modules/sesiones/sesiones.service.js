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
  return {
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

export function crearServicioSesiones(repositorio) {
  if (!repositorio || typeof repositorio.enTransaccion !== 'function') {
    throw new TypeError('Se requiere el repositorio de sesiones');
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
      return sesion.toJSON();
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
