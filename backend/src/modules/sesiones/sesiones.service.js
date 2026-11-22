import {
  SesionSimulacion,
  ESTADOS_SESION,
  MOTIVOS_CIERRE
} from './sesion.state.js';

function crearError(mensaje, statusCode, codigo = null) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;

  if (codigo) {
    error.codigo = codigo;
  }

  return error;
}

function validarIdentificador(valor, nombre) {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw crearError(`${nombre} debe ser un entero positivo.`, 400);
  }
}

function convertirFecha(valor, nombre) {
  const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw crearError(`La fecha ${nombre} de la sesión no es válida.`, 500);
  }

  return fecha;
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

function validarConexion(conexion) {
  if (!conexion || typeof conexion.execute !== 'function') {
    throw crearError(
      'Se requiere la conexión transaccional de Participación.',
      500
    );
  }
}

function crearServicioSesiones(repositorio, reloj = () => new Date()) {
  if (!repositorio) {
    throw new Error('Se requiere el repositorio de sesiones.');
  }

  /**
   * Inicia una sesión individual o recupera
   * la sesión que ya se encuentra en curso.
   */
  async function iniciarSesion({ actividadId, estudianteId }) {
    validarIdentificador(actividadId, 'actividadId');
    validarIdentificador(estudianteId, 'estudianteId');

    return repositorio.enTransaccion(async (conexion) => {
      const actividad = await repositorio.obtenerActividad(
        conexion,
        actividadId
      );

      if (!actividad) {
        throw crearError('La actividad no existe.', 404);
      }

      if (actividad.estado !== 'Iniciada') {
        throw crearError(
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
        throw crearError(
          'El estudiante no está autorizado para esta actividad.',
          403
        );
      }

      const ahora = convertirFecha(reloj(), 'actual');

      if (
        ahora < convertirFecha(actividad.fechaInicio, 'de inicio de la actividad') ||
        ahora > convertirFecha(actividad.fechaFin, 'de fin de la actividad')
      ) {
        throw crearError(
          'La actividad está fuera de su horario permitido.',
          403
        );
      }

      const ultimaSesion = await repositorio.obtenerUltimaSesion(
        conexion,
        actividadId,
        estudianteId
      );

      // El límite de intentos lo establece el docente al programar la actividad.
      const intentosPermitidos = actividad.intentosPermitidos;

      if (
        !Number.isSafeInteger(intentosPermitidos) ||
        intentosPermitidos < 1
      ) {
        throw crearError(
          'La actividad tiene una configuración de intentos inválida.',
          500
        );
      }

      let numeroIntento = 1;

      if (ultimaSesion) {
        // Si ya existe una sesión en curso, se recupera sin consumir otro intento.
        if (ultimaSesion.estado === ESTADOS_SESION.EN_CURSO) {
          return convertirSesionBD(ultimaSesion).toJSON();
        }

        if (ultimaSesion.estado === ESTADOS_SESION.FINALIZADO) {
          if (ultimaSesion.numeroIntento >= intentosPermitidos) {
            throw crearError(
              'El estudiante ha agotado los intentos permitidos para esta actividad.',
              409
            );
          }

          numeroIntento = ultimaSesion.numeroIntento + 1;
        } else {
          throw crearError(
            'La sesión anterior tiene un estado no válido.',
            409
          );
        }
      }

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
   * Valida una sesión antes de registrar o modificar una respuesta.
   * Reutiliza la transacción abierta por Participación; no crea ni confirma otra.
   * El orden de bloqueos es Actividad -> Autorización -> Sesión.
   */
  async function validarSesionParaResponder(sesionId, estudianteId, conexion) {
    validarIdentificador(sesionId, 'sesionId');
    validarIdentificador(estudianteId, 'estudianteId');
    validarConexion(conexion);

    if (typeof repositorio.obtenerReferenciaSesion !== 'function') {
      throw crearError(
        'El repositorio no permite obtener la referencia inicial de la sesión.',
        500
      );
    }

    // Lectura inicial sin bloqueo: permite conocer las claves para bloquear en orden.
    const referencia = await repositorio.obtenerReferenciaSesion(
      conexion,
      sesionId
    );

    if (!referencia) {
      throw crearError(
        'La sesión no existe.',
        404,
        'SESION_NO_EXISTE'
      );
    }

    if (referencia.estudiante_id !== estudianteId) {
      throw crearError(
        'La sesión no pertenece al estudiante autenticado.',
        403,
        'SESION_AJENA'
      );
    }

    const actividadId = referencia.actividad_id;

    validarIdentificador(actividadId, 'actividadId de la sesión');

    // 1. Bloqueo de Actividad.
    const actividad = await repositorio.obtenerActividad(
      conexion,
      actividadId
    );

    if (!actividad) {
      throw crearError('La actividad asociada a la sesión no existe.', 404);
    }

    // 2. Bloqueo de Autorización.
    const autorizacion = await repositorio.obtenerAutorizacion(
      conexion,
      actividadId,
      estudianteId
    );

    if (!autorizacion || autorizacion.estado !== 'Autorizado') {
      throw crearError(
        'El estudiante ya no está autorizado para participar en esta actividad.',
        403
      );
    }

    // 3. Bloqueo de Sesión.
    const sesionBD = await repositorio.obtenerSesionPorId(
      conexion,
      sesionId
    );

    if (!sesionBD) {
      throw crearError(
        'La sesión ya no existe.',
        404,
        'SESION_NO_EXISTE'
      );
    }

    // Revalidación después de adquirir todos los bloqueos.
    if (
      sesionBD.actividad_id !== actividadId ||
      sesionBD.estudiante_id !== estudianteId
    ) {
      throw crearError(
        'La relación de la sesión cambió durante la validación.',
        409
      );
    }

    if (!Number.isSafeInteger(actividad.casoId) || actividad.casoId <= 0) {
      throw crearError(
        'La actividad no tiene un caso válido asociado.',
        500
      );
    }

    if (actividad.estado !== 'Iniciada') {
      throw crearError(
        'La actividad ya no está habilitada para recibir respuestas.',
        409
      );
    }

    const sesion = convertirSesionBD(sesionBD);

    // Una consulta posterior al primer cierre por tiempo mantiene el mismo resultado.
    if (
      sesion.estado === ESTADOS_SESION.FINALIZADO &&
      sesion.motivoCierre === MOTIVOS_CIERRE.TIEMPO_AGOTADO
    ) {
      return {
        permitida: false,
        codigo: 'TIEMPO_AGOTADO',
        mensaje: 'El tiempo máximo de participación ha finalizado.',
        sesion: sesion.toJSON(),
        actividadId,
        estudianteId,
        casoId: actividad.casoId
      };
    }

    if (sesion.estado !== ESTADOS_SESION.EN_CURSO) {
      throw crearError(
        'No se puede responder porque la sesión no está en curso.',
        409,
        'ESTADO_NO_PERMITIDO'
      );
    }

    const tiempoLimiteSegundos = actividad.tiempoLimiteSegundos;

    if (
      !Number.isSafeInteger(tiempoLimiteSegundos) ||
      tiempoLimiteSegundos <= 0
    ) {
      throw crearError(
        'La actividad tiene un tiempo máximo de participación inválido.',
        500
      );
    }

    const inicio = convertirFecha(sesion.inicio, 'inicio de la sesión');
    const ahora = convertirFecha(reloj(), 'actual');
    const fechaVencimiento = new Date(
      inicio.getTime() + tiempoLimiteSegundos * 1000
    );

    if (ahora.getTime() >= fechaVencimiento.getTime()) {
      // Se registra el instante real del vencimiento, no el momento tardío del reintento.
      sesion.finalizar({
        fechaFin: fechaVencimiento,
        segundosConsumidos: tiempoLimiteSegundos,
        motivoCierre: MOTIVOS_CIERRE.TIEMPO_AGOTADO
      });

      const sesionActualizada = await repositorio.actualizarSesion(
        conexion,
        sesion.toJSON()
      );

      // No lanzar aquí: Participación debe confirmar la transacción para conservar el cierre.
      return {
        permitida: false,
        codigo: 'TIEMPO_AGOTADO',
        mensaje: 'El tiempo máximo de participación ha finalizado.',
        sesion: sesionActualizada,
        actividadId,
        estudianteId,
        casoId: actividad.casoId
      };
    }

    return {
      permitida: true,
      codigo: null,
      mensaje: null,
      sesion: sesion.toJSON(),
      actividadId,
      estudianteId,
      casoId: actividad.casoId,
      tiempoLimiteSegundos,
      tiempoRestanteSegundos: Math.ceil(
        (fechaVencimiento.getTime() - ahora.getTime()) / 1000
      )
    };
  }

  /**
   * Finaliza una sesión que pertenece al estudiante.
   */
  async function finalizarSesion({
    sesionId,
    estudianteId,
    motivoCierre = MOTIVOS_CIERRE.FINALIZACION
  }) {
    validarIdentificador(sesionId, 'sesionId');
    validarIdentificador(estudianteId, 'estudianteId');

    return repositorio.enTransaccion(async (conexion) => {
      const sesionBD = await repositorio.obtenerSesionPorId(
        conexion,
        sesionId
      );

      if (!sesionBD) {
        throw crearError('La sesión no existe.', 404);
      }

      if (sesionBD.estudiante_id !== estudianteId) {
        throw crearError(
          'No tienes autorización para finalizar esta sesión.',
          403
        );
      }

      const sesion = convertirSesionBD(sesionBD);

      if (sesion.estado !== ESTADOS_SESION.EN_CURSO) {
        throw crearError(
          'Solamente se pueden finalizar sesiones en curso.',
          409
        );
      }

      sesion.finalizar({
        fechaFin: reloj(),
        motivoCierre
      });

      return repositorio.actualizarSesion(conexion, sesion.toJSON());
    });
  }

  return {
    iniciarSesion,
    finalizarSesion,
    validarSesionParaResponder
  };
}

export { crearServicioSesiones };
