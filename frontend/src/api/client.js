const TOKEN_KEY = 'lumina.token';
const USUARIO_KEY = 'lumina.usuario';

export function guardarSesion({ token, usuario }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

export function limpiarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USUARIO_KEY);
}

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

export function ingresarDocente({ correo, contrasena }) {
  return pedir('/api/acceso/ingreso', {
    method: 'POST',
    body: { correo, contrasena }
  });
}

export function listarCasos(token, { estado, creadorId } = {}) {
  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (creadorId) params.set('creadorId', String(creadorId));
  const query = params.toString();
  return pedir(`/api/casos${query ? `?${query}` : ''}`, { token });
}

export function obtenerCaso(token, id) {
  return pedir(`/api/casos/${id}`, { token });
}

export function crearCaso(token, datos) {
  return pedir('/api/casos', {
    method: 'POST',
    token,
    body: datos
  });
}

export function construirCaso(token, datos) {
  return pedir('/api/casos/construir', {
    method: 'POST',
    token,
    body: datos
  });
}

export function publicarCaso(token, id) {
  return pedir(`/api/casos/${id}/publicar`, {
    method: 'POST',
    token
  });
}

export function archivarCaso(token, id) {
  return pedir(`/api/casos/${id}/archivar`, {
    method: 'POST',
    token
  });
}
