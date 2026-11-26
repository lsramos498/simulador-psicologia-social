/** Limpia títulos contaminados por importación de PDF/TXT. */
export function tituloCasoLimpio(titulo, fallback = 'Caso situacional') {
  const bruto = String(titulo || '').trim();
  if (!bruto) return fallback;
  const porTitulo = bruto.match(/t[ií]tulo\s*:\s*([^]+?)(?=\s+desarrollo|\s+contexto|$)/i);
  if (porTitulo?.[1]) return porTitulo[1].trim().slice(0, 120);
  const cortado = bruto
    .split(/\s+Desarrollo|\s+Contexto|\s+Documento de prueba/i)[0]
    .trim();
  return (cortado || bruto).slice(0, 120);
}
