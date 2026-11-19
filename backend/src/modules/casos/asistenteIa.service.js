/**
 * Asistente de IA para docentes que crean casos situacionales.
 * Usa OpenAI si hay OPENAI_API_KEY; si no, un generador local de práctica.
 */

const PLANTILLAS = [
  {
    claves: ['barrio', 'vecino', 'convivencia', 'ruido', 'conjunto'],
    escenarioSugerido: 'Calle del barrio',
    personajesSugeridos: ['Lucía', 'Pedro', 'Sofía', 'Elena'],
    armar: (idea) =>
      conEscena(idea, {
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
    personajesSugeridos: ['Andrés', 'Sofía', 'Valeria', 'Elena'],
    armar: (idea) =>
      conEscena(idea, {
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
    personajesSugeridos: ['Marta', 'Sofía', 'Diego', 'Elena'],
    armar: (idea) =>
      conEscena(idea, {
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
    personajesSugeridos: ['Camila', 'Nina', 'Diego', 'Sofía'],
    armar: (idea) =>
      conEscena(idea, {
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
    personajesSugeridos: ['Elena', 'Valeria', 'Camila', 'Pedro'],
    armar: (idea) =>
      conEscena(idea, {
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
    personajesSugeridos: ['Elena', 'Lucía', 'Sofía', 'Valeria'],
    armar: (idea) =>
      conEscena(idea, {
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

function conEscena(idea, base) {
  const escenario = base.escenarioSugerido || 'Plaza principal';
  const segunda =
    /comisaría|denuncia/i.test(escenario) ? 'Calle del barrio'
      : /hospital/i.test(escenario) ? 'Café del barrio'
        : /colegio|orientación/i.test(escenario) ? 'Sala de la casa'
          : /ong/i.test(escenario) ? 'Plaza principal'
            : /trabajo|oficina/i.test(escenario) ? 'Café del barrio'
              : 'Sede de la ONG';

  const escena1 = {
    nombre: escenario,
    contexto: base.contextoHistoria,
    pregunta: base.pregunta,
    opcionBuena: base.opcionBuena,
    opcionMala: base.opcionMala,
    explicacionBuena: base.explicacionBuena,
    explicacionMala: base.explicacionMala
  };
  const escena2 = {
    nombre: segunda,
    contexto: `Segundo punto del recorrido para contrastar lo escuchado en ${escenario}.`,
    pregunta: '¿Qué conviene hacer después de contrastar esta nueva versión?',
    opcionBuena: 'Integrar lo nuevo con lo anterior y proponer un siguiente paso ético',
    opcionMala: 'Descartar todo lo anterior y actuar solo con este relato',
    explicacionBuena: 'Contrastar e integrar evita decisiones parciales.',
    explicacionMala: 'Ignorar lo previo debilita el análisis situacional.'
  };

  return {
    ...base,
    escenarioSugerido: escenario,
    escenaSugerida: escena1,
    escenasSugeridas: [escena1, escena2],
    rubricaSugerida: {
      nombre: `Evaluación · ${base.titulo}`,
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

const PLANTILLA_DEFAULT = {
  escenarioSugerido: 'Plaza principal',
  personajesSugeridos: ['Valeria', 'Elena', 'Lucía', 'Diego'],
  armar: (idea) =>
    conEscena(idea, {
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

function generarLocal({ prompt, nivel, lugar }) {
  const idea = {
    titulo: extraerTitulo(prompt),
    detalle: [prompt, lugar ? `Lugar sugerido: ${lugar}.` : '', nivel ? `Nivel: ${nivel}.` : '']
      .filter(Boolean)
      .join(' ')
  };
  const plantilla = elegirPlantilla(`${prompt} ${lugar || ''}`);
  const base = plantilla.armar(idea);
  const escenarioSugerido = lugar?.trim() || plantilla.escenarioSugerido || base.escenarioSugerido;
  return {
    ...base,
    escenarioSugerido,
    escenaSugerida: {
      ...(base.escenaSugerida || {}),
      nombre: escenarioSugerido
    },
    personajesSugeridos: plantilla.personajesSugeridos,
    fuente: 'asistente-local',
    tipDocente:
      'Revisa el borrador, ajusta nombres y matices éticos, elige personajes/escenario y crea el caso.'
  };
}

async function generarConOpenAI({ prompt, nivel, lugar }) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const modelo = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const sistema = `Eres asistente pedagógico de Lumina, simulador de psicología social para docentes universitarios en Colombia.
Generas borradores de casos situacionales para práctica (comisaría, hospital, barrio, colegio, ONG, trabajo).
Responde SOLO JSON válido con estas claves:
titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos (número 480-1200),
pregunta, opcionBuena, opcionMala, explicacionBuena, explicacionMala,
escenarioSugerido (lugar concreto), personajesSugeridos (array de 3 a 4 nombres), tipDocente.
Tono claro, ético, no sensacionalista, útil para intervención social.`;

  const usuario = `Idea del docente: ${prompt}
Nivel: ${nivel || 'pregrado'}
Lugar preferido: ${lugar || 'el que mejor encaje'}`;

  const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelo,
      temperature: 0.7,
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
  const enriquecido = conEscena(
    { titulo: data.titulo },
    {
      titulo: String(data.titulo || '').slice(0, 200),
      desarrolloSituacional: String(data.desarrolloSituacional || ''),
      contextoHistoria: String(data.contextoHistoria || ''),
      tiempoEstimadoSegundos: Number(data.tiempoEstimadoSegundos) || 800,
      pregunta: String(data.pregunta || ''),
      opcionBuena: String(data.opcionBuena || ''),
      opcionMala: String(data.opcionMala || ''),
      explicacionBuena: String(data.explicacionBuena || ''),
      explicacionMala: String(data.explicacionMala || ''),
      escenarioSugerido
    }
  );

  return {
    ...enriquecido,
    personajesSugeridos: Array.isArray(data.personajesSugeridos)
      ? data.personajesSugeridos.map(String).slice(0, 6)
      : ['Valeria', 'Elena', 'Lucía'],
    tipDocente: String(data.tipDocente || 'Revisa y ajusta el borrador antes de crear el caso.'),
    fuente: 'openai'
  };
}

/**
 * Genera un borrador de caso a partir de una idea del docente.
 * @param {{ prompt: string, nivel?: string, lugar?: string }} entrada
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

  try {
    const externo = await generarConOpenAI({ prompt, nivel, lugar });
    if (externo?.titulo && externo?.desarrolloSituacional) {
      return externo;
    }
  } catch (error) {
    // Si falla la IA externa, caemos al generador local para no bloquear al docente.
    if (error.codigo === 'IA_EXTERNA' && process.env.IA_REQUERIR_EXTERNA === '1') {
      throw error;
    }
  }

  return generarLocal({ prompt, nivel, lugar });
}

export function estadoAsistenteIa() {
  return {
    openaiConfigurado: Boolean(process.env.OPENAI_API_KEY?.trim()),
    modelo: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    modoLocalDisponible: true
  };
}
