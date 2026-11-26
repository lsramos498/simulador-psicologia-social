/**
 * Repara U+FFFD típicos de textos importados (PDF) en español.
 * Espejo ligero del backend para mostrar bien aunque la API aún no se reinicie.
 */

function conservarMayuscula(match, base) {
  const primero = match[0];
  if (primero !== primero.toLocaleLowerCase('es')) {
    return base[0].toLocaleUpperCase('es') + base.slice(1);
  }
  return base;
}

function regla(patron, base) {
  return [patron, (m) => conservarMayuscula(m, base)];
}

const REEMPLAZOS = [
  regla(/T\uFFFDtulo/gi, 'Título'),
  regla(/R\uFFFDbrica/gi, 'Rúbrica'),
  [/C\uFFFDmo/g, 'Cómo'],
  [/c\uFFFDmo/g, 'cómo'],
  [/Cu\uFFFDl/g, 'Cuál'],
  [/cu\uFFFDl/g, 'cuál'],
  [/Qu\uFFFD/g, 'Qué'],
  [/qu\uFFFD/g, 'qué'],
  regla(/mediaci\uFFFDn/gi, 'mediación'),
  regla(/intervenci\uFFFDn/gi, 'intervención'),
  regla(/evaluaci\uFFFDn/gi, 'evaluación'),
  regla(/situaci\uFFFDn/gi, 'situación'),
  regla(/tensi\uFFFDn/gi, 'tensión'),
  regla(/versi\uFFFDn/gi, 'versión'),
  regla(/pr\uFFFDctica/gi, 'práctica'),
  [/\uFFFD(?=[A-ZÁÉÍÓÚÑ])/g, '¿']
];

export function repararTextoUtf8(valor) {
  if (valor == null || typeof valor !== 'string') return valor;
  if (!valor.includes('\uFFFD') && !/T[ií]tulo\s*:/i.test(valor)) return valor;

  let texto = valor;
  for (const [patron, reemplazo] of REEMPLAZOS) {
    texto = texto.replace(patron, reemplazo);
  }
  texto = texto.replace(/^\s*Título\s*:\s*/i, '');
  texto = texto.replace(/\bTítulo\s*:\s*/gi, '');
  texto = texto.replace(/\s{2,}/g, ' ').trim() || valor.trim();

  if (/^[CQcq]/.test(texto) && /\?$/.test(texto) && !texto.startsWith('¿')) {
    if (/^(Cómo|Cuál|Qué|como|cuál|qué)\b/.test(texto)) {
      texto = `¿${texto}`;
    }
  }
  return texto;
}

/** Limpia U+FFFD y separadores rotos en nombres cortos (grupos, títulos). */
export function limpiarNombreVisible(valor) {
  if (valor == null) return '';
  let texto = String(valor);
  texto = texto.replace(/\uFFFD+/g, ' - ');
  texto = texto.replace(/[\u00B7\u2022\u2219\u22C5•∙⋅]/g, ' - ');
  texto = texto.replace(/\s*-\s*/g, ' - ');
  texto = texto.replace(/\s{2,}/g, ' ').trim();
  return repararTextoUtf8(texto) || texto;
}
