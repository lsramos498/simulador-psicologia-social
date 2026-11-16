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

  // Exactamente "Bearer <token>"; el nombre del esquema no distingue
  // mayúsculas (RFC 7235). Partes de más se rechazan.
  const partes = encabezado.trim().split(/\s+/);
  const [esquema, token] = partes;

  if (partes.length !== 2 || esquema.toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Formato de autenticación no válido' });
  }

  try {
    req.usuario = verificarToken(token);
    return next();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    // Sin statusCode es un fallo del servidor (por ejemplo, falta JWT_SECRETO):
    // se registra sin datos del token y no se culpa al cliente con un 401.
    console.error('Error en autenticación:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}