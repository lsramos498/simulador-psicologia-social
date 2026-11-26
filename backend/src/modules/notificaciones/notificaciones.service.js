import {
  obtenerCreadorNotificacion
} from './notificaciones.factory.js';

export function crearServicioNotificaciones(transporte, repositorio = null) {
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

      const envio = await transporte.enviar(mensaje, {
        tipo,
        actividadId: datos.actividadId ?? null,
        estudianteId: datos.estudianteId ?? null,
        url: datos.urlAcceso ?? null
      });

      return {
        destinatario: mensaje.to,
        asunto: mensaje.subject,
        estado: envio?.estado || 'ENVIADO',
        canal: envio?.canal || null,
        previewUrl: envio?.previewUrl || null,
        demo: Boolean(envio?.demo)
      };
    },

    async listarPropias(usuarioId) {
      if (!repositorio) {
        throw new TypeError('Se requiere el repositorio de notificaciones.');
      }
      const id = Number(usuarioId);
      if (!Number.isSafeInteger(id) || id <= 0) {
        const error = new Error('Sesión inválida.');
        error.statusCode = 401;
        throw error;
      }
      return repositorio.listarPorUsuario(id);
    },

    async marcarLeida(notificacionId, usuarioId) {
      if (!repositorio) {
        throw new TypeError('Se requiere el repositorio de notificaciones.');
      }
      const id = Number(notificacionId);
      const uid = Number(usuarioId);
      if (!Number.isSafeInteger(uid) || uid <= 0) {
        const error = new Error('Sesión inválida.');
        error.statusCode = 401;
        throw error;
      }
      if (!Number.isSafeInteger(id) || id <= 0) {
        const error = new Error('Identificador inválido.');
        error.statusCode = 400;
        throw error;
      }
      const actualizadas = await repositorio.marcarLeida(id, uid);
      return { id, actualizadas };
    }
  });
}
