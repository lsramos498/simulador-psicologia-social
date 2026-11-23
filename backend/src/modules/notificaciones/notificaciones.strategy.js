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

    const url = validarUrl(urlAcceso);
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
      `Convocatoria: ${titulo}`,
      '',
      lineaDocente,
      '',
      desarrollo,
      contexto,
      '',
      mensaje,
      '',
      `Ingresa a la actividad: ${url}`,
      `Código de autorización: ${codigo}`,
      '',
      'Remitente técnico: Lumina. Si respondes, el correo puede llegar al docente institucional.'
    ];

    const contenidoHtml = [
      `<h2>Convocatoria: ${escaparHtml(titulo)}</h2>`,
      `<p>${escaparHtml(lineaDocente)}</p>`,
      desarrollo ? `<p>${escaparHtml(desarrollo)}</p>` : '',
      contexto ? `<p>${escaparHtml(contexto)}</p>` : '',
      `<p>${escaparHtml(mensaje)}</p>`,
      `<p><a href="${escaparHtml(url)}">Ingresar a Lumina</a></p>`,
      `<p><strong>Código de autorización:</strong> ${escaparHtml(codigo)}</p>`,
      '<p><em>Remitente técnico: Lumina. Reply-To: correo institucional del docente.</em></p>'
    ].filter(Boolean).join('\n');

    return {
      to: correo,
      subject: `Convocatoria: ${titulo}`,
      text: partesTexto.join('\n'),
      html: contenidoHtml,
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
    if (
      accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO &&
      urlAcceso
    ) {
      partes.push(`Ingresa a la actividad: ${validarUrl(urlAcceso)}`);
    }

    const mensaje = partes.join('\n');
    const htmlPartes = [
      `<p>${escaparHtml(partes[0])}</p>`
    ];
    if (replyTo) {
      htmlPartes.push(`<p>${escaparHtml(partes[1])}</p>`);
    }
    if (codigoAutorizacion && accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO) {
      htmlPartes.push(
        `<p><strong>Código de autorización:</strong> ${escaparHtml(String(codigoAutorizacion).trim())}</p>`
      );
    }
    if (urlAcceso && accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO) {
      const url = validarUrl(urlAcceso);
      htmlPartes.push(`<p><a href="${escaparHtml(url)}">Ingresar a Lumina</a></p>`);
    }

    return {
      to: correo,
      subject: `Actualización de convocatoria: ${titulo}`,
      text: mensaje,
      html: htmlPartes.join('\n'),
      ...(replyTo ? { replyTo } : {})
    };
  }
}
