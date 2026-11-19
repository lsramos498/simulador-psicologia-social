
function calcularProgreso(totalPreguntas, preguntasRespondidas) {
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

export { calcularProgreso };
