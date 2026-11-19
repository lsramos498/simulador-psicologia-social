/**
 * Modelo de dominio del Caso académico (Stefanía Díaz — RF-05 a RF-09, RF-17).
 *
 * El estado vive en MySQL (`Caso.estado`). Aquí solo se exponen las constantes
 * compartidas para no repetir literales mágicos en servicio, validación y pruebas.
 *
 * Ciclo de vida del caso:
 *   Borrador → Publicado → Archivado
 *   (también se puede archivar un Borrador; un caso Archivado no vuelve atrás).
 */

/**
 * Estados válidos de un caso (se reexporta desde la validación para tener una
 * única fuente de verdad).
 * @type {Readonly<{ BORRADOR: 'Borrador', PUBLICADO: 'Publicado', ARCHIVADO: 'Archivado' }>}
 */
export { ESTADOS_CASO } from './caso.validacion.js';

/**
 * Estados en los que el docente puede modificar el caso (escenas, preguntas,
 * opciones, rúbrica). Solo el Borrador es editable.
 * @type {ReadonlyArray<string>}
 */
export const ESTADOS_EDITABLES = Object.freeze(['Borrador']);

/**
 * Estados en los que el caso queda bloqueado: un caso Publicado ya puede
 * programarse en actividades y un Archivado se conserva solo como histórico.
 * @type {ReadonlyArray<string>}
 */
export const ESTADOS_NO_EDITABLES = Object.freeze(['Publicado', 'Archivado']);
