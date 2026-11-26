/** Formato corto fecha+hora para UI docente/estudiante (es-CO). */
export function formatearFecha(valor) {
  if (valor == null || valor === '') return '—';
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return String(valor);
  }
}
