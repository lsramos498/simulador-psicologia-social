/** Helpers de UI para el taller de casos (estado, errores, checklist de publicación). */

export function esEditable(estado) {
  return String(estado || '') === 'Borrador';
}

export function pillEstado(estado) {
  const clave = String(estado || '').toLowerCase();
  if (clave === 'publicado') return 'pill pill-publicado';
  if (clave === 'archivado') return 'pill pill-archivado';
  return 'pill pill-borrador';
}

export function mensajeError(err) {
  if (!err) return '';
  const detalle = Array.isArray(err.errores) ? err.errores.join(' ') : '';
  return `${err.message || 'Error'}${detalle ? ` — ${detalle}` : ''}`;
}

/**
 * Checklist local espejo de `validarParaPublicar` (backend).
 * No reemplaza la validación del servidor; solo guía al docente.
 */
export function checklistPublicacion(caso) {
  const items = [];
  const escenas = Array.isArray(caso?.escenas) ? caso.escenas : [];
  const decisiones = escenas.flatMap((e) => e.decisiones ?? []);

  items.push({
    ok: Boolean(caso?.titulo && caso?.desarrolloSituacional && caso?.contextoHistoria),
    texto: 'Datos básicos completos'
  });
  items.push({
    ok: (caso?.personajes?.length || 0) >= 1,
    texto: 'Al menos un personaje en el caso'
  });
  items.push({
    ok: escenas.length >= 1,
    texto: 'Al menos una escena'
  });
  items.push({
    ok: decisiones.length >= 1,
    texto: 'Al menos una pregunta'
  });

  let opcionesOk = decisiones.length > 0;
  for (const decision of decisiones) {
    const opciones = decision.opciones ?? [];
    if (opciones.length < 2) opcionesOk = false;
    if (!opciones.some((o) => o.esCorrecta === true)) opcionesOk = false;
    if (opciones.some((o) => !String(o.explicacion || '').trim())) opcionesOk = false;
  }
  items.push({
    ok: opcionesOk,
    texto: 'Cada pregunta: ≥2 opciones, 1 correcta y explicación'
  });
  items.push({
    ok: Boolean(caso?.rubrica?.nombre),
    texto: 'Evaluación lista'
  });

  return items;
}
