import { verificarToken } from './tokens.js';

/**
 * Middleware de autenticación (Sofía Gallego — acceso y permisos).
 * Lee el encabezado:  Authorization: Bearer <token>
 *
 * Si el token es válido, deja el usuario en req.usuario = { id, roles, permisos }
 * para que lo usen requiereRol, requierePermiso, el Proxy y los demás módulos
 * (por ejemplo, Valeria usa req.usuario.id como estudianteId).
 *
 * Responde 401 si falta el token, está mal formado, fue alterado o expiró.
 * No revisa permisos: eso es autorización y lo hacen otros componentes.
 */
export function autenticar(req, res, next) {
  const encabezado = req.headers.authorization;

  if (!encabezado) {
    return res.status(401).json({ error: 'Debe autenticarse para continuar' });
  }

  const [esquema, token] = encabezado.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Formato de autenticación no válido' });
  }

  try {
    req.usuario = verificarToken(token);
    return next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message });
  }
}