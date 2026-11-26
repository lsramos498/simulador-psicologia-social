/** Destino de acceso desde el correo (convocatoria / login estudiante). */

export function leerParamsAcceso() {
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = String(window.location.hash || '').replace(/^#/, '');
    const verResultado =
      params.get('ver') === 'resultado' ||
      hash === 'resultado' ||
      hash === 'ver-resultado' ||
      hash.includes('resultado');
    const accesoEstudiante =
      params.get('acceso') === 'estudiante' ||
      params.get('modo') === 'estudiante' ||
      params.has('ingreso') ||
      hash === 'estudiante' ||
      hash === 'acceso-estudiante';
    const correo = String(params.get('correo') || '').trim();
    /** Cualquier enlace de correo que deba forzar login de estudiante (no panel docente). */
    const forzarLoginEstudiante = verResultado || accesoEstudiante;
    return { verResultado, accesoEstudiante, forzarLoginEstudiante, correo };
  } catch {
    return {
      verResultado: false,
      accesoEstudiante: false,
      forzarLoginEstudiante: false,
      correo: ''
    };
  }
}

export function limpiarParamsAcceso() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('ver');
    url.searchParams.delete('acceso');
    url.searchParams.delete('modo');
    url.searchParams.delete('correo');
    url.searchParams.delete('ingreso');
    if (
      url.hash.includes('resultado') ||
      url.hash.includes('estudiante')
    ) {
      url.hash = '';
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}
