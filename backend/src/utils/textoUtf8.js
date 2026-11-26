/**
 * Repara texto con caracteres de reemplazo (U+FFFD) típicos de PDFs/Latin-1 mal leídos en español.
 * No inventa contenido: solo corrige patrones frecuentes de tildes y signos.
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
  regla(/orientaci\uFFFDn/gi, 'orientación'),
  regla(/participaci\uFFFDn/gi, 'participación'),
  regla(/descripci\uFFFDn/gi, 'descripción'),
  regla(/atenci\uFFFDn/gi, 'atención'),
  regla(/informaci\uFFFDn/gi, 'información'),
  regla(/conversaci\uFFFDn/gi, 'conversación'),
  regla(/tensi\uFFFDn/gi, 'tensión'),
  regla(/versi\uFFFDn/gi, 'versión'),
  regla(/decisi\uFFFDn/gi, 'decisión'),
  regla(/opci\uFFFDn/gi, 'opción'),
  regla(/acci\uFFFDn/gi, 'acción'),
  regla(/relaci\uFFFDn/gi, 'relación'),
  regla(/organizaci\uFFFDn/gi, 'organización'),
  regla(/pr\uFFFDctica/gi, 'práctica'),
  [/\uFFFDtica/gi, 'ética'],
  regla(/b\uFFFDsico/gi, 'básico'),
  [/m\uFFFD[sx]/gi, (m) => (m.toLowerCase().endsWith('s') ? 'más' : 'máx')],
  regla(/tambi\uFFFDn/gi, 'también'),
  regla(/despu\uFFFDs/gi, 'después'),
  regla(/seg\uFFFD[nm]/gi, 'según'),
  regla(/autonom\uFFFDa/gi, 'autonomía'),
  regla(/psicolog\uFFFDa/gi, 'psicología'),
  regla(/d\uFFFDa/gi, 'día'),
  regla(/ni\uFFFDo/gi, 'niño'),
  regla(/ni\uFFFDa/gi, 'niña'),
  regla(/comi\uFFFDn/gi, 'común'),
  regla(/f\uFFFDcil/gi, 'fácil'),
  regla(/dif\uFFFDcil/gi, 'difícil'),
  regla(/r\uFFFDpido/gi, 'rápido'),
  regla(/Evaluacion/gi, 'Evaluación'),
  [/\uFFFD(?=[A-ZÁÉÍÓÚÑ])/g, '¿'],
  [/\s*\uFFFD\s*/g, ' - ']
];

export function repararTextoUtf8(valor) {
  if (valor == null) return valor;
  if (typeof valor !== 'string') return valor;

  const multilinea = /[\r\n]/.test(valor);
  const tieneBasura = valor.includes('\uFFFD');
  const pareceTituloCorto = !multilinea && /T[ií]tulo\s*:/i.test(valor);

  if (!tieneBasura && !pareceTituloCorto) {
    return valor;
  }

  let texto = valor;
  if (tieneBasura) {
    for (const [patron, reemplazo] of REEMPLAZOS) {
      texto = texto.replace(patron, reemplazo);
    }
  }

  // Prefijo "Título:" solo en valores cortos de un campo, no en documentos enteros.
  if (pareceTituloCorto) {
    texto = texto.replace(/^\s*Título\s*:\s*/i, '');
    texto = texto.replace(/\bTítulo\s*:\s*/gi, '');
  }

  // Compactar espacios horizontales sin destruir saltos de línea (import TXT/PDF).
  if (multilinea) {
    texto = texto.replace(/[^\S\r\n]{2,}/g, ' ').replace(/\r\n/g, '\n').trim() || valor.trim();
  } else {
    texto = texto.replace(/\s{2,}/g, ' ').trim() || valor.trim();
  }

  // ¿ suelto al inicio si quedó C/Q tras perder el signo.
  if (/^[CQcq]/.test(texto) && /\?$/.test(texto) && !texto.startsWith('¿')) {
    if (/^(Cómo|Cuál|Qué|como|cuál|qué)\b/.test(texto)) {
      texto = `¿${texto}`;
    }
  }

  return texto;
}

export function repararObjetoUtf8(obj, claves = null) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => repararObjetoUtf8(item, claves));
  }
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && (!claves || claves.includes(k))) {
      out[k] = repararTextoUtf8(v);
    } else if (v && typeof v === 'object') {
      out[k] = repararObjetoUtf8(v, claves);
    }
  }
  return out;
}
