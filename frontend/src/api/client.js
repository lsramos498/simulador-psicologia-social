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

// Sesión por pestaña (sessionStorage): el correo del estudiante abre login
// aunque otra pestaña siga con el taller docente. localStorage se limpia
// para no arrastrar sesiones viejas entre pestañas.
const TOKEN_KEY = 'lumina.token';
const USUARIO_KEY = 'lumina.usuario';

function borrarClaves(store) {
  try {
    store.removeItem(TOKEN_KEY);
    store.removeItem(USUARIO_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Guarda la sesión en el navegador tras un ingreso exitoso.
 * @param {{ token: string, usuario: object }} sesion  Respuesta de `ingresarDocente`.
 */
export function guardarSesion({ token, usuario }) {
  borrarClaves(localStorage);
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

/** Borra la sesión del navegador (cerrar sesión o token inválido). */
export function limpiarSesion() {
  borrarClaves(sessionStorage);
  borrarClaves(localStorage);
}

/**
 * Lee la sesión guardada. Si el usuario guardado está corrupto (JSON inválido),
 * limpia todo para no dejar al usuario atrapado en un estado roto.
 * @returns {{ token: string, usuario: object }|null} null si no hay sesión válida.
 */
export function leerSesion() {
  // Migración: no reutilizar localStorage entre pestañas (causaba ir al taller docente).
  borrarClaves(localStorage);

  const token = sessionStorage.getItem(TOKEN_KEY);
  const crudo = sessionStorage.getItem(USUARIO_KEY);
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
/** Callback opcional cuando el token expiró (401). Lo registra App.jsx. */
let alExpirarSesion = null;

export function onSesionExpirada(callback) {
  alExpirarSesion = typeof callback === 'function' ? callback : null;
}

const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

function urlApi(ruta) {
  if (!ruta.startsWith('/')) return `${API_BASE}/${ruta}`;
  return `${API_BASE}${ruta}`;
}

async function pedir(ruta, { method = 'GET', body, token, formato = 'application/json' } = {}) {
  const headers = { Accept: formato };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(urlApi(ruta), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (respuesta.ok && formato === 'text/csv') {
    if (!/^text\/csv(?:\s*;|$)/i.test(respuesta.headers.get('Content-Type') || '')) {
      throw new Error('El servidor no devolvió el reporte CSV.');
    }
    return respuesta.blob();
  }

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
    if (respuesta.status === 401 && token) {
      limpiarSesion();
      alExpirarSesion?.();
    }
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
 * Genera un borrador de caso con el asistente de IA (`POST /api/casos/asistente-ia`).
 * @param {string} token
 * @param {{ prompt: string, nivel?: string, lugar?: string }} datos
 */
export function generarCasoConIa(token, datos) {
  return pedir('/api/casos/asistente-ia', {
    method: 'POST',
    token,
    body: datos
  });
}

/** Estado del asistente (`GET /api/casos/asistente-ia/estado`). */
export function estadoAsistenteIa(token) {
  return pedir('/api/casos/asistente-ia/estado', { token });
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

/** Actualiza datos básicos de un borrador (`PATCH /api/casos/:id`). */
export function actualizarCaso(token, id, datos) {
  return pedir(`/api/casos/${id}`, {
    method: 'PATCH',
    token,
    body: datos
  });
}

/** Agrega una escena (`POST /api/casos/:id/escenas`). Sin personajes en el body. */
export function agregarEscena(token, id, datos) {
  return pedir(`/api/casos/${id}/escenas`, {
    method: 'POST',
    token,
    body: datos
  });
}

/** Actualiza metadatos de una escena (`PATCH /api/casos/:id/escenas/:escenaId`). */
export function actualizarEscena(token, id, escenaId, datos) {
  return pedir(`/api/casos/${id}/escenas/${escenaId}`, {
    method: 'PATCH',
    token,
    body: datos
  });
}

/** Agrega una pregunta a una escena (`POST .../escenas/:escenaId/decisiones`). */
export function agregarDecision(token, id, escenaId, datos) {
  return pedir(`/api/casos/${id}/escenas/${escenaId}/decisiones`, {
    method: 'POST',
    token,
    body: datos
  });
}

/** Actualiza una pregunta (`PATCH /api/casos/:id/decisiones/:decisionId`). */
export function actualizarDecision(token, id, decisionId, datos) {
  return pedir(`/api/casos/${id}/decisiones/${decisionId}`, {
    method: 'PATCH',
    token,
    body: datos
  });
}

/** Agrega una opción a una pregunta (`POST .../decisiones/:decisionId/opciones`). */
export function agregarOpcion(token, id, decisionId, datos) {
  return pedir(`/api/casos/${id}/decisiones/${decisionId}/opciones`, {
    method: 'POST',
    token,
    body: datos
  });
}

/** Actualiza una opción (`PATCH /api/casos/:id/opciones/:opcionId`). */
export function actualizarOpcion(token, id, opcionId, datos) {
  return pedir(`/api/casos/${id}/opciones/${opcionId}`, {
    method: 'PATCH',
    token,
    body: datos
  });
}

/** Agrega un personaje al caso (`POST /api/casos/:id/personajes`). */
export function agregarPersonaje(token, id, datos) {
  return pedir(`/api/casos/${id}/personajes`, {
    method: 'POST',
    token,
    body: datos
  });
}

/** Asocia un personaje del caso a una escena (`POST .../escenas/:escenaId/personajes`). */
export function asociarPersonaje(token, id, escenaId, personajeId) {
  return pedir(`/api/casos/${id}/escenas/${escenaId}/personajes`, {
    method: 'POST',
    token,
    body: { personajeId: Number(personajeId) }
  });
}

/** Guarda / versiona la rúbrica activa (`PUT /api/casos/:id/rubrica`). */
export function guardarRubrica(token, id, datos) {
  return pedir(`/api/casos/${id}/rubrica`, {
    method: 'PUT',
    token,
    body: datos
  });
}

/** Material de simulación (diálogos y portadas) persistido en servidor. */
export function guardarMaterialCaso(token, id, material) {
  return pedir(`/api/casos/${id}/material`, {
    method: 'PUT',
    token,
    body: material
  });
}

/** Solicita el OTP de inicio de sesión al correo del estudiante. */
export function enviarCodigoEstudiante({ correo }) {
  return pedir('/api/acceso/estudiantes/enviar-codigo', {
    method: 'POST',
    body: { correo }
  });
}

/** Ingreso de estudiante con correo + código de sesión (OTP). */
export function ingresarEstudiante({ correo, codigo }) {
  return pedir('/api/acceso/estudiantes/ingreso', {
    method: 'POST',
    body: { correo, codigo }
  });
}

/** Actividades convocadas del estudiante (título/hora; sin contenido si Programada). */
export function listarMisActividades(token) {
  return pedir('/api/acceso/estudiantes/mis-actividades', { token });
}

export function listarEspacios(token) {
  return pedir('/api/espacios', { token });
}

export function crearEspacio(token, datos) {
  return pedir('/api/espacios', { method: 'POST', token, body: datos });
}

export function listarEstudiantesAdmin(token) {
  return pedir('/api/acceso/admin/estudiantes', { token });
}

/** Roster de estudiantes para convocar (docente o admin). */
export function listarEstudiantes(token) {
  return pedir('/api/acceso/estudiantes', { token });
}

/** Alta de estudiante por docente o admin. */
export function crearEstudiante(token, datos) {
  return pedir('/api/acceso/estudiantes', {
    method: 'POST',
    token,
    body: datos
  });
}

/** Alta masiva desde texto extraído de PDF/lista. */
export function crearEstudiantesLote(token, texto) {
  return pedir('/api/acceso/estudiantes/lote', {
    method: 'POST',
    token,
    body: { texto }
  });
}

/** Importa y construye un caso desde texto de PDF. */
export function importarCasoDesdeTexto(token, { texto, publicar = false }) {
  return pedir('/api/casos/importar-texto', {
    method: 'POST',
    token,
    body: { texto, publicar }
  });
}

export function listarGrupos(token) {
  return pedir('/api/grupos', { token });
}

export function crearGrupo(token, datos) {
  return pedir('/api/grupos', { method: 'POST', token, body: datos });
}

export function obtenerGrupo(token, id) {
  return pedir(`/api/grupos/${id}`, { token });
}

export function asignarEstudiantesGrupo(token, grupoId, estudiantesIds) {
  return pedir(`/api/grupos/${grupoId}/estudiantes`, {
    method: 'POST',
    token,
    body: { estudiantesIds }
  });
}

export function retirarEstudianteGrupo(token, grupoId, estudianteId) {
  return pedir(`/api/grupos/${grupoId}/estudiantes/${estudianteId}`, {
    method: 'DELETE',
    token
  });
}

export function listarActividades(token) {
  return pedir('/api/actividades', { token });
}

export function crearActividad(token, datos) {
  return pedir('/api/actividades', { method: 'POST', token, body: datos });
}

export function obtenerActividad(token, id) {
  return pedir(`/api/actividades/${id}`, { token });
}

export function iniciarActividad(token, id) {
  return pedir(`/api/actividades/${id}/iniciar`, { method: 'POST', token });
}

export function cerrarActividad(token, id) {
  return pedir(`/api/actividades/${id}/cerrar`, { method: 'POST', token });
}

export function listarConvocatorias(token, actividadId) {
  return pedir(`/api/actividades/${actividadId}/convocatorias`, { token });
}

export function agregarEstudianteActividad(token, actividadId, estudianteId) {
  return pedir(`/api/actividades/${actividadId}/estudiantes`, {
    method: 'POST',
    token,
    body: { estudianteId: Number(estudianteId) }
  });
}

export function iniciarSesionActividad(token, actividadId) {
  return pedir(`/api/sesiones/actividades/${actividadId}/iniciar`, {
    method: 'POST',
    token
  });
}

export function consultarSesionActividad(token, actividadId) {
  return pedir(`/api/sesiones/actividades/${actividadId}`, { token });
}

export function obtenerSesion(token, sesionId) {
  return pedir(`/api/sesiones/${sesionId}`, { token });
}

export function guardarComentarioDocente(token, sesionId, comentarioDocente) {
  return pedir(`/api/sesiones/${sesionId}/comentario-docente`, {
    method: 'PUT',
    token,
    body: { comentarioDocente }
  });
}

export function finalizarSesion(token, sesionId) {
  return pedir(`/api/sesiones/${sesionId}/finalizar`, { method: 'POST', token });
}

export function registrarRespuesta(token, { sesionId, decisionId, opcionId }) {
  return pedir('/api/participacion/respuestas', {
    method: 'POST',
    token,
    body: {
      sesionId: Number(sesionId),
      decisionId: Number(decisionId),
      opcionId: Number(opcionId)
    }
  });
}

export function consultarRespuestasSesion(token, sesionId) {
  return pedir(`/api/participacion/sesiones/${sesionId}/respuestas`, { token });
}

export function consultarProgresoSesion(token, sesionId) {
  return pedir(`/api/participacion/sesiones/${sesionId}/progreso`, { token });
}

export function consultarRetroalimentacionSesion(token, sesionId) {
  return pedir(`/api/participacion/sesiones/${sesionId}/retroalimentacion`, { token });
}

export function listarNotificaciones(token) {
  return pedir('/api/notificaciones', { token });
}

export function marcarNotificacionLeida(token, id) {
  return pedir(`/api/notificaciones/${id}/leer`, {
    method: 'POST',
    token
  });
}

export function retirarEstudianteActividad(token, actividadId, estudianteId) {
  return pedir(`/api/actividades/${actividadId}/estudiantes/${estudianteId}`, {
    method: 'DELETE',
    token
  });
}

export function cerrarVencidasActividades(token) {
  return pedir('/api/actividades/cerrar-vencidas', { method: 'POST', token });
}

export function monitorearSesionesActividad(token, actividadId) {
  return pedir(`/api/sesiones/actividades/${actividadId}/monitor`, { token });
}

export function descargarReporteParticipacion(token, actividadId) {
  return pedir(`/api/sesiones/actividades/${actividadId}/reporte-participacion.csv`, {
    token,
    formato: 'text/csv'
  });
}

export function cerrarSesionDocente(token, sesionId) {
  return pedir(`/api/sesiones/${sesionId}/cerrar`, { method: 'POST', token });
}

/** —— Administración RF-03 —— */
export function adminListarRoles(token) {
  return pedir('/api/acceso/admin/roles', { token });
}

export function adminListarPermisos(token) {
  return pedir('/api/acceso/admin/permisos', { token });
}

export function adminCrearDocente(token, datos) {
  return pedir('/api/acceso/admin/docentes', { method: 'POST', token, body: datos });
}

export function adminCrearEstudiante(token, datos) {
  return pedir('/api/acceso/admin/estudiantes', { method: 'POST', token, body: datos });
}

export function adminAsignarRol(token, usuarioId, rol) {
  return pedir(`/api/acceso/admin/usuarios/${usuarioId}/roles`, {
    method: 'POST',
    token,
    body: { rol }
  });
}

export function adminQuitarRol(token, usuarioId, rol) {
  return pedir(`/api/acceso/admin/usuarios/${usuarioId}/roles/${encodeURIComponent(rol)}`, {
    method: 'DELETE',
    token
  });
}

export function adminAsignarPermiso(token, rol, permiso) {
  return pedir(`/api/acceso/admin/roles/${encodeURIComponent(rol)}/permisos`, {
    method: 'POST',
    token,
    body: { permiso }
  });
}

export function adminQuitarPermiso(token, rol, permiso) {
  return pedir(
    `/api/acceso/admin/roles/${encodeURIComponent(rol)}/permisos/${encodeURIComponent(permiso)}`,
    { method: 'DELETE', token }
  );
}

export function consultarSalud() {
  return pedir('/api/health');
}
