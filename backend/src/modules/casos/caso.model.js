/**
 * Estructura mínima de un caso académico (Stefanía — casos y rúbricas).
 * Más adelante se ampliará con escenarios, preguntas, opciones y rúbricas.
 */

export function crearCasoBase({ id, titulo, descripcion = '', estado = 'borrador' }) {
  if (id == null) {
    throw new Error('El caso requiere un id');
  }

  if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
    throw new Error('El caso requiere un título');
  }

  const estadosPermitidos = ['borrador', 'validado', 'habilitado'];
  if (!estadosPermitidos.includes(estado)) {
    throw new Error(`Estado de caso no válido: ${estado}`);
  }

  return {
    id,
    titulo: titulo.trim(),
    descripcion: typeof descripcion === 'string' ? descripcion.trim() : '',
    estado,
    escenarios: [],
    rubricaId: null,
    creadoEn: new Date().toISOString()
  };
}
