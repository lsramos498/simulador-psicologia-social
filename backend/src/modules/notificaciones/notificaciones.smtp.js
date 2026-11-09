
import nodemailer from 'nodemailer';

export function crearTransporteSMTP(configuracion = process.env) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM
  } = configuracion;

  const obligatorias = {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM
  };

  const faltantes = Object.entries(obligatorias)
    .filter(([, valor]) => !valor || !String(valor).trim())
    .map(([nombre]) => nombre);

  if (faltantes.length > 0) {
    throw new Error(
      `Falta configurar el correo SMTP: ${faltantes.join(', ')}.`
    );
  }

  const puerto = Number(SMTP_PORT);

  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new TypeError('SMTP_PORT debe ser un puerto válido.');
  }

  const seguro = SMTP_SECURE === undefined
    ? puerto === 465
    : String(SMTP_SECURE).toLowerCase() === 'true';

  const transportador = nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    secure: seguro,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return Object.freeze({
    async enviar(mensaje) {
      if (!mensaje || !mensaje.to || !mensaje.subject) {
        throw new TypeError('El mensaje de correo está incompleto.');
      }

      return transportador.sendMail({
        from: SMTP_FROM,
        to: mensaje.to,
        subject: mensaje.subject,
        text: mensaje.text,
        html: mensaje.html
      });
    }
  });
}
