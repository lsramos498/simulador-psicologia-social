import { DIALOGOS_DEMO } from '../data/dialogosDemo';

const KEY = 'lumina.dialogos';

function leerTodo() {
  try {
    const crudo = localStorage.getItem(KEY);
    if (!crudo) return {};
    const data = JSON.parse(crudo);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function guardarDialogosCaso(casoId, dialogos) {
  const todo = leerTodo();
  todo[String(casoId)] = dialogos;
  localStorage.setItem(KEY, JSON.stringify(todo));
}

export function dialogosDeCaso(caso) {
  if (!caso) return {};
  const servidor = caso.material?.dialogos || {};
  const local = leerTodo()[String(caso.id)] || {};
  const demo = DIALOGOS_DEMO[caso.titulo] || {};
  // Prioridad: servidor (compartido) > local > demo
  return { ...demo, ...local, ...servidor };
}

/** Genera líneas útiles a partir del perfil del personaje y la escena. */
export function dialogosAutomaticos(personaje, escena, caso) {
  const nombre = personaje?.nombre || 'Persona';
  const rol = personaje?.rolSocial || 'testigo';
  const perfil = String(personaje?.perfil || '').trim();
  const pautas = String(personaje?.pautasComportamiento || '').trim();
  const lugar = escena?.nombre || 'este lugar';
  const contexto = String(escena?.contexto || caso?.contextoHistoria || '').trim();

  const lineas = [
    `${nombre}: Hola. Soy ${rol.toLocaleLowerCase('es')} aquí en ${lugar}. ¿Qué necesitas saber?`,
    perfil
      ? `${nombre}: ${perfil}`
      : `${nombre}: He visto parte de lo que está pasando, pero prefiero ir con cuidado.`,
    contexto
      ? `${nombre}: Sobre lo de «${lugar}»: ${contexto.slice(0, 180)}${contexto.length > 180 ? '…' : ''}`
      : `${nombre}: Si preguntas con respeto, te cuento lo que sé.`,
    pautas
      ? `${nombre}: Ten en cuenta esto: ${pautas}`
      : `${nombre}: Te recomiendo contrastar mi versión con la de otras personas.`
  ];
  return lineas;
}

/**
 * dialogos shape:
 * {
 *   "Andrés": {
 *     "1": ["texto1", "texto2"],
 *     "Recepcion...": ["..."]
 *   }
 * }
 */
export function dialogosDePersonaje(caso, nombrePersonaje, escena) {
  const mapa = dialogosDeCaso(caso);
  const porPj = mapa[nombrePersonaje] || {};
  const claveEscena = escena?.id ?? escena?.orden ?? escena?.nombre;
  const lineas =
    porPj[String(claveEscena)] ||
    porPj[String(escena?.orden)] ||
    porPj[String(escena?.nombre)] ||
    null;
  if (Array.isArray(lineas) && lineas.length) return lineas;
  return dialogosAutomaticos(
    (caso.personajes || []).find((p) => p.nombre === nombrePersonaje) || {
      nombre: nombrePersonaje
    },
    escena,
    caso
  );
}
