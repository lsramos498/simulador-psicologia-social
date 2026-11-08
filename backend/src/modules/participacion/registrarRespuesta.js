
function registrarRespuesta(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new TypeError('Los datos de la respuesta no son válidos');
  }

  const { sesionId, decisionId, opcionId } = datos;

  if (
    [sesionId, decisionId, opcionId].some(
      (id) => !Number.isSafeInteger(id) || id <= 0 || id > 2147483647
    )
  ) {
    throw new TypeError(
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
