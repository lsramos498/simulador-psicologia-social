const columnas = [
  ['actividadId', 'Actividad'],
  ['casoId', 'Caso'],
  ['estudianteId', 'Estudiante'],
  ['nombres', 'Nombres'],
  ['apellidos', 'Apellidos'],
  ['correo', 'Correo'],
  ['estado', 'Estado de participación'],
  ['intentoParticipacion', 'Intento de participación'],
  ['preguntasRespondidas', 'Preguntas respondidas'],
  ['totalPreguntas', 'Total de preguntas'],
  ['notaOficial', 'Nota oficial'],
  ['intentoNota', 'Intento de la nota']
];

function celdaCsv(valor) {
  const texto = String(valor ?? '');
  // Evita que una hoja de cálculo interprete texto ingresado como una fórmula.
  const seguro = typeof valor === 'string' && /^(?:[\t\r\n]|\s*[=+@＝＋＠－-])/u.test(texto)
    ? `'${texto}`
    : texto;
  return /[",\r\n]/u.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function generarReporteParticipacion(participaciones) {
  const encabezado = columnas.map(([, titulo]) => titulo).join(',');
  const filas = participaciones.map((participacion) =>
    columnas.map(([campo]) => celdaCsv(participacion[campo])).join(',')
  );
  return `\uFEFF${[encabezado, ...filas].join('\r\n')}\r\n`;
}
