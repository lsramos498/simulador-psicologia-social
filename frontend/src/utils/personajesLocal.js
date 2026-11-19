const KEY = 'lumina.personajes.custom';

export function leerPersonajesCustom() {
  try {
    const crudo = localStorage.getItem(KEY);
    if (!crudo) return [];
    const lista = JSON.parse(crudo);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function guardarPersonajesCustom(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}

export function agregarPersonajeCustom(personaje) {
  const lista = leerPersonajesCustom();
  const nuevo = {
    ...personaje,
    id: personaje.id || `custom-${Date.now()}`,
    custom: true
  };
  const actualizada = [...lista.filter((p) => p.id !== nuevo.id), nuevo];
  guardarPersonajesCustom(actualizada);
  return nuevo;
}

export function imagenDeNombre(nombre, banco) {
  if (!nombre) return null;
  const clave = String(nombre).toLocaleLowerCase('es');
  const hallado = (banco || []).find((p) => p.nombre.toLocaleLowerCase('es') === clave);
  return hallado?.imagen || null;
}
