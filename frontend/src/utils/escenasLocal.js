import { PORTADAS_DEMO } from '../data/portadasDemo';

const KEY = 'lumina.escenas.portadas';

function leerMapa() {
  try {
    const crudo = localStorage.getItem(KEY);
    if (!crudo) return {};
    const data = JSON.parse(crudo);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function guardarPortadaEscena(casoId, escenaClave, escenario) {
  if (!casoId || !escenaClave || !escenario) return;
  const mapa = leerMapa();
  const porCaso = { ...(mapa[String(casoId)] || {}) };
  porCaso[String(escenaClave)] = {
    escenarioId: escenario.id,
    titulo: escenario.titulo,
    imagen: escenario.imagen,
    categoriaNombre: escenario.categoriaNombre
  };
  mapa[String(casoId)] = porCaso;
  localStorage.setItem(KEY, JSON.stringify(mapa));
}

export function portadasDeCasoLocal(casoId) {
  return leerMapa()[String(casoId)] || {};
}

export function portadaEscena(casoIdOrCaso, escena, tituloCaso) {
  if (!escena) return null;
  const casoId = typeof casoIdOrCaso === 'object' ? casoIdOrCaso?.id : casoIdOrCaso;
  const titulo =
    tituloCaso ||
    (typeof casoIdOrCaso === 'object' ? casoIdOrCaso?.titulo : null);
  const material = typeof casoIdOrCaso === 'object' ? casoIdOrCaso?.material?.portadas : null;

  if (material && typeof material === 'object') {
    const remota =
      material[String(escena.id)] ||
      material[String(escena.orden)] ||
      material[String(escena.nombre)] ||
      null;
    if (remota) return remota;
  }

  const mapa = leerMapa();
  const porCaso = mapa[String(casoId)] || {};
  const local =
    porCaso[String(escena.id)] ||
    porCaso[String(escena.orden)] ||
    porCaso[String(escena.nombre)] ||
    null;
  if (local) return local;

  const demo = titulo ? PORTADAS_DEMO[titulo] : null;
  const imagen =
    demo?.[String(escena.orden)] ||
    demo?.[String(escena.nombre)] ||
    null;
  return imagen ? { imagen, titulo: escena.nombre } : null;
}
