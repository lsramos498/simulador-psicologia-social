function redondear(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/**
 * Nota al cerrar la sesión.
 * Cada pregunta no respondida cuenta como cero (ausencia o intento incompleto).
 * El resultado reparte ese acierto según la ponderación de la rúbrica.
 */
export function calcularEvaluacion({ preguntas = [], respuestas = [], criterios = [] }) {
  const decisiones = new Set();
  const correctasPorDecision = new Map();

  for (const pregunta of preguntas) {
    const decisionId = Number(pregunta.decisionId);
    decisiones.add(decisionId);
    if (pregunta.opcionCorrectaId == null) continue;
    if (!correctasPorDecision.has(decisionId)) {
      correctasPorDecision.set(decisionId, new Set());
    }
    correctasPorDecision.get(decisionId).add(Number(pregunta.opcionCorrectaId));
  }

  const total = decisiones.size;
  const vistas = new Set();
  let correctas = 0;
  let respondidas = 0;

  for (const respuesta of respuestas) {
    const decisionId = Number(respuesta.decisionId);
    if (!decisiones.has(decisionId) || vistas.has(decisionId)) continue;
    vistas.add(decisionId);
    respondidas += 1;
    if (correctasPorDecision.get(decisionId)?.has(Number(respuesta.opcionId))) {
      correctas += 1;
    }
  }

  const fraccion = total === 0 ? 0 : correctas / total;
  const resultados = criterios.map((criterio) => ({
    criterioId: Number(criterio.criterioId),
    rubricaId: Number(criterio.rubricaId ?? criterio.rubrica_id),
    puntuacion: redondear(Number(criterio.puntajeMaximo) * fraccion),
    observacion: respondidas === 0
      ? 'Ausencia: no hubo respuestas. Cada pregunta cuenta como cero.'
      : `Aciertos: ${correctas} de ${total}. Las preguntas sin respuesta cuentan como cero.`
  }));

  const resultado = redondear(resultados.reduce(
    (suma, criterio, indice) => suma + criterio.puntuacion * (Number(criterios[indice].ponderacion) / 100),
    0
  ));

  let retroalimentacionGeneral;
  if (total === 0) {
    retroalimentacionGeneral = 'El caso no tiene preguntas para evaluar.';
  } else if (respondidas === 0) {
    retroalimentacionGeneral = `Ausencia: 0 de ${total} preguntas. Cada pregunta sin respuesta cuenta como cero.`;
  } else if (respondidas < total) {
    retroalimentacionGeneral = `Intento incompleto: ${correctas} aciertos de ${total} preguntas. Las no respondidas cuentan como cero.`;
  } else {
    retroalimentacionGeneral = `${correctas} aciertos de ${total} preguntas.`;
  }

  return {
    resultado,
    retroalimentacionGeneral,
    correctas,
    total,
    respondidas,
    criterios: resultados
  };
}
