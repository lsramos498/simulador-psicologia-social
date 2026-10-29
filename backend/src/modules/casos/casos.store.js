import { crearCasoBase } from './caso.model.js';

/**
 * Almacén temporal en memoria para el avance inicial.
 * Se reemplazará por persistencia MySQL en commits posteriores.
 */
const casos = [
  crearCasoBase({
    id: 1,
    titulo: 'Conflicto en el aula',
    descripcion: 'Caso de ejemplo para probar consulta de casos académicos.',
    estado: 'borrador'
  }),
  crearCasoBase({
    id: 2,
    titulo: 'Presión de grupo en redes',
    descripcion: 'Segundo caso de ejemplo para listados iniciales.',
    estado: 'validado'
  })
];

export function listarCasos() {
  return [...casos];
}

export function obtenerCasoPorId(id) {
  const casoId = Number(id);
  return casos.find((caso) => caso.id === casoId) ?? null;
}

export function _resetStoreForTests(nuevosCasos = []) {
  casos.length = 0;
  casos.push(...nuevosCasos);
}
