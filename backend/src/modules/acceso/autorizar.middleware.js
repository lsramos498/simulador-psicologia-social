import { tienePermiso, tieneRol } from './autorizacion.js';

/**
 * Middlewares de autorización para proteger rutas.
 * Deben usarse DESPUÉS del middleware de autenticación,
 * que es el encargado de llenar req.usuario.
 *
 *   401 → no hay usuario autenticado (no sabemos quién es)
 *   403 → sabemos quién es, pero no tiene autorización
 */

export function requiereRol(...rolesPermitidos) {
  // Falla al definir la ruta, no en cada petición
  if (rolesPermitidos.length === 0) {
    throw new TypeError('requiereRol necesita al menos un rol');
  }

  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Debe autenticarse para continuar' });
    }

    if (!tieneRol(req.usuario, ...rolesPermitidos)) {
      return res.status(403).json({ error: 'No tiene el rol requerido para esta operación' });
    }

    return next();
  };
}

export function requierePermiso(permiso) {
  // Falla al definir la ruta, no en cada petición
  if (!permiso || typeof permiso !== 'string') {
    throw new TypeError('requierePermiso necesita el nombre del permiso');
  }

  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Debe autenticarse para continuar' });
    }

    if (!tienePermiso(req.usuario, permiso)) {
      return res.status(403).json({ error: 'No tiene permiso para realizar esta operación' });
    }

    return next();
  };
}
