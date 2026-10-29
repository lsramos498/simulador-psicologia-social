
function crearNotificacionInterna(evento) {
  if (!evento || evento.tipo !== 'participacionFinalizada') {
    return null;
  }

  return {
    estudianteId: evento.estudianteId,
    mensaje: 'Tu participación ha finalizado correctamente',
    leida: false
  };
}

module.exports = { crearNotificacionInterna };

