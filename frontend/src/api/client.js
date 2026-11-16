/**
 * Cliente HTTP del frontend (Stefanía Díaz — taller de casos).
 * Consume la API del backend para el ingreso docente y los casos
 * (RF-05 a RF-09: crear, listar, publicar y archivar).
 *
 * Decisiones:
 *  - Las rutas son relativas (`/api/...`): en desarrollo el proxy de Vite
 *    (vite.config.js) las reenvía a http://127.0.0.1:3000, sin CORS ni URLs fijas.
 *  - El token JWT se guarda en localStorage (claves `lumina.*`) y cada función
 *    de casos lo recibe como parámetro y lo envía en `Authorization: Bearer`.
 *  - La interfaz nunca decide permisos: el servidor valida rol, permiso y
 *    propietario en cada petición; aquí solo se muestran los errores.
 */

// Claves de localStorage donde se conserva la sesión entre recargas de la página.
const TOKEN_KEY = 'lumina.token';
const USUARIO_KEY = 'lumina.usuario';

/**
 * Guarda la sesión en el navegador tras un ingreso exitoso.
 * @param {{ token: string, usuario: object }} sesion  Respuesta de `ingresarDocente`.
 */
export function guardarSesion({ token, usuario }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

/** Borra la sesión del navegador (cerrar sesión o token inválido). */
export function limpiarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USUARIO_KEY);
}

/**
 * Lee la sesión guardada. Si el usuario guardado está corrupto (JSON inválido),
 * limpia todo para no dejar al usuario atrapado en un estado roto.
 * @returns {{ token: string, usuario: object }|null} null si no hay sesión válida.
 */
export function leerSesion() {
  const token = localStorage.getItem(TOKEN_KEY);
  const crudo = localStorage.getItem(USUARIO_KEY);
  if (!token || !crudo) {
    return null;
  }
  try {
    return { token, usuario: JSON.parse(crudo) };
  } catch {
    limpiarSesion();
    return null;
  }
}

/**
 * Función base de todas las peticiones: arma las cabeceras (JSON y, si hay
 * token, Bearer), envía la solicitud y normaliza la respuesta.
 * @param {string} ruta  Ruta relativa, p. ej. '/api/casos'.
 * @param {{ method?: string, body?: object, token?: string }} [opciones]
 * @returns {Promise<object|null>} JSON de la respuesta (null si venía vacía).
 * @throws {Error} Si la respuesta no es 2xx. El error trae `message` (texto en
 *   español del servidor), `status` (HTTP), `codigo` (identificador estable)
 *   y `errores` (lista de validación, si existe).
 */
async function pedir(ruta, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(ruta, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload = null;
  const texto = await respuesta.text();
  if (texto) {
    try {
      payload = JSON.parse(texto);
    } catch {
      payload = { error: texto };
    }
  }

  if (!respuesta.ok) {
    const error = new Error(payload?.error || 'No se pudo completar la solicitud.');
    error.status = respuesta.status;
    error.codigo = payload?.codigo;
    error.errores = payload?.errores;
    throw error;
  }

  return payload;
}

/**
 * Inicia sesión de un docente (`POST /api/acceso/ingreso`).
 * @param {{ correo: string, contrasena: string }} credenciales
 * @returns {Promise<{ token: string, usuario: object }>} Datos para `guardarSesion`.
 * @throws {Error} 400 si faltan datos; 401 si las credenciales son incorrectas;
 *   429 si hay demasiados intentos fallidos.
 */
export function ingresarDocente({ correo, contrasena }) {
  return pedir('/api/acceso/ingreso', {
    method: 'POST',
    body: { correo, contrasena }
  });
}

/**
 * Lista los casos en resumen (`GET /api/casos`), con filtros opcionales.
 * @param {string} token  JWT de la sesión.
 * @param {{ estado?: 'Borrador'|'Publicado'|'Archivado', creadorId?: number }} [filtros]
 * @returns {Promise<{ total: number, data: object[] }>}
 */
export function listarCasos(token, { estado, creadorId } = {}) {
  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (creadorId) params.set('creadorId', String(creadorId));
  const query = params.toString();
  return pedir(`/api/casos${query ? `?${query}` : ''}`, { token });
}

/**
 * Obtiene un caso completo (`GET /api/casos/:id`). Para un docente incluye las
 * respuestas correctas; el servidor las oculta a otros roles.
 * @param {string} token  JWT de la sesión.
 * @param {number} id  Id del caso.
 * @returns {Promise<{ data: object }>}
 * @throws {Error} 404 si el caso no existe.
 */
export function obtenerCaso(token, id) {
  return pedir(`/api/casos/${id}`, { token });
}

/**
 * Crea un caso en Borrador solo con datos básicos (`POST /api/casos`).
 * El servidor toma el creador del token; no hace falta enviarlo.
 * @param {string} token  JWT de la sesión (requiere permiso CREAR_CASOS).
 * @param {{ titulo: string, desarrolloSituacional: string, contextoHistoria: string,
 *   tiempoEstimadoSegundos: number }} datos
 * @returns {Promise<{ data: object }>}
 * @throws {Error} 403 sin permiso; 422 con `errores` si los datos no son válidos.
 */
export function crearCaso(token, datos) {
  return pedir('/api/casos', {
    method: 'POST',
    token,
    body: datos
  });
}

/**
 * Crea un caso completo de una vez con el Builder del backend
 * (`POST /api/casos/construir`): personajes, escenas, preguntas, opciones y rúbrica.
 * @param {string} token  JWT de la sesión (requiere permiso CREAR_CASOS).
 * @param {object} datos  Datos básicos más `personajes`, `escenas` y `rubrica` opcional.
 * @returns {Promise<{ data: object }>}
 * @throws {Error} 422 con `errores` si la estructura es inválida.
 */
export function construirCaso(token, datos) {
  return pedir('/api/casos/construir', {
    method: 'POST',
    token,
    body: datos
  });
}

/**
 * Publica un caso en Borrador (`POST /api/casos/:id/publicar`). El servidor
 * exige que esté completo (escenas, preguntas, opciones, explicaciones y rúbrica).
 * @param {string} token  JWT de la sesión.
 * @param {number} id  Id del caso.
 * @returns {Promise<{ data: object }>}
 * @throws {Error} 409 si no es Borrador; 422 con `errores` indicando qué falta.
 */
export function publicarCaso(token, id) {
  return pedir(`/api/casos/${id}/publicar`, {
    method: 'POST',
    token
  });
}

/**
 * Archiva un caso (`POST /api/casos/:id/archivar`). Es una acción definitiva.
 * @param {string} token  JWT de la sesión.
 * @param {number} id  Id del caso.
 * @returns {Promise<{ data: object }>}
 * @throws {Error} 403 si no es el creador ni administrador; 409 si ya está archivado.
 */
export function archivarCaso(token, id) {
  return pedir(`/api/casos/${id}/archivar`, {
    method: 'POST',
    token
  });
}
