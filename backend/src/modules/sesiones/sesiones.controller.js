
function responderError(res, error, contexto) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.message
    });
  }

  console.error(`Error en ${contexto}:`, error.code || error.message);

  return res.status(500).json({
    error: 'Error interno del servidor'
  });
}

export function crearControladorSesiones(servicio) {
  async function iniciar(req, res) {
    try {
      const actividadId = Number(req.params.actividadId);
      const estudianteId = Number(req.usuario?.id);

      const sesion = await servicio.iniciarSesion({
        actividadId,
        estudianteId
      });

      return res.status(200).json({
        mensaje: 'Sesión iniciada correctamente.',
        sesion
      });
    } catch (error) {
      return responderError(res, error, 'inicio de sesión');
    }
  }

  async function finalizar(req, res) {
    try {
      const sesionId = Number(req.params.sesionId);
      const estudianteId = Number(req.usuario?.id);
      const { motivoCierre } = req.body ?? {};

      const sesion = await servicio.finalizarSesion({
        sesionId,
        estudianteId,
        motivoCierre
      });

      return res.status(200).json({
        mensaje: 'Sesión finalizada correctamente.',
        sesion
      });
    } catch (error) {
      return responderError(res, error, 'finalización de sesión');
    }
  }

  return {
    iniciar,
    finalizar
  };
}
