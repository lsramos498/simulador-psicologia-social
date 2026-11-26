/** Índice decisiónId → { pregunta, opciones: Map(opcionId → texto) } */
export function mapaDecisionesCaso(caso) {
  const mapa = new Map();
  for (const escena of caso?.escenas || []) {
    for (const d of escena.decisiones || []) {
      const opciones = new Map();
      for (const op of d.opciones || []) {
        opciones.set(Number(op.id), {
          texto: op.texto,
          esCorrecta: Boolean(op.esCorrecta),
          explicacion: op.explicacion || ''
        });
      }
      mapa.set(Number(d.id), {
        pregunta: d.pregunta || `Pregunta #${d.id}`,
        escena: escena.nombre || null,
        opciones
      });
    }
  }
  return mapa;
}

export function enriquecerRespuestas(respuestas, caso) {
  const mapa = mapaDecisionesCaso(caso);
  return (Array.isArray(respuestas) ? respuestas : []).map((r, idx) => {
    const dec = mapa.get(Number(r.decisionId));
    const op = dec?.opciones?.get(Number(r.opcionId));
    const esCorrecta =
      op?.esCorrecta != null
        ? op.esCorrecta
        : r.esCorrecta == null
          ? null
          : Boolean(r.esCorrecta);
    return {
      key: r.id || `${r.decisionId}-${idx}`,
      pregunta: dec?.pregunta || r.pregunta || `Decisión #${r.decisionId}`,
      escena: dec?.escena || r.escenaNombre || null,
      opcionTexto:
        op?.texto ||
        r.opcionTexto ||
        (r.opcionId != null ? `Opción #${r.opcionId}` : '—'),
      esCorrecta,
      explicacion: op?.explicacion || r.explicacion || '',
      fechaRespuesta: r.fechaRespuesta || null
    };
  });
}
