import jwt from 'jsonwebtoken';

/**
 * Tokens de sesión con JWT (Sofía Gallego — acceso y permisos).
 * Decisión del equipo: la autenticación usa JWT.
 *
 * Variables de entorno (.env):
 *  - JWT_SECRETO:    clave para firmar los tokens (mínimo 32 caracteres).
 *  - JWT_EXPIRACION: cuánto dura un token. Decisión del equipo: 1 hora ('1h').
 *
 * Cierre de sesión (decisión del equipo): el cliente elimina el token.
 * El servidor lo sigue aceptando hasta que vence; si se necesita
 * invalidación inmediata habría que agregar una lista de revocación.
 *
 * El token guarda quién es el usuario (sub), sus roles y sus permisos.
 * Como lo firma el servidor, el cliente no puede cambiarlos sin invalidarlo.
 */

const ALGORITMO = 'HS256';
const EXPIRACION_POR_DEFECTO = '1h';
const LONGITUD_MINIMA_SECRETO = 32;

function errorAutenticacion(mensaje) {
  const error = new Error(mensaje);
  error.statusCode = 401;
  return error;
}

function obtenerSecreto() {
  const secreto = process.env.JWT_SECRETO;

  if (!secreto || secreto.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `JWT_SECRETO debe existir en .env y tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`
    );
  }

  return secreto;
}

/**
 * Crea un token para un usuario ya autenticado.
 * @param {{ id: number, roles: string[], permisos?: string[], actividadId?: number }} usuario
 */
export function firmarToken(usuario) {
  if (!usuario || !Number.isInteger(usuario.id) || usuario.id < 1) {
    throw new TypeError('Se requiere un usuario con id válido');
  }

  if (!Array.isArray(usuario.roles) || usuario.roles.length === 0) {
    throw new TypeError('El usuario debe tener al menos un rol');
  }

  const datos = {
    roles: usuario.roles,
    permisos: Array.isArray(usuario.permisos) ? usuario.permisos : []
  };

  // Para estudiantes: la actividad a la que entraron con su código.
  if (usuario.actividadId != null) {
    datos.actividadId = usuario.actividadId;
  }

  return jwt.sign(datos, obtenerSecreto(), {
    algorithm: ALGORITMO,
    subject: String(usuario.id),
    expiresIn: process.env.JWT_EXPIRACION || EXPIRACION_POR_DEFECTO
  });
}

/**
 * Comprueba la firma y el vencimiento de un token.
 * Devuelve el usuario en el formato que usan los demás módulos (req.usuario).
 */
export function verificarToken(token) {
  if (!token || typeof token !== 'string') {
    throw errorAutenticacion('Debe autenticarse para continuar');
  }

  let datos;
  try {
    // Se fija el algoritmo para impedir tokens sin firma o con otro algoritmo.
    datos = jwt.verify(token, obtenerSecreto(), { algorithms: [ALGORITMO] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw errorAutenticacion('La sesión expiró, vuelva a iniciar sesión');
    }
    throw errorAutenticacion('Token de autenticación no válido');
  }

  const id = Number(datos.sub);
  if (!Number.isInteger(id) || id < 1 || !Array.isArray(datos.roles)) {
    throw errorAutenticacion('Token de autenticación no válido');
  }

  const usuario = {
    id,
    roles: datos.roles,
    permisos: Array.isArray(datos.permisos) ? datos.permisos : []
  };

  if (datos.actividadId != null) {
    usuario.actividadId = datos.actividadId;
  }

  return usuario;
}