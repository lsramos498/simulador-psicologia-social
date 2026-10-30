import { listarCasos, obtenerCasoPorId } from './casos.store.js';

export function consultarCasos() {
  return listarCasos();
}

export function consultarCasoPorId(id) {
  const caso = obtenerCasoPorId(id);

  if (!caso) {
    const error = new Error(`No se encontró el caso con id ${id}`);
    error.statusCode = 404;
    throw error;
  }

  return caso;
}
