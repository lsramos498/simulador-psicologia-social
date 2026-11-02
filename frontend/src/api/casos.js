async function solicitar(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {})
    }
  });

  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(cuerpo.error || 'No se pudo completar la operación.');
    error.errores = Array.isArray(cuerpo.errores) ? cuerpo.errores : [];
    error.status = respuesta.status;
    throw error;
  }

  return cuerpo.data ?? cuerpo;
}

export const apiCasos = {
  listar(creadorId) {
    return solicitar(`/api/casos?creadorId=${encodeURIComponent(creadorId)}`);
  },
  obtener(id) {
    return solicitar(`/api/casos/${id}`);
  },
  crear(datos) {
    return solicitar('/api/casos', { method: 'POST', body: JSON.stringify(datos) });
  },
  construir(datos) {
    return solicitar('/api/casos/construir', { method: 'POST', body: JSON.stringify(datos) });
  },
  actualizar(id, datos) {
    return solicitar(`/api/casos/${id}`, { method: 'PATCH', body: JSON.stringify(datos) });
  },
  publicar(id) {
    return solicitar(`/api/casos/${id}/publicar`, { method: 'POST' });
  },
  archivar(id) {
    return solicitar(`/api/casos/${id}/archivar`, { method: 'POST' });
  },
  agregarEscena(id, datos) {
    return solicitar(`/api/casos/${id}/escenas`, { method: 'POST', body: JSON.stringify(datos) });
  },
  agregarDecision(casoId, escenaId, datos) {
    return solicitar(`/api/casos/${casoId}/escenas/${escenaId}/decisiones`, {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },
  agregarOpcion(casoId, decisionId, datos) {
    return solicitar(`/api/casos/${casoId}/decisiones/${decisionId}/opciones`, {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },
  guardarRubrica(id, datos) {
    return solicitar(`/api/casos/${id}/rubrica`, { method: 'PUT', body: JSON.stringify(datos) });
  }
};
