/**
 * Asistente de IA para docentes que crean casos situacionales.
 * Usa OpenAI si hay OPENAI_API_KEY; si no, un generador local de práctica.
 * Respeta cantidades pedidas en el prompt (p. ej. 6 involucrados, 4 escenas).
 */

const BANCO_NOMBRES = [
  'Lucía', 'Pedro', 'Sofía', 'Elena', 'Andrés', 'Valeria', 'Marta', 'Diego',
  'Camila', 'Nina', 'Bruno', 'Hugo', 'Gina', 'Félix', 'Ana', 'Tomás'
];

const LUGARES_EXTRA = [
  'Calle del barrio',
  'Recepción de la comisaría',
  'Sala de espera del hospital',
  'Orientación escolar',
  'Sede de la ONG',
  'Oficina laboral',
  'Plaza principal',
  'Café del barrio',
  'Sala de la casa',
  'Parque comunitario'
];

const PLANTILLAS = [
  {
    claves: ['barrio', 'vecino', 'convivencia', 'ruido', 'conjunto'],
    escenarioSugerido: 'Calle del barrio',
    personajesSugeridos: ['Lucía', 'Pedro', 'Sofía', 'Elena', 'Diego', 'Camila'],
    armar: (idea) =>
      baseCaso(idea, {
        titulo: idea.titulo || 'Conflicto de convivencia en el barrio',
        desarrolloSituacional:
          idea.detalle ||
          'Dos familias del mismo sector llevan semanas en tensión por ruido, uso del espacio común y acusaciones cruzadas. Vecinos piden mediación antes de escalar la denuncia.',
        contextoHistoria:
          'El estudiante en práctica llega al barrio para indagar con respeto, contrastar versiones y orientar una ruta de diálogo o remisión institucional.',
        tiempoEstimadoSegundos: 900,
        pregunta: '¿Cuál es la mejor primera intervención en este conflicto vecinal?',
        opcionBuena: 'Escuchar a ambas partes por separado y proponer una mediación con reglas claras',
        opcionMala: 'Tomar partido por quien habla primero y confrontar a la otra familia en público',
        explicacionBuena: 'La escucha equilibrada reduce la escalada y abre espacio de acuerdo.',
        explicacionMala: 'Tomar partido refuerza la polarización y pierde legitimidad.',
        escenarioSugerido: 'Calle del barrio'
      })
  },
  {
    claves: ['comisaría', 'denuncia', 'policía', 'agente', 'violencia'],
    escenarioSugerido: 'Recepción de la comisaría',
    personajesSugeridos: ['Andrés', 'Sofía', 'Valeria', 'Elena', 'Bruno', 'Ana'],
    armar: (idea) =>
      baseCaso(idea, {
        titulo: idea.titulo || 'Acompañamiento en la comisaría',
        desarrolloSituacional:
          idea.detalle ||
          'Una persona llega a denunciar una situación de conflicto familiar. Está nerviosa, confunde fechas y teme represalias. El agente pide datos concretos para abrir el registro.',
        contextoHistoria:
          'El estudiante debe practicar orientación ética: acompañar sin reemplazar a la autoridad, validar la emoción y ayudar a ordenar la narrativa.',
        tiempoEstimadoSegundos: 780,
        pregunta: '¿Qué conviene hacer primero en la recepción de la comisaría?',
        opcionBuena: 'Acompañar con calma, ayudar a organizar los hechos y respetar el procedimiento del agente',
        opcionMala: 'Presionar al agente para que actúe sin registrar la denuncia formal',
        explicacionBuena: 'Ordenar hechos y respetar el procedimiento protege a la persona y al proceso.',
        explicacionMala: 'Saltar el procedimiento genera riesgo jurídico y de revictimización.',
        escenarioSugerido: 'Recepción de la comisaría'
      })
  },
  {
    claves: ['hospital', 'salud', 'enfermera', 'paciente', 'urgencia'],
    escenarioSugerido: 'Sala de espera del hospital',
    personajesSugeridos: ['Marta', 'Sofía', 'Diego', 'Elena', 'Hugo', 'Gina'],
    armar: (idea) =>
      baseCaso(idea, {
        titulo: idea.titulo || 'Orientación en sala de espera hospitalaria',
        desarrolloSituacional:
          idea.detalle ||
          'Una familia espera noticias de un adolescente hospitalizado tras un episodio de crisis. Hay rumores, poca información clara y tensión entre cuidadores.',
        contextoHistoria:
          'El estudiante practica contención, privacidad y remisión al personal de salud y a redes de apoyo, sin diagnosticar.',
        tiempoEstimadoSegundos: 840,
        pregunta: '¿Qué intervención es más adecuada en la sala de espera?',
        opcionBuena: 'Contener emocionalmente, proteger la privacidad y coordinar con el personal de salud',
        opcionMala: 'Dar un diagnóstico propio y discutir el caso en voz alta frente a otras familias',
        explicacionBuena: 'La contención ética y la coordinación protegen dignidad y continuidad del cuidado.',
        explicacionMala: 'Diagnosticar o exponer datos viola privacidad y puede agravar la crisis.',
        escenarioSugerido: 'Sala de espera del hospital'
      })
  },
  {
    claves: ['colegio', 'escuela', 'docente', 'estudiante', 'aula', 'bullying', 'acoso'],
    escenarioSugerido: 'Orientación escolar',
    personajesSugeridos: ['Camila', 'Nina', 'Diego', 'Sofía', 'Pedro', 'Valeria'],
    armar: (idea) =>
      baseCaso(idea, {
        titulo: idea.titulo || 'Conflicto escolar entre estudiantes',
        desarrolloSituacional:
          idea.detalle ||
          'En el colegio se reporta exclusión y rumores contra un estudiante. Hay versiones distintas entre docentes, compañeros y la familia. Orientación pide apoyo para indagar sin estigmatizar.',
        contextoHistoria:
          'El estudiante en práctica debe contrastar relatos, cuidar el secreto profesional y proponer una ruta restaurativa con el colegio.',
        tiempoEstimadoSegundos: 900,
        pregunta: '¿Cuál es el mejor primer paso en el colegio?',
        opcionBuena: 'Escuchar por separado a las partes, registrar hechos observables y acordar un plan con orientación',
        opcionMala: 'Confrontar públicamente a los involucrados en el patio para “aclarar todo”',
        explicacionBuena: 'La indagación privada y planificada reduce daño y favorece reparación.',
        explicacionMala: 'La confrontación pública aumenta estigma y riesgo de escalada.',
        escenarioSugerido: 'Orientación escolar'
      })
  },
  {
    claves: ['trabajo', 'oficina', 'laboral', 'jefe', 'empresa'],
    escenarioSugerido: 'Oficina laboral',
    personajesSugeridos: ['Elena', 'Valeria', 'Camila', 'Pedro', 'Andrés', 'Marta'],
    armar: (idea) =>
      baseCaso(idea, {
        titulo: idea.titulo || 'Tensión laboral y mediación',
        desarrolloSituacional:
          idea.detalle ||
          'En un equipo de trabajo hay quejas por trato desigual, sobrecarga y rumores. Talento humano solicita una lectura psicosocial antes de una mediación formal.',
        contextoHistoria:
          'El estudiante practica escucha laboral, límites del rol y propuestas de mediación sin asumir funciones de sanción.',
        tiempoEstimadoSegundos: 720,
        pregunta: '¿Qué conviene priorizar en la primera entrevista laboral?',
        opcionBuena: 'Explorar hechos, impacto emocional y posibles acuerdos con reglas de respeto',
        opcionMala: 'Amenazar con reportes sin escuchar ni documentar la situación',
        explicacionBuena: 'Explorar con método abre opciones de acuerdo sostenibles.',
        explicacionMala: 'Amenazar sin escucha cierra el diálogo y aumenta la desconfianza.',
        escenarioSugerido: 'Oficina laboral'
      })
  },
  {
    claves: ['ong', 'comunidad', 'voluntariado', 'remisión', 'apoyo'],
    escenarioSugerido: 'Sede de la ONG',
    personajesSugeridos: ['Elena', 'Lucía', 'Sofía', 'Valeria', 'Diego', 'Camila'],
    armar: (idea) =>
      baseCaso(idea, {
        titulo: idea.titulo || 'Remisión y apoyo en la ONG comunitaria',
        desarrolloSituacional:
          idea.detalle ||
          'Una persona llega a la ONG buscando orientación por un conflicto que ya pasó por barrio y comisaría. Necesita claridad sobre rutas de atención y acompañamiento.',
        contextoHistoria:
          'El estudiante articula redes, explica límites institucionales y evita promesas que no puede cumplir.',
        tiempoEstimadoSegundos: 780,
        pregunta: '¿Qué debe hacer el estudiante en la sede de la ONG?',
        opcionBuena: 'Clarificar necesidades, explicar rutas reales de apoyo y acordar un seguimiento',
        opcionMala: 'Prometer una solución inmediata sin consultar a la gestora ni a la red',
        explicacionBuena: 'Claridad y seguimiento construyen confianza institucional.',
        explicacionMala: 'Promesas irreales generan frustración y abandono del proceso.',
        escenarioSugerido: 'Sede de la ONG'
      })
  }
];

const PLANTILLA_DEFAULT = {
  escenarioSugerido: 'Plaza principal',
  personajesSugeridos: ['Valeria', 'Elena', 'Lucía', 'Diego', 'Camila', 'Sofía'],
  armar: (idea) =>
    baseCaso(idea, {
      titulo: idea.titulo || 'Caso situacional de intervención social',
      desarrolloSituacional:
        idea.detalle ||
        'Se presenta una situación de tensión interpersonal en un espacio cotidiano. Hay versiones parciales, emociones intensas y necesidad de una intervención ética.',
      contextoHistoria:
        'El estudiante debe observar, preguntar con respeto, contrastar información y proponer una ruta de acción cuidadosa.',
      tiempoEstimadoSegundos: 800,
      pregunta: '¿Cuál es la intervención más adecuada en este momento?',
      opcionBuena: 'Escuchar, contrastar versiones y proponer un siguiente paso claro y ético',
      opcionMala: 'Imponer una conclusión rápida sin escuchar a las personas involucradas',
      explicacionBuena: 'La escucha y el contraste de versiones sostienen una intervención responsable.',
      explicacionMala: 'Concluir sin escucha aumenta el error y el daño relacional.',
      escenarioSugerido: 'Plaza principal'
    })
};

/** Extrae cantidades pedidas en el prompt del docente. */
export function parsearCantidadesPrompt(prompt) {
  const texto = String(prompt || '');
  const norm = texto
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  let personajes = null;
  let escenas = null;

  const rePj = /(\d{1,2})\s*(?:involucrad\w*|personajes?|actores?|participantes?|personas?)/i;
  const reEsc = /(\d{1,2})\s*(?:escenas?|lugares?|escenarios?|escenas\s+distintas?)/i;
  const rePjAlt = /(?:involucrad\w*|personajes?|actores?|participantes?)\s*(?:son|:)?\s*(\d{1,2})/i;
  const reEscAlt = /(?:escenas?|lugares?|escenarios?)\s*(?:son|:)?\s*(\d{1,2})/i;

  const mPj = norm.match(rePj) || norm.match(rePjAlt);
  const mEsc = norm.match(reEsc) || norm.match(reEscAlt);
  if (mPj) personajes = Number(mPj[1]);
  if (mEsc) escenas = Number(mEsc[1]);

  return {
    personajes: Number.isFinite(personajes) ? Math.min(12, Math.max(2, personajes)) : null,
    escenas: Number.isFinite(escenas) ? Math.min(12, Math.max(2, escenas)) : null
  };
}

function completarNombres(base = [], cantidad = 4) {
  const out = [];
  const usados = new Set();
  for (const n of [...base, ...BANCO_NOMBRES]) {
    const nombre = String(n || '').trim();
    if (!nombre || usados.has(nombre.toLocaleLowerCase('es'))) continue;
    usados.add(nombre.toLocaleLowerCase('es'));
    out.push(nombre);
    if (out.length >= cantidad) break;
  }
  while (out.length < cantidad) {
    out.push(`Persona ${out.length + 1}`);
  }
  return out.slice(0, cantidad);
}

function baseCaso(idea, base) {
  return { ...base };
}

function armarEscenas(base, cantidadEscenas, escenarioPrincipal) {
  const n = Math.min(12, Math.max(2, Number(cantidadEscenas) || 2));
  const principal = escenarioPrincipal || base.escenarioSugerido || 'Plaza principal';
  const lugares = [principal, ...LUGARES_EXTRA.filter((l) => l !== principal)];

  const escenas = [];
  for (let i = 0; i < n; i += 1) {
    const lugar = lugares[i % lugares.length];
    if (i === 0) {
      escenas.push({
        nombre: lugar,
        contexto: base.contextoHistoria,
        pregunta: base.pregunta,
        opcionBuena: base.opcionBuena,
        opcionMala: base.opcionMala,
        explicacionBuena: base.explicacionBuena,
        explicacionMala: base.explicacionMala
      });
      continue;
    }
    escenas.push({
      nombre: lugar,
      contexto: `Punto ${i + 1} del recorrido para contrastar lo escuchado en ${principal}.`,
      pregunta:
        i === 1
          ? '¿Qué conviene hacer después de contrastar esta nueva versión?'
          : `En ${lugar}, ¿cuál es la intervención más ética ahora?`,
      opcionBuena: 'Integrar lo nuevo con lo anterior y proponer un siguiente paso ético',
      opcionMala: 'Actuar solo con este relato e ignorar el resto de la historia',
      explicacionBuena: 'Contrastar e integrar evita decisiones parciales.',
      explicacionMala: 'Ignorar lo previo debilita el análisis situacional.'
    });
  }
  return escenas;
}

function conCantidades(base, { personajes, escenas }, plantillaNombres = []) {
  const cantPj = personajes || Math.max(4, plantillaNombres.length || 4);
  const cantEsc = escenas || 4;
  const nombres = completarNombres(
    [...(Array.isArray(base.personajesSugeridos) ? base.personajesSugeridos : []), ...plantillaNombres],
    cantPj
  );
  const listaEscenas = Array.isArray(base.escenasSugeridas) && base.escenasSugeridas.length >= cantEsc
    ? base.escenasSugeridas.slice(0, cantEsc)
    : armarEscenas(base, cantEsc, base.escenarioSugerido);

  return {
    ...base,
    personajesSugeridos: nombres,
    escenaSugerida: listaEscenas[0],
    escenasSugeridas: listaEscenas,
    rubricaSugerida: base.rubricaSugerida || {
      nombre: `Evaluación - ${base.titulo}`,
      criterios: [
        {
          nombre: 'Intervención ética',
          ponderacion: 100,
          puntajeMaximo: 4,
          niveles: [
            { nombre: 'Básico', descripcion: 'Identifica el conflicto y escucha.', puntaje: 1, orden: 1 },
            { nombre: 'Avanzado', descripcion: 'Media, contrasta versiones y propone ruta clara.', puntaje: 4, orden: 2 }
          ]
        }
      ]
    }
  };
}

function normalizarTexto(valor) {
  return String(valor || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function elegirPlantilla(prompt) {
  const texto = normalizarTexto(prompt);
  for (const plantilla of PLANTILLAS) {
    if (plantilla.claves.some((clave) => texto.includes(normalizarTexto(clave)))) {
      return plantilla;
    }
  }
  return PLANTILLA_DEFAULT;
}

function extraerTitulo(prompt) {
  const limpio = String(prompt || '').trim();
  if (!limpio) return '';
  const primera = limpio.split(/[.!?\n]/)[0].trim();
  if (primera.length >= 12 && primera.length <= 120) return primera;
  return limpio.slice(0, 90);
}

function generarLocal({ prompt, nivel, lugar, cantidades }) {
  const idea = {
    titulo: extraerTitulo(prompt),
    detalle: [prompt, lugar ? `Lugar sugerido: ${lugar}.` : '', nivel ? `Nivel: ${nivel}.` : '']
      .filter(Boolean)
      .join(' ')
  };
  const plantilla = elegirPlantilla(`${prompt} ${lugar || ''}`);
  const base = plantilla.armar(idea);
  const escenarioSugerido = lugar?.trim() || plantilla.escenarioSugerido || base.escenarioSugerido;
  const conEscenario = {
    ...base,
    escenarioSugerido,
    personajesSugeridos: plantilla.personajesSugeridos
  };
  const completo = conCantidades(conEscenario, cantidades, plantilla.personajesSugeridos);
  return {
    ...completo,
    fuente: 'asistente-local',
    tipDocente:
      `Revisa el borrador: ${completo.personajesSugeridos.length} involucrados y ${completo.escenasSugeridas.length} escenas. Ajusta nombres y crea el caso.`
  };
}

async function generarConOpenAI({ prompt, nivel, lugar, cantidades }) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const modelo = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const cantPj = cantidades.personajes || 6;
  const cantEsc = cantidades.escenas || 4;

  const sistema = `Eres asistente pedagógico de Lumina, simulador de psicología social para docentes universitarios en Colombia.
Generas borradores de casos situacionales para práctica (comisaría, hospital, barrio, colegio, ONG, trabajo).
Responde SOLO JSON válido con estas claves:
titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos (número 480-1200),
escenarioSugerido (lugar concreto),
personajesSugeridos (array con EXACTAMENTE ${cantPj} nombres distintos),
escenasSugeridas (array con EXACTAMENTE ${cantEsc} objetos; cada uno: nombre, contexto, pregunta, opcionBuena, opcionMala, explicacionBuena, explicacionMala),
tipDocente.
OBLIGATORIO: personajesSugeridos.length === ${cantPj} y escenasSugeridas.length === ${cantEsc}.
Cada escena debe ser un lugar/momento distinto del recorrido del caso.
Tono claro, ético, no sensacionalista, útil para intervención social.`;

  const usuario = `Idea del docente: ${prompt}
Nivel: ${nivel || 'pregrado'}
Lugar preferido: ${lugar || 'el que mejor encaje'}
Cantidad EXACTA de involucrados/personajes: ${cantPj}
Cantidad EXACTA de escenas: ${cantEsc}`;

  const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelo,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario }
      ]
    })
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    const error = new Error('No se pudo consultar el modelo de IA externo.');
    error.statusCode = 502;
    error.codigo = 'IA_EXTERNA';
    error.detalle = detalle.slice(0, 300);
    throw error;
  }

  const payload = await respuesta.json();
  const texto = payload?.choices?.[0]?.message?.content || '{}';
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    return null;
  }

  const escenarioSugerido = String(data.escenarioSugerido || lugar || 'Plaza principal');
  const escenasIa = Array.isArray(data.escenasSugeridas)
    ? data.escenasSugeridas.map((e, i) => ({
        nombre: String(e?.nombre || `Escena ${i + 1}`).slice(0, 120),
        contexto: String(e?.contexto || data.contextoHistoria || ''),
        pregunta: String(e?.pregunta || ''),
        opcionBuena: String(e?.opcionBuena || ''),
        opcionMala: String(e?.opcionMala || ''),
        explicacionBuena: String(e?.explicacionBuena || ''),
        explicacionMala: String(e?.explicacionMala || '')
      }))
    : [];

  const base = {
    titulo: String(data.titulo || '').slice(0, 200),
    desarrolloSituacional: String(data.desarrolloSituacional || ''),
    contextoHistoria: String(data.contextoHistoria || ''),
    tiempoEstimadoSegundos: Number(data.tiempoEstimadoSegundos) || 800,
    pregunta: String(escenasIa[0]?.pregunta || data.pregunta || ''),
    opcionBuena: String(escenasIa[0]?.opcionBuena || data.opcionBuena || ''),
    opcionMala: String(escenasIa[0]?.opcionMala || data.opcionMala || ''),
    explicacionBuena: String(escenasIa[0]?.explicacionBuena || data.explicacionBuena || ''),
    explicacionMala: String(escenasIa[0]?.explicacionMala || data.explicacionMala || ''),
    escenarioSugerido,
    personajesSugeridos: Array.isArray(data.personajesSugeridos)
      ? data.personajesSugeridos.map(String)
      : [],
    escenasSugeridas: escenasIa
  };

  const completo = conCantidades(base, { personajes: cantPj, escenas: cantEsc }, base.personajesSugeridos);
  return {
    ...completo,
    tipDocente: String(
      data.tipDocente ||
        `Revisa: ${completo.personajesSugeridos.length} involucrados y ${completo.escenasSugeridas.length} escenas.`
    ),
    fuente: 'openai'
  };
}

/**
 * Genera un borrador de caso a partir de una idea del docente.
 * @param {{ prompt: string, nivel?: string, lugar?: string, cantidadPersonajes?: number, cantidadEscenas?: number }} entrada
 */
export async function generarBorradorCaso(entrada = {}) {
  const prompt = String(entrada.prompt || '').trim();
  if (prompt.length < 8) {
    const error = new Error('Describe la idea del caso con al menos unas palabras (mínimo 8 caracteres).');
    error.statusCode = 422;
    error.codigo = 'IA_PROMPT_CORTO';
    throw error;
  }
  if (prompt.length > 2000) {
    const error = new Error('La idea es demasiado larga (máximo 2000 caracteres).');
    error.statusCode = 422;
    error.codigo = 'IA_PROMPT_LARGO';
    throw error;
  }

  const nivel = String(entrada.nivel || '').trim();
  const lugar = String(entrada.lugar || '').trim();
  const parseadas = parsearCantidadesPrompt(prompt);
  const cantidades = {
    personajes:
      Number(entrada.cantidadPersonajes) > 0
        ? Math.min(12, Math.max(2, Number(entrada.cantidadPersonajes)))
        : parseadas.personajes || 6,
    escenas:
      Number(entrada.cantidadEscenas) > 0
        ? Math.min(12, Math.max(2, Number(entrada.cantidadEscenas)))
        : parseadas.escenas || 4
  };

  try {
    const externo = await generarConOpenAI({ prompt, nivel, lugar, cantidades });
    if (externo?.titulo && externo?.desarrolloSituacional) {
      return externo;
    }
  } catch (error) {
    if (error.codigo === 'IA_EXTERNA' && process.env.IA_REQUERIR_EXTERNA === '1') {
      throw error;
    }
  }

  return generarLocal({ prompt, nivel, lugar, cantidades });
}

export function estadoAsistenteIa() {
  return {
    openaiConfigurado: Boolean(process.env.OPENAI_API_KEY?.trim()),
    modelo: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    modoLocalDisponible: true
  };
}
