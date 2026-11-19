import {
  obtenerCreadorNotificacion
} from './notificaciones.factory.js';

export function crearServicioNotificaciones(transporte) {
  if (
    !transporte ||
    typeof transporte.enviar !== 'function'
  ) {
    throw new TypeError(
      'Se requiere un transporte de correo válido.'
    );
  }
  return Object.freeze({
    async enviar(tipo, datos) {
      const creador = obtenerCreadorNotificacion(tipo);
      const mensaje = creador.crearMensaje(datos);

      await transporte.enviar(mensaje, {
        tipo,
        actividadId: datos.actividadId ?? null,
        estudianteId: datos.estudianteId ?? null
      });

      return {
        destinatario: mensaje.to,
        asunto: mensaje.subject,
        estado: 'ENVIADO'
      };
    }
  });
}
