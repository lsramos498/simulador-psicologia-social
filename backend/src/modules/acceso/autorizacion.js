/**
 * Reglas de autorización (Sofía Gallego — acceso y permisos).
 * RF-02: restringir funciones según rol y permiso específico.
 *
 * Trabaja sobre el usuario autenticado que el servidor deja en req.usuario:
 *   { id, roles: ['docente'], permisos: ['crear_casos'] }
 * Nunca sobre roles o permisos enviados por el cliente.
 */

export const ROLES = Object.freeze({
  ADMINISTRADOR: 'administrador',
  DOCENTE: 'docente',
  ESTUDIANTE: 'estudiante'
});

function validarUsuario(usuario) {
  if (!usuario || typeof usuario !== 'object') {
    throw new TypeError('Se requiere un usuario autenticado');
  }
}

export function tieneRol(usuario, ...rolesPermitidos) {
  validarUsuario(usuario);
  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];
  return rolesPermitidos.some((rol) => roles.includes(rol));
}

export function tienePermiso(usuario, permiso) {
  validarUsuario(usuario);
  if (!permiso || typeof permiso !== 'string') {
    throw new TypeError('Se requiere el nombre del permiso');
  }
  const permisos = Array.isArray(usuario.permisos) ? usuario.permisos : [];
  return permisos.includes(permiso);
}
