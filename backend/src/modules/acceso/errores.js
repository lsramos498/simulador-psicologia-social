/**
 * Errores HTTP del módulo de acceso (Sofía Gallego — acceso y permisos).
 *
 * Antes, cada archivo tenía su propia copia de la función que arma el error
 * y cada archivo de rutas repetía cómo responderlo. Ahora hay una sola versión.
 *
 * Regla de seguridad: el cliente solo ve el mensaje de los errores esperados
 * (los que traen statusCode). Un error inesperado responde 500 con un mensaje
 * genérico; el detalle queda en el registro del servidor, nunca en la respuesta.
 */

export function crearErrorHttp(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

export function responderErrorHttp(res, error, contexto) {
  if (error?.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  // Solo el código o el mensaje técnico, sin la consulta ni los datos.
  console.error(`Error en ${contexto}:`, error?.code || error?.message);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
