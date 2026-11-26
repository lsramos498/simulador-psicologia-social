/**
 * Parsea listas de estudiantes pegadas o extraídas de PDF/CSV.
 * Formatos admitidos por línea:
 * - correo@dominio.edu
 * - Nombre Apellido, correo@dominio.edu
 * - Nombre Apellido;correo@dominio.edu
 * - Nombre|Apellido|correo@dominio.edu
 */
export function parsearListaEstudiantes(texto) {
  if (typeof texto !== 'string' || !texto.trim()) {
    return { filas: [], errores: ['El texto de la lista está vacío.'] };
  }

  const filas = [];
  const errores = [];
  const vistos = new Set();
  const lineas = texto.split(/\r?\n/);

  lineas.forEach((lineaCruda, indice) => {
    const linea = lineaCruda.trim();
    if (!linea || /^[-–—=]{3,}$/.test(linea) || /^(nombre|estudiante|correo|lista)\b/i.test(linea)) {
      return;
    }

    let nombres = '';
    let apellidos = '';
    let correo = '';

    const emailMatch = linea.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (!emailMatch) {
      errores.push(`Línea ${indice + 1}: sin correo válido (${linea.slice(0, 60)})`);
      return;
    }
    correo = emailMatch[0].trim().toLowerCase();

    const sinCorreo = linea.replace(emailMatch[0], ' ').replace(/[,;|]+/g, ' ').trim();
    const partes = sinCorreo.split(/\s+/).filter(Boolean);

    if (partes.length >= 2) {
      nombres = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
      apellidos = partes.slice(Math.ceil(partes.length / 2)).join(' ');
    } else if (partes.length === 1) {
      nombres = partes[0];
      apellidos = 'Estudiante';
    } else {
      const local = correo.split('@')[0].replace(/[._-]+/g, ' ');
      nombres = local || 'Estudiante';
      apellidos = 'Lista';
    }

    if (vistos.has(correo)) {
      errores.push(`Línea ${indice + 1}: correo duplicado (${correo})`);
      return;
    }
    vistos.add(correo);
    filas.push({
      nombres: nombres.slice(0, 100),
      apellidos: apellidos.slice(0, 100),
      correo
    });
  });

  return { filas, errores };
}
