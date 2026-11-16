/**
 * Errores de dominio del módulo Casos (Stefanía Díaz — RF-05 a RF-09, RF-17).
 *
 * Se usa un `Error` común con campos extra (`codigo`, `statusCode`, `errores`)
 * para que la capa HTTP (`routes/casos.routes.js`) pueda responder sin conocer
 * los detalles del servicio: el `statusCode` define la respuesta y `codigo`
 * es un identificador estable que el frontend puede consultar.
 */

/**
 * Crea un error de dominio del módulo Casos.
 *
 * @param {string} codigo  Identificador estable en MAYÚSCULAS (p. ej. 'CASO_NO_EXISTE').
 * @param {string} mensaje  Texto en español que verá el usuario.
 * @param {number} [statusCode=400]  Código HTTP asociado (400, 403, 404, 409, 422…).
 * @param {string[]} [errores]  Lista de mensajes de validación; solo se adjunta si se envía.
 * @returns {Error & { codigo: string, statusCode: number, errores?: string[] }}
 *   El error listo para lanzar con `throw`.
 */
export function errorCaso(codigo, mensaje, statusCode = 400, errores = undefined) {
  const error = new Error(mensaje);
  error.codigo = codigo;
  error.statusCode = statusCode;
  if (errores) {
    error.errores = errores;
  }
  return error;
}

/**
 * Crea el error estándar de validación estructural (HTTP 422, código
 * 'ESTRUCTURA_INVALIDA'). Reúne todos los problemas encontrados para que el
 * docente los corrija de una sola vez, en lugar de verlos de uno en uno.
 *
 * @param {string[]} errores  Mensajes en español, uno por problema detectado.
 * @returns {Error & { codigo: string, statusCode: number, errores: string[] }}
 */
export function errorValidacion(errores) {
  return errorCaso(
    'ESTRUCTURA_INVALIDA',
    'La estructura del caso no es válida.',
    422,
    errores
  );
}
