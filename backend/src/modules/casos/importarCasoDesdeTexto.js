import { repararTextoUtf8 } from '../../utils/textoUtf8.js';

const OPCIONES_DEFAULT = [
  {
    texto: 'Escucha a las partes y media con claridad',
    esCorrecta: true,
    consecuencia: null,
    orden: 1,
    explicacion: 'Contiene el conflicto y modela escucha activa.',
    fundamentoTeorico: 'Mediación / psicología social'
  },
  {
    texto: 'Ignora la tensión y prioriza solo el resultado',
    esCorrecta: false,
    consecuencia: null,
    orden: 2,
    explicacion: 'Evita el conflicto y puede escalar el daño.',
    fundamentoTeorico: null
  }
];

/**
 * Convierte texto extraído de un PDF/Word en un borrador listo para construirCaso.
 * Heurística local (sin OpenAI): título, contexto, escenas y personajes por patrones.
 * Soporta varias preguntas por escena: "Pregunta 1:", "Pregunta 2:", etc.
 */
export function importarCasoDesdeTexto(texto, { creadorId } = {}) {
  const bruto = repararTextoUtf8(
    typeof texto === 'string'
      ? texto.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
      : ''
  );
  if (!bruto || bruto.length < 40) {
    const error = new Error('El PDF/texto es demasiado corto para armar un caso.');
    error.statusCode = 400;
    throw error;
  }

  const lineas = bruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tituloCrudo =
    capturarCampo(bruto, /(?:^|\r?\n)\s*(?:t[\uFFFD]?[ií]?tulo|titulo)\s*[:\-]\s*(.+)/i) ||
    capturarCampo(bruto, /(?:^|\r?\n)\s*caso\s*[:\-]\s*(.+)/i) ||
    lineas[0].slice(0, 180);
  const titulo = repararTextoUtf8(tituloCrudo);

  const desarrollo =
    capturarBloque(bruto, /desarrollo(?:\s+situacional)?\s*[:\-]/i) ||
    capturarBloque(bruto, /situaci[oó]n\s*[:\-]/i) ||
    lineas.slice(1, 8).join(' ').slice(0, 2500) ||
    'Situación académica importada desde documento.';

  const contexto =
    capturarBloque(bruto, /contexto(?:\s+(?:o\s+)?historia)?\s*[:\-]/i) ||
    capturarBloque(bruto, /objetivo(?:s)?\s*[:\-]/i) ||
    lineas.slice(8, 14).join(' ').slice(0, 2000) ||
    'Contexto institucional del caso.';

  const nombresPersonajes = extraerPersonajes(bruto);
  const personajes = nombresPersonajes.map((nombre) => ({
    nombre,
    rolSocial: 'Participante',
    perfil: `Figura del caso: ${nombre}.`,
    pautasComportamiento: 'Responde según el rol descrito en el documento.'
  }));

  if (personajes.length === 0) {
    personajes.push(
      {
        nombre: 'Ana',
        rolSocial: 'Estudiante',
        perfil: 'Protagonista sugerida a partir del documento.',
        pautasComportamiento: 'Expresa su versión del conflicto.'
      },
      {
        nombre: 'Luis',
        rolSocial: 'Docente / mediador',
        perfil: 'Interviene para contener la situación.',
        pautasComportamiento: 'Escucha y propone alternativas.'
      }
    );
  }

  const bloquesEscena = extraerEscenas(bruto, lineas);
  const nombresPj = personajes.map((p) => p.nombre);

  const escenas = bloquesEscena.map((bloque, indice) => {
    const listaPreguntas =
      Array.isArray(bloque.preguntas) && bloque.preguntas.length
        ? bloque.preguntas
        : [
            {
              texto: bloque.pregunta || `¿Qué intervención conviene en: ${bloque.nombre}?`,
              correcta: null,
              incorrecta: null
            }
          ];

    return {
      nombre: bloque.nombre.slice(0, 120),
      contexto: bloque.contexto.slice(0, 2000),
      orden: indice + 1,
      esFinal: indice === bloquesEscena.length - 1,
      personajes: nombresPj.slice(0, Math.min(3, nombresPj.length)),
      decisiones: listaPreguntas.slice(0, 12).map((p, pi) => ({
        pregunta: String(p.texto || '').slice(0, 500),
        orden: pi + 1,
        ayuda: null,
        opciones: armarOpciones(p)
      }))
    };
  });

  const rubrica = {
    nombre: `Rúbrica - ${titulo}`.slice(0, 150),
    descripcion: 'Generada automáticamente desde el documento importado. Nota oficial sobre 5.',
    criterios: [
      {
        nombre: 'Intervención ética',
        descripcion: 'Evalúa contención, escucha y criterio profesional.',
        ponderacion: 100,
        puntajeMaximo: 5,
        niveles: [
          { nombre: 'Básico', descripcion: 'Identifica el conflicto.', puntaje: 1, orden: 1 },
          { nombre: 'Avanzado', descripcion: 'Media y propone ruta clara.', puntaje: 5, orden: 2 }
        ]
      }
    ]
  };

  return {
    creadorId,
    titulo: repararTextoUtf8(titulo).slice(0, 200),
    desarrolloSituacional: repararTextoUtf8(desarrollo),
    contextoHistoria: repararTextoUtf8(contexto),
    tiempoEstimadoSegundos: 1800,
    personajes,
    escenas: escenas.map((e) => ({
      ...e,
      nombre: repararTextoUtf8(e.nombre),
      contexto: repararTextoUtf8(e.contexto),
      decisiones: (e.decisiones || []).map((d) => ({
        ...d,
        pregunta: repararTextoUtf8(d.pregunta),
        ayuda: repararTextoUtf8(d.ayuda),
        opciones: (d.opciones || []).map((o) => ({
          ...o,
          texto: repararTextoUtf8(o.texto),
          explicacion: repararTextoUtf8(o.explicacion)
        }))
      }))
    })),
    rubrica: {
      ...rubrica,
      nombre: repararTextoUtf8(rubrica.nombre)
    },
    metaImportacion: {
      personajesDetectados: personajes.length,
      escenasDetectadas: escenas.length,
      preguntasDetectadas: escenas.reduce((n, e) => n + (e.decisiones?.length || 0), 0),
      caracteresTexto: bruto.length
    }
  };
}

function armarOpciones(pregunta) {
  const correcta = String(pregunta?.correcta || '').trim();
  const incorrecta = String(pregunta?.incorrecta || '').trim();
  if (correcta || incorrecta) {
    return [
      {
        texto: (correcta || 'Interviene con escucha y mediación ética').slice(0, 400),
        esCorrecta: true,
        consecuencia: null,
        orden: 1,
        explicacion: 'Respuesta alineada con contención, ética y límites de rol.',
        fundamentoTeorico: 'Mediación / psicología social'
      },
      {
        texto: (incorrecta || 'Ignora el conflicto o actúa fuera de rol').slice(0, 400),
        esCorrecta: false,
        consecuencia: null,
        orden: 2,
        explicacion: 'Respuesta que escala el daño o vulnera límites.',
        fundamentoTeorico: null
      }
    ];
  }
  return OPCIONES_DEFAULT.map((o) => ({ ...o }));
}

function capturarCampo(texto, regex) {
  const m = texto.match(regex);
  return m?.[1]?.trim().split(/\r?\n/)[0]?.trim() || null;
}

function capturarBloque(texto, regexInicio) {
  const m = texto.match(regexInicio);
  if (!m) return null;
  const desde = m.index + m[0].length;
  const resto = texto.slice(desde);
  const corte = resto.search(/\r?\n\s*(?:escena|personaje|pregunta|r[uú]brica|objetivo|t[ií]tulo)\b/i);
  const bloque = (corte >= 0 ? resto.slice(0, corte) : resto.slice(0, 1200)).trim();
  return bloque || null;
}

function extraerPersonajes(texto) {
  const nombres = new Set();
  const seccion = capturarBloque(texto, /personajes?\s*[:\-]/i);
  const fuente = seccion || texto;
  const lineasFuente = fuente.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const linea of lineasFuente) {
    if (nombres.size >= 8) break;
    const conViñeta = linea.match(/^[-•*]\s*(.+)$/);
    const candidato = (conViñeta?.[1] || linea)
      .split(/[—:,]/)[0]
      .trim();
    const nombre = candidato.match(
      /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){0,2})$/
    )?.[1];
    if (
      nombre &&
      !/^(Escena|Caso|Título|Titulo|Contexto|Desarrollo|Objetivo|Pregunta|Rúbrica|Rubrica)$/i.test(
        nombre
      )
    ) {
      nombres.add(nombre.split(/\s+/).slice(0, 2).join(' '));
    }
  }
  return [...nombres];
}

function extraerPreguntasDeBloque(bloque) {
  const preguntas = [];
  const regex = /(?:^|\n)\s*pregunta\s*(\d+)?\s*[:\-]\s*(.+)/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(bloque))) {
    matches.push({
      index: match.index,
      texto: match[2].trim().split(/\n/)[0].trim()
    });
  }

  for (let i = 0; i < matches.length; i += 1) {
    const ini = matches[i].index;
    const fin = i + 1 < matches.length ? matches[i + 1].index : bloque.length;
    const trozo = bloque.slice(ini, fin);
    const correcta = trozo.match(/\n\s*correcta\s*[:\-]\s*(.+)/i)?.[1]?.trim().split(/\n/)[0] || null;
    const incorrecta = trozo.match(/\n\s*incorrecta\s*[:\-]\s*(.+)/i)?.[1]?.trim().split(/\n/)[0] || null;
    if (matches[i].texto) {
      preguntas.push({
        texto: matches[i].texto,
        correcta,
        incorrecta
      });
    }
  }
  return preguntas;
}

function extraerEscenas(texto, lineas) {
  const escenas = [];
  const regex = /(?:^|\r?\n)\s*(?:escena|lugar|escenario)\s*(\d+)?\s*[:.\-]?\s*(.+)?/gi;
  let match;
  const indices = [];
  while ((match = regex.exec(texto))) {
    indices.push({
      index: match.index,
      nombre: (match[2] || `Escena ${match[1] || escenas.length + 1}`).trim().slice(0, 80)
    });
  }

  if (indices.length === 0) {
    return [
      {
        nombre: 'Escena inicial',
        contexto: lineas.slice(0, 12).join(' ').slice(0, 1800),
        pregunta: null,
        preguntas: []
      },
      {
        nombre: 'Cierre',
        contexto: 'El estudiante debe decidir cómo cerrar la intervención.',
        pregunta: '¿Cómo cierras la intervención de forma ética?',
        preguntas: [{ texto: '¿Cómo cierras la intervención de forma ética?', correcta: null, incorrecta: null }]
      }
    ];
  }

  for (let i = 0; i < indices.length; i += 1) {
    const ini = indices[i].index;
    const fin = i + 1 < indices.length ? indices[i + 1].index : texto.length;
    const bloque = texto.slice(ini, fin).trim();
    const preguntas = extraerPreguntasDeBloque(bloque);
    const contexto = bloque
      .replace(/^escena[^\n\r]*/i, '')
      .replace(/(?:\n\s*pregunta\s*\d*\s*[:\-][\s\S]*)/i, '')
      .trim()
      .slice(0, 2000) || 'Contexto de la escena.';

    escenas.push({
      nombre: indices[i].nombre || `Escena ${i + 1}`,
      contexto,
      pregunta: preguntas[0]?.texto || null,
      preguntas
    });
  }

  return escenas.slice(0, 20);
}
