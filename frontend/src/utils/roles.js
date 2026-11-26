export function rolesDe(usuario) {
  const lista = usuario?.roles || [];
  if (lista.length) return lista.map((r) => String(r));
  if (usuario?.rol) return [String(usuario.rol)];
  return [];
}

export function tieneRol(usuario, nombre) {
  const objetivo = String(nombre).toLowerCase();
  return rolesDe(usuario).some((r) => r.toLowerCase() === objetivo);
}

export function esAdministrador(usuario) {
  return tieneRol(usuario, 'Administrador');
}

export function esDocente(usuario) {
  return tieneRol(usuario, 'Docente');
}

export function esEstudiante(usuario) {
  return tieneRol(usuario, 'Estudiante');
}

/** Quién ve el taller de casos: docente o admin con permiso de crear/ver. */
export function puedeUsarTaller(usuario) {
  return esAdministrador(usuario) || esDocente(usuario);
}
