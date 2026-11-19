function validarTexto(valor, campo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new TypeError(`${campo} es obligatorio.`);
  }

  const texto = valor.trim();

  if (/[\r\n]/.test(texto)) {
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
    codigoAutorizacion
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
      ? validarTexto(mensajePersonalizado, 'El mensaje personalizado')
      : 'Has sido convocado a una actividad del Simulador de Psicología Social.';

    const url = validarUrl(urlAcceso);
    const codigo = validarTexto(
      codigoAutorizacion,
      'El código de autorización'
    );
    const partesTexto = [
      `Convocatoria: ${titulo}`,
      '',
      desarrollo,
      contexto,
      '',
      mensaje,
      '',
      `Ingresa a la actividad: ${url}`,
      `Código de autorización: ${codigo}`
    ];

    const contenidoHtml = [
      `<h2>Convocatoria: ${escaparHtml(titulo)}</h2>`,
      desarrollo ? `<p>${escaparHtml(desarrollo)}</p>` : '',
      contexto ? `<p>${escaparHtml(contexto)}</p>` : '',
      `<p>${escaparHtml(mensaje)}</p>`,
      `<p><a href="${escaparHtml(url)}">Ingresar a Lumina</a></p>`,
      `<p><strong>Código de autorización:</strong> ${escaparHtml(codigo)}</p>`
    ].filter(Boolean).join('\n');

    return {
      to: correo,
      subject: `Convocatoria: ${titulo}`,
      text: partesTexto.join('\n'),
      html: contenidoHtml
    };
  }
}
export class NotificacionCambioEstudianteStrategy {
  crearMensaje({
    destinatario,
    casoTitulo,
    accion
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
    const mensaje = accion === ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO
      ? `Has sido agregado a la convocatoria del caso "${titulo}".`
      : `Has sido retirado de la convocatoria del caso "${titulo}".`;

    return {
      to: correo,
      subject: `Actualización de convocatoria: ${titulo}`,
      text: mensaje,
      html: `<p>${escaparHtml(mensaje)}</p>`
    };
  }
}
