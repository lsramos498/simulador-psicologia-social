
function puedeModificarRespuesta(participacionFinalizada) {
  if (participacionFinalizada === true) {
    return false;
  }

  return true;
}

module.exports = { puedeModificarRespuesta };

