import {
  envolverCorreoLumina,
  resolverAdjuntoActividad
} from './notificaciones.plantilla.js';

function validarTexto(valor, campo, { permitirSaltos = false } = {}) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new TypeError(`${campo} es obligatorio.`);
  }

  const texto = valor.trim();

  if (!permitirSaltos && /[\r\n]/.test(texto)) {
    throw new TypeError(`${campo} contiene caracteres no permitidos.`);
  }

  return texto;
}
function validarCorreo(correo) {
  const destinatario = validarTexto(
    correo,
    'El correo destinatario'
  );

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
    throw new TypeError('El correo destinatario no es válido.');
  }

  return destinatario;
}

/**
 * Correo institucional del docente para Reply-To.
 * El From técnico sigue siendo el del sistema (SMTP_FROM / Lumina).
 * No usa cuentas personales ni contraseñas del docente.
 */
function correoInstitucionalOpcional(correo, etiqueta = 'El correo del docente') {
  if (correo == null || correo === '') {
    return null;
  }
  if (typeof correo !== 'string') {
    throw new TypeError(`${etiqueta} no es válido.`);
  }
  const limpio = correo.trim();
  if (!limpio) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
    throw new TypeError(`${etiqueta} no es válido.`);
  }
  return limpio;
}

function nombreDocenteOpcional(nombre) {
  if (nombre == null || nombre === '') {
    return null;
  }
  if (typeof nombre !== 'string') {
    return null;
  }
  const limpio = nombre.trim();
  return limpio || null;
}

function escaparHtml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parrafo(texto) {
  return `<p style="margin:0 0 14px;">${escaparHtml(texto)}</p>`;
}

function cajaCodigo(codigo, etiqueta = '🔑 Tu código de acceso') {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
      <tr>
        <td style="padding:16px 18px;border-radius:14px;background:linear-gradient(180deg,#2a1c14,#1a1428);border:1px solid rgba(243,210,122,0.45);text-align:center;">
          <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,236,200,0.7);margin-bottom:8px;">
            ${escaparHtml(etiqueta)}
          </div>
          <div style="font-family:Consolas,'Courier New',monospace;font-size:28px;letter-spacing:0.18em;color:#f3d27a;font-weight:700;">
            ${escaparHtml(codigo)}
          </div>
        </td>
      </tr>
    </table>`;
}
function validarUrl(url) {
  const valor = validarTexto(url, 'La URL de acceso');
  let resultado;

  try {
    resultado = new URL(valor);
  } catch {
    throw new TypeError('La URL de acceso no es válida.');
  }

  if (!['http:', 'https:'].includes(resultado.protocol)) {
    throw new TypeError('La URL debe utilizar HTTP o HTTPS.');
  }

  return resultado.toString();
}

/** Garantiza que el CTA del correo abra login de estudiante (no el taller docente). */
function urlAccesoLoginEstudiante(urlAcceso, correoDestinatario) {
  const url = new URL(validarUrl(urlAcceso));
  url.searchParams.set('acceso', 'estudiante');
  const mail = typeof correoDestinatario === 'string'
    ? correoDestinatario.trim().toLowerCase()
    : '';
  if (mail) {
    url.searchParams.set('correo', mail);
  }
  // Evita que el navegador solo enfoque la pestaña docente sin recargar.
  url.searchParams.set('ingreso', String(Date.now()));
  return url.toString();
}

export const ACCIONES_CAMBIO_ESTUDIANTE = Object.freeze({
  AGREGADO: 'AGREGADO',
  RETIRADO: 'RETIRADO'
});
export class NotificacionConvocatoriaStrategy {
  crearMensaje({
    destinatario,
    caso,
    mensajePersonalizado,
    urlAcceso,
    codigoAutorizacion,
    docenteCorreo,
    docenteNombre
  }) {
    const correo = validarCorreo(destinatario);
    const titulo = validarTexto(
      caso?.titulo,
      'El título del caso'
    );

    const desarrollo = caso?.desarrolloSituacional ?? '';
    const contexto = caso?.contextoHistoria ?? '';
    if (
      typeof desarrollo !== 'string' ||
      typeof contexto !== 'string'
    ) {
      throw new TypeError('La información del caso no es válida.');
    }

    const mensaje = mensajePersonalizado
      ? validarTexto(mensajePersonalizado, 'El mensaje personalizado', {
        permitirSaltos: true
      })
      : 'Has sido convocado a una actividad del Simulador de Psicología Social.';

    const url = urlAccesoLoginEstudiante(urlAcceso, correo);
    const codigo = validarTexto(
      codigoAutorizacion,
      'El código de autorización'
    );
    const replyTo = correoInstitucionalOpcional(docenteCorreo);
    const nombreDocente = nombreDocenteOpcional(docenteNombre);
    const lineaDocente = replyTo
      ? (nombreDocente
        ? `Convocada por ${nombreDocente} (${replyTo}) a través de Lumina.`
        : `Convocada por el docente (${replyTo}) a través de Lumina.`)
      : 'Este mensaje lo envía Lumina (sistema institucional).';

    const partesTexto = [
      `✨ Convocatoria Lumina: ${titulo}`,
      '',
      lineaDocente,
      '',
      desarrollo,
      contexto,
      '',
      mensaje,
      '',
      'Para entrar: abre Lumina → Iniciar sesión → tu correo → Enviar código → usa el código de sesión que te llega.',
      'Cuando tu docente inicie la actividad, vas a poder practicarla.',
      `Enlace: ${url}`,
      `Referencia de convocatoria: ${codigo}`,
      '',
      'Remitente técnico: Lumina. Si respondes, el correo puede llegar al docente institucional.'
    ];

    const cuerpoHtml = [
      parrafo(`👋 ${lineaDocente}`),
      desarrollo ? parrafo(`📖 ${desarrollo}`) : '',
      contexto ? parrafo(`🏫 ${contexto}`) : '',
      parrafo(`💬 ${mensaje}`),
      parrafo(
        'Entra a Lumina con tu correo y pide el código de inicio de sesión. Cuando el docente inicie la actividad, podrás practicarla.'
      ),
      parrafo(`Referencia de convocatoria: ${codigo}`)
    ].filter(Boolean).join('\n');

    const { html, attachments } = envolverCorreoLumina({
      kicker: '✨ Convocatoria académica',
      tituloHero: escaparHtml(titulo),
      cuerpoHtml,
      ctaUrl: escaparHtml(url),
      ctaTexto: 'Iniciar sesión en Lumina',
      pieHtml: '📬 Remitente: <strong style="color:#f3d27a;">Lumina</strong>. Si respondes, el mensaje puede llegar al correo institucional del docente.'
    });

    return {
      to: correo,
      subject: `✨ Convocatoria Lumina: ${titulo}`,
      text: partesTexto.join('\n'),
      html,
      attachments,
      ...(replyTo ? { replyTo } : {})
    };
  }
}
export class NotificacionComentarioDocenteStrategy {
  crearMensaje({
    destinatario,
    casoTitulo,
    comentarioDocente,
    retroalimentacionGeneral,
    nota,
    casoId,
    docenteCorreo,
    docenteNombre,
    estudianteNombre
  }) {
    const correo = validarCorreo(destinatario);
    const titulo = validarTexto(casoTitulo, 'El título del caso');
    const comentario = validarTexto(comentarioDocente, 'El comentario docente', {
      permitirSaltos: true
    });
    const replyTo = correoInstitucionalOpcional(docenteCorreo);
    const nombreDocente = nombreDocenteOpcional(docenteNombre);
    const nombreEst = nombreDocenteOpcional(estudianteNombre);
    const imagen = resolverAdjuntoActividad(casoId);

    const firmaDocente = replyTo
      ? (nombreDocente
        ? `${nombreDocente} (${replyTo})`
        : `tu docente (${replyTo})`)
      : (nombreDocente || 'tu docente');

    const saludo = nombreEst ? `Hola ${nombreEst},` : 'Hola,';
    const retro = typeof retroalimentacionGeneral === 'string' && retroalimentacionGeneral.trim()
      ? retroalimentacionGeneral.trim()
      : null;
    const notaTexto = nota != null && nota !== '' ? String(nota) : null;

    const partesTexto = [
      `📝 Comentario docente Lumina: ${titulo}`,
      '',
      saludo,
      `${firmaDocente} dejó un comentario sobre tu participación.`,
      '',
      `Actividad / caso: ${titulo}`,
      notaTexto ? `Nota: ${notaTexto}` : null,
      retro ? `Retroalimentación automática: ${retro}` : null,
      '',
      'Comentario del docente:',
      comentario,
      '',
      'Remitente técnico: Lumina. Si respondes, el correo puede llegar al docente institucional.'
    ].filter((linea) => linea != null);

    const cuerpoHtml = [
      parrafo(`👋 ${saludo}`),
      parrafo(`👩‍🏫 ${firmaDocente} dejó un comentario sobre tu participación en esta actividad.`),
      notaTexto ? parrafo(`⭐ Nota oficial: ${notaTexto}`) : '',
      retro ? parrafo(`📌 Retroalimentación del sistema: ${retro}`) : '',
      `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
        <tr>
          <td style="padding:16px 18px;border-radius:14px;background:linear-gradient(180deg,#2a1c14,#1a1428);border:1px solid rgba(243,210,122,0.45);">
            <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,236,200,0.7);margin-bottom:8px;">
              💬 Comentario del docente
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#fff8e8;white-space:pre-wrap;">
              ${escaparHtml(comentario)}
            </div>
          </td>
        </tr>
      </table>`
    ].filter(Boolean).join('\n');

    const { html, attachments } = envolverCorreoLumina({
      kicker: '📝 Comentario docente',
      tituloHero: escaparHtml(titulo),
      cuerpoHtml,
      ctaUrl: null,
      pieHtml: '📬 Enviado por <strong style="color:#f3d27a;">Lumina</strong>. Si respondes, el mensaje puede llegar al correo institucional del docente.',
      imagenActividad: imagen
    });

    return {
      to: correo,
      subject: `📝 Comentario docente Lumina: ${titulo}`,
      text: partesTexto.join('\n'),
      html,
      attachments,
      ...(replyTo ? { replyTo } : {})
    };
  }
}

export class NotificacionCambioEstudianteStrategy {
  crearMensaje({
    destinatario,
    casoTitulo,
    accion,
    codigoAutorizacion,
    urlAcceso,
    docenteCorreo,
    docenteNombre
  }) {
    const correo = validarCorreo(destinatario);
    const titulo = validarTexto(
      casoTitulo,
      'El título del caso'
    );

    if (
      !Object.values(ACCIONES_CAMBIO_ESTUDIANTE).includes(accion)
    ) {
      throw new TypeError(
        'La acción de cambio de estudiante no es válida.'
      );
    }
    const replyTo = correoInstitucionalOpcional(docenteCorreo);
    const nombreDocente = nombreDocenteOpcional(docenteNombre);
    const partes = [
      accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO
        ? `Has sido agregado a la convocatoria del caso "${titulo}".`
        : `Has sido retirado de la convocatoria del caso "${titulo}".`
    ];

    if (replyTo) {
      partes.push(
        nombreDocente
          ? `Gestión realizada por ${nombreDocente} (${replyTo}) a través de Lumina.`
          : `Gestión realizada por el docente (${replyTo}) a través de Lumina.`
      );
    }

    if (
      accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO &&
      codigoAutorizacion
    ) {
      partes.push(`Código de autorización: ${validarTexto(codigoAutorizacion, 'El código de autorización')}`);
    }
    const esAgregado = accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO;
    const url = esAgregado && urlAcceso
      ? urlAccesoLoginEstudiante(urlAcceso, correo)
      : null;
    if (url) {
      partes.push(`Ingresa a la actividad: ${url}`);
    }

    const mensaje = partes.join('\n');
    const codigo = esAgregado && codigoAutorizacion
      ? validarTexto(codigoAutorizacion, 'El código de autorización')
      : null;

    const cuerpoHtml = [
      parrafo(`${esAgregado ? '🎉' : 'ℹ️'} ${partes[0]}`),
      replyTo ? parrafo(`👩‍🏫 ${partes[1]}`) : '',
      codigo ? cajaCodigo(codigo) : ''
    ].filter(Boolean).join('\n');

    const { html, attachments } = envolverCorreoLumina({
      kicker: esAgregado ? '🎉 Actualización de convocatoria' : 'ℹ️ Actualización de convocatoria',
      tituloHero: escaparHtml(titulo),
      cuerpoHtml,
      ctaUrl: url ? escaparHtml(url) : null,
      ctaTexto: 'Iniciar sesión como estudiante',
      pieHtml: '📬 Enviado por <strong style="color:#f3d27a;">Lumina</strong>.'
    });

    return {
      to: correo,
      subject: `${esAgregado ? '🎉' : 'ℹ️'} Actualización Lumina: ${titulo}`,
      text: mensaje,
      html,
      attachments,
      ...(replyTo ? { replyTo } : {})
    };
  }
}

/** OTP de inicio de sesión (no es código de una actividad). */
export class NotificacionCodigoSesionStrategy {
  crearMensaje({
    destinatario,
    codigoAutorizacion,
    urlAcceso,
    minutosValidez = 15
  }) {
    const correo = validarCorreo(destinatario);
    const codigo = validarTexto(codigoAutorizacion, 'El código de sesión');
    const url = urlAccesoLoginEstudiante(urlAcceso, correo);
    const minutos = Number(minutosValidez) || 15;

    const text = [
      '✨ Código de inicio de sesión — Lumina',
      '',
      'Hola. Lumina te envía tu código para iniciar sesión.',
      '',
      `🔑 Código: ${codigo}`,
      `Válido por ${minutos} minutos.`,
      '',
      'Copia el código, vuelve a Lumina e ingrésalo para entrar.',
      'Dentro verás tus actividades programadas.',
      '',
      `Enlace: ${url}`,
      '',
      'Remitente técnico: Lumina.'
    ].join('\n');

    const cuerpoHtml = [
      parrafo('👋 Hola. Lumina te envía tu código para iniciar sesión.'),
      cajaCodigo(codigo, '🔑 Tu código de inicio de sesión'),
      parrafo(`Válido por ${minutos} minutos. Cópialo, vuelve a Lumina e ingrésalo para entrar.`),
      parrafo('Dentro verás tus actividades programadas.')
    ].join('\n');

    const { html, attachments } = envolverCorreoLumina({
      kicker: '✨ Acceso a Lumina',
      tituloHero: 'Código de inicio de sesión',
      cuerpoHtml,
      ctaUrl: escaparHtml(url),
      ctaTexto: 'Iniciar sesión en Lumina',
      pieHtml: '📬 Remitente: <strong style="color:#f3d27a;">Lumina</strong>.'
    });

    return {
      to: correo,
      subject: '✨ Tu código de inicio de sesión — Lumina',
      text,
      html,
      attachments
    };
  }
}
