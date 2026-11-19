import nodemailer from 'nodemailer';

const HOSTS_PLACEHOLDER = new Set([
  'smtp.example.com',
  'example.com',
  'localhost',
  '127.0.0.1'
]);

function modoSmtp(configuracion = process.env) {
  return String(configuracion.SMTP_MODE || '').trim().toLowerCase();
}

function smtpListo(configuracion = process.env) {
  return Boolean(
    String(configuracion.SMTP_HOST || '').trim() &&
    String(configuracion.SMTP_USER || '').trim() &&
    String(configuracion.SMTP_PASS || '').trim() &&
    String(configuracion.SMTP_FROM || '').trim() &&
    String(configuracion.SMTP_PORT || '').trim()
  );
}

function esSmtpPlaceholder(configuracion = process.env) {
  const modo = modoSmtp(configuracion);
  if (modo === 'ethereal' || modo === 'local' || modo === 'dev') {
    return true;
  }
  if (modo === 'demo' || modo === 'pantalla') {
    return false;
  }
  if (modo === 'smtp') {
    // Sin contraseña no hay Gmail real: se usa entrega en pantalla (Lumina).
    return !smtpListo(configuracion);
  }
  const host = String(configuracion.SMTP_HOST || '').trim().toLowerCase();
  return !host || HOSTS_PLACEHOLDER.has(host);
}

/**
 * Sin cuenta SMTP del sistema: Lumina registra el aviso y el código
 * se entrega en la pantalla de inicio de sesión (no usa tu correo personal).
 */
export function crearTransporteDemo() {
  return Object.freeze({
    modo: 'demo',
    async enviar(mensaje) {
      if (!mensaje || !mensaje.to || !mensaje.subject) {
        throw new TypeError('El mensaje de correo está incompleto.');
      }
      console.info(
        `[notificaciones] Modo demo/pantalla → para ${mensaje.to}: ${mensaje.subject}`
      );
      return {
        messageId: `demo-${Date.now()}`,
        previewUrl: null,
        demo: true
      };
    }
  });
}

/**
 * Transporte SMTP real (producción / Mailtrap / Gmail app password, etc.).
 */
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
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return Object.freeze({
    modo: 'smtp',
    async enviar(mensaje) {
      if (!mensaje || !mensaje.to || !mensaje.subject) {
        throw new TypeError('El mensaje de correo está incompleto.');
      }

      const info = await transportador.sendMail({
        from: SMTP_FROM,
        to: mensaje.to,
        subject: mensaje.subject,
        text: mensaje.text,
        html: mensaje.html
      });

      return {
        messageId: info.messageId,
        previewUrl: null
      };
    }
  });
}

/**
 * Ethereal: correo de prueba real (se puede abrir el preview en el navegador).
 * Ideal para demos locales sin SMTP de producción.
 */
export async function crearTransporteEthereal(configuracion = process.env) {
  const cuenta = await nodemailer.createTestAccount();
  const transportador = nodemailer.createTransport({
    host: cuenta.smtp.host,
    port: cuenta.smtp.port,
    secure: cuenta.smtp.secure,
    auth: {
      user: cuenta.user,
      pass: cuenta.pass
    }
  });

  const from = configuracion.SMTP_FROM?.trim() || `Lumina <${cuenta.user}>`;

  return Object.freeze({
    modo: 'ethereal',
    cuenta: { user: cuenta.user, pass: cuenta.pass },
    async enviar(mensaje) {
      if (!mensaje || !mensaje.to || !mensaje.subject) {
        throw new TypeError('El mensaje de correo está incompleto.');
      }

      const info = await transportador.sendMail({
        from,
        to: mensaje.to,
        subject: mensaje.subject,
        text: mensaje.text,
        html: mensaje.html
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      if (previewUrl) {
        console.info(`[notificaciones] Preview Ethereal → ${previewUrl}`);
      }

      return {
        messageId: info.messageId,
        previewUrl
      };
    }
  });
}

/**
 * Elige el mejor transporte disponible:
 * - SMTP_MODE=smtp + credenciales → Gmail/SMTP real (remitente Lumina)
 * - SMTP_MODE=demo|pantalla o smtp sin clave → entrega en pantalla
 * - ethereal/local → Ethereal (solo preview)
 */
export async function crearTransporteCorreo(configuracion = process.env) {
  const modo = modoSmtp(configuracion);

  if (modo === 'demo' || modo === 'pantalla') {
    console.info('[notificaciones] Modo demo: código en pantalla (remitente Lumina, sin Gmail).');
    return crearTransporteDemo();
  }

  if (modo === 'smtp' && smtpListo(configuracion)) {
    return crearTransporteSMTP(configuracion);
  }

  if (modo === 'smtp' && !smtpListo(configuracion)) {
    console.warn(
      '[notificaciones] SMTP_MODE=smtp sin credenciales. Usando entrega en pantalla hasta configurar la cuenta Lumina.'
    );
    return crearTransporteDemo();
  }

  if (!esSmtpPlaceholder(configuracion)) {
    return crearTransporteSMTP(configuracion);
  }

  try {
    const ethereal = await crearTransporteEthereal(configuracion);
    console.info(
      `[notificaciones] Usando Ethereal (${ethereal.cuenta.user}). Los correos se pueden ver en el preview.`
    );
    return ethereal;
  } catch (error) {
    console.warn(
      '[notificaciones] Ethereal no disponible; usando entrega en pantalla:',
      error?.message || error
    );
    return crearTransporteDemo();
  }
}

export { esSmtpPlaceholder, smtpListo };
