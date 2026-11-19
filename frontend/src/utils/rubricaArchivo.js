/**
 * Importar / exportar rúbricas (JSON o CSV) para el docente.
 */

export const PLANTILLA_RUBRICA_JSON = {
  nombre: 'Evaluación de intervención',
  descripcion: 'Plantilla de rúbrica para casos situacionales de Lumina',
  criterios: [
    {
      nombre: 'Escucha y contraste de versiones',
      ponderacion: 40,
      puntajeMaximo: 4,
      niveles: [
        { nombre: 'Básico', descripcion: 'Escucha una sola versión.', puntaje: 1, orden: 1 },
        { nombre: 'Medio', descripcion: 'Contrasta al menos dos relatos.', puntaje: 2, orden: 2 },
        { nombre: 'Avanzado', descripcion: 'Integra versiones y propone ruta ética.', puntaje: 4, orden: 3 }
      ]
    },
    {
      nombre: 'Intervención ética',
      ponderacion: 60,
      puntajeMaximo: 4,
      niveles: [
        { nombre: 'Básico', descripcion: 'Identifica el conflicto.', puntaje: 1, orden: 1 },
        { nombre: 'Medio', descripcion: 'Propone una acción respetuosa.', puntaje: 2, orden: 2 },
        { nombre: 'Avanzado', descripcion: 'Media y remite con claridad.', puntaje: 4, orden: 3 }
      ]
    }
  ]
};

function normalizarCriterio(c, indice = 0) {
  const nivelesRaw = Array.isArray(c?.niveles) ? c.niveles : [];
  const niveles = nivelesRaw.map((n, ni) => ({
    nombre: String(n?.nombre || `Nivel ${ni + 1}`).trim(),
    descripcion: String(n?.descripcion || '').trim(),
    puntaje: Number(n?.puntaje) || 1,
    orden: Number(n?.orden) || ni + 1
  }));
  if (niveles.length === 0) {
    niveles.push(
      { nombre: 'Básico', descripcion: 'Desempeño inicial.', puntaje: 1, orden: 1 },
      { nombre: 'Avanzado', descripcion: 'Desempeño alto.', puntaje: 4, orden: 2 }
    );
  }
  return {
    nombre: String(c?.nombre || `Criterio ${indice + 1}`).trim(),
    ponderacion: Number(c?.ponderacion) || 0,
    puntajeMaximo: Number(c?.puntajeMaximo) || 4,
    niveles
  };
}

export function parseRubricaJson(texto) {
  const data = JSON.parse(texto);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El JSON debe ser un objeto con nombre y criterios.');
  }
  const criteriosSrc = Array.isArray(data.criterios) ? data.criterios : [];
  if (!criteriosSrc.length) {
    throw new Error('La rúbrica debe traer al menos un criterio.');
  }
  return {
    nombre: String(data.nombre || 'Rúbrica importada').trim(),
    descripcion: String(data.descripcion || '').trim(),
    criterios: criteriosSrc.map((c, i) => normalizarCriterio(c, i))
  };
}

/**
 * CSV esperado (cabecera):
 * nombre_criterio,ponderacion,puntaje_maximo,nivel_nombre,nivel_descripcion,nivel_puntaje,nivel_orden
 */
export function parseRubricaCsv(texto) {
  const lineas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length < 2) {
    throw new Error('El CSV está vacío o no tiene filas de datos.');
  }

  const sep = lineas[0].includes(';') ? ';' : ',';
  const filas = lineas.slice(1).map((linea) => linea.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  const mapa = new Map();

  for (const cols of filas) {
    const [
      nombreCriterio,
      ponderacion,
      puntajeMaximo,
      nivelNombre,
      nivelDescripcion,
      nivelPuntaje,
      nivelOrden
    ] = cols;
    if (!nombreCriterio) continue;
    const key = nombreCriterio.toLocaleLowerCase('es');
    if (!mapa.has(key)) {
      mapa.set(key, {
        nombre: nombreCriterio,
        ponderacion: Number(ponderacion) || 0,
        puntajeMaximo: Number(puntajeMaximo) || 4,
        niveles: []
      });
    }
    const criterio = mapa.get(key);
    criterio.niveles.push({
      nombre: nivelNombre || `Nivel ${criterio.niveles.length + 1}`,
      descripcion: nivelDescripcion || '',
      puntaje: Number(nivelPuntaje) || 1,
      orden: Number(nivelOrden) || criterio.niveles.length + 1
    });
  }

  const criterios = [...mapa.values()].map((c, i) => normalizarCriterio(c, i));
  if (!criterios.length) {
    throw new Error('No se pudieron leer criterios desde el CSV.');
  }

  return {
    nombre: 'Rúbrica importada (CSV)',
    descripcion: 'Importada desde archivo CSV',
    criterios
  };
}

export async function leerArchivoRubrica(file) {
  if (!file) throw new Error('Selecciona un archivo.');
  const nombre = String(file.name || '').toLowerCase();
  const texto = await file.text();
  if (nombre.endsWith('.json')) return parseRubricaJson(texto);
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) return parseRubricaCsv(texto);
  // Intento JSON y luego CSV
  try {
    return parseRubricaJson(texto);
  } catch {
    return parseRubricaCsv(texto);
  }
}

export function descargarRubricaJson(rubrica, nombreArchivo = 'rubrica-lumina.json') {
  const blob = new Blob([JSON.stringify(rubrica, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function descargarPlantillaRubrica() {
  descargarRubricaJson(PLANTILLA_RUBRICA_JSON, 'plantilla-rubrica-lumina.json');
}

export function descargarPlantillaRubricaCsv() {
  const filas = [
    'nombre_criterio,ponderacion,puntaje_maximo,nivel_nombre,nivel_descripcion,nivel_puntaje,nivel_orden'
  ];
  for (const c of PLANTILLA_RUBRICA_JSON.criterios) {
    for (const n of c.niveles) {
      filas.push(
        [
          c.nombre,
          c.ponderacion,
          c.puntajeMaximo,
          n.nombre,
          `"${String(n.descripcion).replace(/"/g, '""')}"`,
          n.puntaje,
          n.orden
        ].join(',')
      );
    }
  }
  const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-rubrica-lumina.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Cálculo local de evaluación (espejo simplificado del backend). */
export function calcularResultadoSimulacion({ caso, respuestas = [] }) {
  const preguntas = [];
  for (const escena of caso?.escenas || []) {
    for (const d of escena.decisiones || []) {
      const correcta = (d.opciones || []).find((o) => o.esCorrecta);
      preguntas.push({
        decisionId: d.id,
        pregunta: d.pregunta,
        opcionCorrectaId: correcta?.id ?? null
      });
    }
  }

  const total = preguntas.length;
  const mapaResp = new Map(respuestas.map((r) => [Number(r.decisionId), r]));
  let correctas = 0;
  let respondidas = 0;
  for (const p of preguntas) {
    const r = mapaResp.get(Number(p.decisionId));
    if (!r) continue;
    respondidas += 1;
    if (r.esCorrecta || (p.opcionCorrectaId != null && Number(r.opcionId) === Number(p.opcionCorrectaId))) {
      correctas += 1;
    }
  }

  const fraccion = total === 0 ? 0 : correctas / total;
  const criterios = (caso?.rubrica?.criterios || []).map((c) => ({
    nombre: c.nombre,
    ponderacion: Number(c.ponderacion) || 0,
    puntajeMaximo: Number(c.puntajeMaximo) || 0,
    puntuacion: Math.round(Number(c.puntajeMaximo || 0) * fraccion * 100) / 100
  }));

  const resultado =
    criterios.length === 0
      ? Math.round(fraccion * 5 * 100) / 100
      : Math.round(
          criterios.reduce((suma, c) => suma + c.puntuacion * (c.ponderacion / 100), 0) * 100
        ) / 100;

  return {
    correctas,
    total,
    respondidas,
    fraccion,
    resultado,
    criterios,
    rubricaNombre: caso?.rubrica?.nombre || null,
    retroalimentacion:
      total === 0
        ? 'El caso no tiene preguntas para evaluar.'
        : respondidas < total
          ? `Intento incompleto: ${correctas} aciertos de ${total}. Las no respondidas cuentan como cero.`
          : `${correctas} aciertos de ${total} preguntas.`
  };
}
