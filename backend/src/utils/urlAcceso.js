/**
 * URLs del frontend usadas en correos (convocatoria / acceso estudiante).
 */

export function urlBaseAcceso() {
  const bruto = String(process.env.URL_ACCESO || 'http://localhost:5173').trim();
  return bruto.replace(/\/+$/, '') || 'http://localhost:5173';
}

/** Enlace del correo: abre login de estudiante (y limpia sesión docente en el navegador). */
export function urlAccesoEstudiante({ correo } = {}) {
  const base = urlBaseAcceso();
  let url;
  try {
    url = new URL(base);
  } catch {
    url = new URL('http://localhost:5173');
  }
  url.searchParams.set('acceso', 'estudiante');
  const mail = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  if (mail) {
    url.searchParams.set('correo', mail);
  }
  return url.toString();
}
