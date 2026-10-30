
function registrarRespuesta(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new TypeError('Los datos de la respuesta no son válidos');
  }

  const { estudianteId, sesionId, preguntaId, opcionId } = datos;

  if (
    estudianteId == null ||
    sesionId == null ||
    preguntaId == null ||
    opcionId == null
  ) {
    throw new Error('Faltan datos para registrar la respuesta');
  }

  return {
    estudianteId,
    sesionId,
    preguntaId,
    opcionId
  };
}

export { registrarRespuesta };