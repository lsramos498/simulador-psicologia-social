
function calcularPorCantidades(totalPreguntas, preguntasRespondidas) {
  if (
    !Number.isInteger(totalPreguntas) ||
    !Number.isInteger(preguntasRespondidas) ||
    totalPreguntas < 0 ||
    preguntasRespondidas < 0 ||
    preguntasRespondidas > totalPreguntas
  ) {
    throw new Error('Los valores del progreso no son válidos');
  }

  return {
    totalPreguntas,
    preguntasRespondidas,
    preguntasPendientes: totalPreguntas - preguntasRespondidas
  };
}

function validarId(id) {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw new TypeError('Los identificadores deben ser enteros positivos dentro del rango INT.');
  }
}

function leerId(respuesta, nombre, columna) {
  const tieneNombre = Object.hasOwn(respuesta, nombre);
  const tieneColumna = Object.hasOwn(respuesta, columna);
  if (tieneNombre && tieneColumna && respuesta[nombre] !== respuesta[columna]) {
    throw new TypeError(`La respuesta contiene valores contradictorios para ${nombre}.`);
  }
  return tieneNombre ? respuesta[nombre] : respuesta[columna];
}

/**
 * Conserva calcularProgreso(total, respondidas) para los consumidores anteriores.
 * La entrada nueva acepta un Array o Set de IDs aplicables y un Array de respuestas.
 * null/undefined indica recorrido desconocido; [] indica un conjunto conocido vacío.
 * Las respuestas usan decisionId/opcionId o decision_id/opcion_id; null significa pendiente.
 * Valida la forma de los IDs, no la relación opción–decisión que comprueba RF-10.
 */
function calcularProgreso(decisionesAplicables, respuestas) {
  if (typeof decisionesAplicables === 'number') {
    return calcularPorCantidades(decisionesAplicables, respuestas);
  }

  if (decisionesAplicables != null
    && !Array.isArray(decisionesAplicables) && !(decisionesAplicables instanceof Set)) {
    throw new TypeError('Las decisiones aplicables deben ser un Array, un Set o un recorrido indeterminado.');
  }
  if (!Array.isArray(respuestas)) {
    throw new TypeError('Las respuestas registradas deben ser un Array.');
  }

  const aplicables = decisionesAplicables == null ? null : new Set(decisionesAplicables);
  if (aplicables !== null) {
    for (const id of aplicables) validarId(id);
  }

  const seleccionadas = new Set();
  for (const respuesta of respuestas) {
    if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
      throw new TypeError('Cada respuesta debe contener decisionId y opcionId.');
    }
    const decisionId = leerId(respuesta, 'decisionId', 'decision_id');
    const opcionId = leerId(respuesta, 'opcionId', 'opcion_id');
    validarId(decisionId);
    if (opcionId !== null) {
      validarId(opcionId);
      seleccionadas.add(decisionId);
    }
  }

  if (aplicables === null) {
    return {
      estadoRecorrido: 'indeterminado',
      totalPreguntas: null,
      preguntasRespondidas: null,
      preguntasPendientes: null,
      decisionesPendientesIds: null
    };
  }

  // Solo se cuentan decisiones del conjunto recibido; no se infiere el recorrido del caso.
  const pendientes = [...aplicables].filter((id) => !seleccionadas.has(id));
  return {
    estadoRecorrido: 'determinado',
    ...calcularPorCantidades(aplicables.size, aplicables.size - pendientes.length),
    decisionesPendientesIds: pendientes
  };
}

export { calcularProgreso };
