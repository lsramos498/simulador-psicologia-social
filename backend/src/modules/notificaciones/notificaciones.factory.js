import {
  NotificacionConvocatoriaStrategy,
  NotificacionCambioEstudianteStrategy
} from './notificaciones.strategy.js';

export const TIPOS_NOTIFICACION = Object.freeze({
  CONVOCATORIA: 'CONVOCATORIA',
  CAMBIO_ESTUDIANTE: 'CAMBIO_ESTUDIANTE'
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
export function obtenerCreadorNotificacion(tipo) {
  switch (tipo) {
    case TIPOS_NOTIFICACION.CONVOCATORIA:
      return new CreadorConvocatoria();

    case TIPOS_NOTIFICACION.CAMBIO_ESTUDIANTE:
      return new CreadorCambioEstudiante();

    default:
      throw new TypeError(
        `Tipo de notificación no válido: ${tipo}`
      );
  }
}