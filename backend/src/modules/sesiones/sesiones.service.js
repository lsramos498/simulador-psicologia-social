import {
  SesionSimulacion,
  ESTADOS_SESION,
  MOTIVOS_CIERRE
} from './sesion.state.js';

function validarIdentificador(valor, nombre) {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    const error = new Error(`${nombre} debe ser un entero positivo.`);
    error.statusCode = 400;
    throw error;
  }
}

function crearError(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
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

      const ahora = reloj();

      if (ahora < new Date(actividad.fechaInicio) ||
          ahora > new Date(actividad.fechaFin)) {
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

            // El límite de intentos lo establece el docente al programar
      // la actividad.
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
        // Si ya existe una sesión en curso, se recupera.
        // No se consume un intento adicional.
        if (ultimaSesion.estado === ESTADOS_SESION.EN_CURSO) {
          return convertirSesionBD(ultimaSesion).toJSON();
        }

        // Si finalizó, se comprueba si quedan intentos.
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
    finalizarSesion
  };
}

export { crearServicioSesiones };
