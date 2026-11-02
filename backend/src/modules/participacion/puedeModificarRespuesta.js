function puedeModificarRespuesta(participacionFinalizada) {
  if (typeof participacionFinalizada !== 'boolean') {
    throw new TypeError(
      'El estado de finalización debe ser verdadero o falso'
    );
  }

  return !participacionFinalizada;
}

export { puedeModificarRespuesta };