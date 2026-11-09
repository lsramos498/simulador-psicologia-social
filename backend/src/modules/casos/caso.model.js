/**
 * Modelo de dominio del Caso académico (Stefanía Díaz — RF-05 a RF-09, RF-17).
 *
 * El estado vive en MySQL (`Caso.estado`). Aquí solo se exponen las constantes
 * compartidas para no repetir literales mágicos en servicio, validación y pruebas.
 */
export { ESTADOS_CASO } from './caso.validacion.js';

export const ESTADOS_EDITABLES = Object.freeze(['Borrador']);
export const ESTADOS_NO_EDITABLES = Object.freeze(['Publicado', 'Archivado']);
