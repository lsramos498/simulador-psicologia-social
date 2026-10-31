
function registrarRespuesta(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new TypeError('Los datos de la respuesta no son válidos');
  }

  const { sesionId, decisionId, opcionId } = datos;

  if (
    !Number.isInteger(sesionId) || sesionId <= 0 ||
    !Number.isInteger(decisionId) || decisionId <= 0 ||
    !Number.isInteger(opcionId) || opcionId <= 0
  ) {
    throw new Error(
      'La sesión, la decisión y la opción deben tener identificadores válidos'
    );
  }

  return {
    sesionId,
    decisionId,
    opcionId
  };
}

export { registrarRespuesta };
