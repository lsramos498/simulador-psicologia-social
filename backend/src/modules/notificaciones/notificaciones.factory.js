import {
  NotificacionConvocatoriaStrategy,
  NotificacionCambioEstudianteStrategy,
  NotificacionComentarioDocenteStrategy,
  NotificacionCodigoSesionStrategy
} from './notificaciones.strategy.js';

export const TIPOS_NOTIFICACION = Object.freeze({
  CONVOCATORIA: 'CONVOCATORIA',
  CAMBIO_ESTUDIANTE: 'CAMBIO_ESTUDIANTE',
  COMENTARIO_DOCENTE: 'COMENTARIO_DOCENTE',
  CODIGO_SESION: 'CODIGO_SESION'
});
export class CreadorNotificacion {
  crearEstrategia() {
    throw new Error(
      'El método crearEstrategia debe implementarse.'
    );
  }

  crearMensaje(datos) {
    const estrategia = this.crearEstrategia();

    return estrategia.crearMensaje(datos);
  }
}
export class CreadorConvocatoria extends CreadorNotificacion {
  crearEstrategia() {
    return new NotificacionConvocatoriaStrategy();
  }
}

export class CreadorCambioEstudiante extends CreadorNotificacion {
  crearEstrategia() {
    return new NotificacionCambioEstudianteStrategy();
  }
}

export class CreadorComentarioDocente extends CreadorNotificacion {
  crearEstrategia() {
    return new NotificacionComentarioDocenteStrategy();
  }
}

export class CreadorCodigoSesion extends CreadorNotificacion {
  crearEstrategia() {
    return new NotificacionCodigoSesionStrategy();
  }
}
export function obtenerCreadorNotificacion(tipo) {
  switch (tipo) {
    case TIPOS_NOTIFICACION.CONVOCATORIA:
      return new CreadorConvocatoria();

    case TIPOS_NOTIFICACION.CAMBIO_ESTUDIANTE:
      return new CreadorCambioEstudiante();

    case TIPOS_NOTIFICACION.COMENTARIO_DOCENTE:
      return new CreadorComentarioDocente();

    case TIPOS_NOTIFICACION.CODIGO_SESION:
      return new CreadorCodigoSesion();

    default:
      throw new TypeError(
        `Tipo de notificación no válido: ${tipo}`
      );
  }
}