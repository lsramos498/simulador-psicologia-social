export function errorCaso(codigo, mensaje, statusCode = 400, errores = undefined) {
  const error = new Error(mensaje);
  error.codigo = codigo;
  error.statusCode = statusCode;
  if (errores) {
    error.errores = errores;
  }
  return error;
}

export function errorValidacion(errores) {
  return errorCaso(
    'ESTRUCTURA_INVALIDA',
    'La estructura del caso no es válida.',
    422,
    errores
  );
}
