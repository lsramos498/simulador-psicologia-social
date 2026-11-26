import { TIPOS_NOTIFICACION } from './notificaciones.factory.js';
import { crearTransporteCorreo } from './notificaciones.smtp.js';

const MAPA_TIPO = Object.freeze({
  [TIPOS_NOTIFICACION.CONVOCATORIA]: 'Convocatoria',
  [TIPOS_NOTIFICACION.CAMBIO_ESTUDIANTE]: 'CambioConvocatoria',
  [TIPOS_NOTIFICACION.COMENTARIO_DOCENTE]: 'Retroalimentacion',
  [TIPOS_NOTIFICACION.CODIGO_SESION]: 'CodigoSesion'
});

/**
 * Transporte de notificaciones:
 * - Envía por Ethereal (demo) o SMTP real.
 * - Persiste vía repositorio (Dependency Inversion), no con SQL suelto.
 */
export async function crearTransporteNotificaciones(repositorio, configuracion = process.env) {
  if (!repositorio || typeof repositorio.insertar !== 'function') {
    throw new TypeError('Se requiere el repositorio de notificaciones.');
  }

  let correo = null;
  let correoError = null;
  try {
    correo = await crearTransporteCorreo(configuracion);
  } catch (error) {
    correoError = error?.message || String(error);
    console.warn('[notificaciones] Sin transporte de correo:', correoError);
  }

  return Object.freeze({
    smtpDisponible: Boolean(correo),
    modo: correo?.modo || 'sistema',
    smtpError: correoError,

    async enviar(mensaje, meta = {}) {
      if (!mensaje || !mensaje.to || !mensaje.subject) {
        throw new TypeError('El mensaje de correo está incompleto.');
      }

      const tipoBd = MAPA_TIPO[meta.tipo] || 'Convocatoria';
      const usuarioId = Number(meta.estudianteId);
      const actividadId = meta.actividadId != null ? Number(meta.actividadId) : null;
      const ahora = new Date();
      let cuerpo = String(mensaje.text || mensaje.html || mensaje.subject).slice(0, 8000);
      const url = typeof meta.url === 'string' && meta.url.trim()
        ? meta.url.trim()
        : (process.env.URL_ACCESO || 'http://localhost:5173');

      let canal = 'Sistema';
      let estado = 'Enviada';
      let errorEnvio = correo ? null : (correoError || 'Sin transporte de correo');
      let fechaEnvio = ahora;
      let previewUrl = null;

      let demo = false;
      if (correo) {
        try {
          const info = await correo.enviar(mensaje);
          demo = Boolean(info?.demo) || correo.modo === 'demo';
          canal = demo ? 'Sistema' : 'Correo';
          errorEnvio = null;
          previewUrl = info?.previewUrl || null;
          if (previewUrl) {
            cuerpo = `${cuerpo}\n\n[Preview del correo]: ${previewUrl}`.slice(0, 8000);
          }
        } catch (error) {
          canal = 'Sistema';
          estado = 'Enviada';
          errorEnvio = error?.message || String(error);
          console.warn('[notificaciones] Falló el envío de correo:', errorEnvio);
        }
      }

      // OTP de sesión no se guarda en Notificacion (CHECK de tipo + no ensucia el inbox).
      const persistir =
        meta.tipo !== TIPOS_NOTIFICACION.CODIGO_SESION &&
        Number.isSafeInteger(usuarioId) &&
        usuarioId > 0;

      if (persistir) {
        await repositorio.insertar({
          usuarioId,
          actividadId: Number.isSafeInteger(actividadId) && actividadId > 0 ? actividadId : null,
          tipo: tipoBd,
          canal,
          asunto: String(mensaje.subject).slice(0, 255),
          mensaje: cuerpo,
          url,
          estado,
          fechaCreacion: ahora,
          fechaEnvio,
          errorEnvio
        });
      }

      return {
        destinatario: mensaje.to,
        asunto: mensaje.subject,
        estado,
        canal,
        previewUrl,
        demo,
        smtp: canal === 'Correo'
      };
    }
  });
}
