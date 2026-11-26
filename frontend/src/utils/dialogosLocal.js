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

/** Genera pistas / fragmentos de historia (no entrevista). */
export function dialogosAutomaticos(personaje, escena, caso) {
  const nombre = personaje?.nombre || 'Persona';
  const rol = personaje?.rolSocial || 'participante';
  const perfil = String(personaje?.perfil || '').trim();
  const pautas = String(personaje?.pautasComportamiento || '').trim();
  const lugar = escena?.nombre || 'este lugar';
  const contexto = String(escena?.contexto || caso?.contextoHistoria || '').trim();

  const lineas = [
    `${nombre} (${rol}): En ${lugar} se siente la tensión. Esto es lo que alcanzo a aportar.`,
    perfil
      ? `${nombre}: ${perfil}`
      : `${nombre}: Vi solo una parte de lo que pasó; mi versión es incompleta.`,
    contexto
      ? `${nombre}: Pista sobre este lugar: ${contexto.slice(0, 200)}${contexto.length > 200 ? '…' : ''}`
      : `${nombre}: Si contrastas mi relato con el de otros, vas a notar huecos.`,
    pautas
      ? `${nombre}: Fíjate en esto: ${pautas}`
      : `${nombre}: No te quedes solo conmigo: cada persona suma un pedazo distinto de la historia.`
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
