import { tienePermiso } from './autorizacion.js';

/**
 * Patrón Proxy de protección (Sofía Gallego — acceso y permisos).
 * RF-02: solo usuarios con el permiso correspondiente pueden ejecutar
 * ciertas operaciones de negocio (por ejemplo, CREAR_CASOS).
 *
 * El proxy tiene los mismos métodos que el servicio real. Antes de
 * delegar cada llamada, comprueba el permiso del usuario. Así el servicio
 * real (por ejemplo, el de casos) no necesita saber nada de seguridad.
 *
 *   const casos = crearServicioProtegido(casosService, req.usuario, {
 *     crearCaso: 'CREAR_CASOS'
 *   });
 *   await casos.crearCaso(datos); // 401/403 si no corresponde
 *
 * Seguro por defecto: el proxy solo expone las operaciones configuradas.
 */

function errorAcceso(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

export function crearServicioProtegido(servicioReal, usuario, permisosPorOperacion) {
  if (!servicioReal || typeof servicioReal !== 'object') {
    throw new TypeError('Se requiere el servicio real que se va a proteger');
  }

  if (!permisosPorOperacion || typeof permisosPorOperacion !== 'object') {
    throw new TypeError('Se requiere indicar el permiso de cada operación');
  }

  const proxy = {};

  for (const [operacion, permiso] of Object.entries(permisosPorOperacion)) {
    if (typeof servicioReal[operacion] !== 'function') {
      throw new TypeError(`El servicio no tiene la operación "${operacion}"`);
    }

    if (!permiso || typeof permiso !== 'string') {
      throw new TypeError(`La operación "${operacion}" requiere el nombre de un permiso`);
    }

    proxy[operacion] = (...argumentos) => {
      if (!usuario) {
        throw errorAcceso('Debe autenticarse para continuar', 401);
      }

      if (!tienePermiso(usuario, permiso)) {
        throw errorAcceso('No tiene permiso para realizar esta operación', 403);
      }

      // Delegar en el servicio real, conservando su contexto (this).
      return servicioReal[operacion].apply(servicioReal, argumentos);
    };
  }

  return Object.freeze(proxy);
}
