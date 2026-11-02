function obtenerDocenteAutenticado(req) {
  const docenteId = Number(req.usuario?.id);

  if (!Number.isSafeInteger(docenteId) || docenteId <= 0) {
    return null;
  }

  return docenteId;
}

function responderError(res, error) {
  const status = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : 500;

  return res.status(status).json({
    error: status >= 500
      ? 'Ocurrió un error interno al procesar la solicitud.'
      : error.message
  });
}

export function crearControladorActividades(servicio) {
  if (
    !servicio ||
    typeof servicio.crear !== 'function' ||
    typeof servicio.consultarPorId !== 'function'
  ) {
    throw new TypeError('Se requiere un servicio de actividades válido.');
  }

  return {
    async crear(req, res) {
      const docenteId = obtenerDocenteAutenticado(req);

      if (!docenteId) {
        return res.status(401).json({
          error: 'Se requiere una sesión autenticada de docente.'
        });
      }

      try {
        const resultado = await servicio.crear(req.body, docenteId);

        // Los códigos de autorización no deben exponerse en la respuesta HTTP.
        const {
          estudiantesAutorizados: codigosInternos,
          ...resultadoPublico
        } = resultado;

        return res.status(201).json({
          mensaje: 'Actividad programada correctamente.',
          data: resultadoPublico
        });
      } catch (error) {
        return responderError(res, error);
      }
    },

    async consultarPorId(req, res) {
      const docenteId = obtenerDocenteAutenticado(req);

      if (!docenteId) {
        return res.status(401).json({
          error: 'Se requiere una sesión autenticada.'
        });
      }

      try {
        const actividad = await servicio.consultarPorId(req.params.id);

        if (Number(actividad.docenteId) !== docenteId) {
          return res.status(403).json({
            error: 'No tiene autorización para consultar esta actividad.'
          });
        }

        return res.status(200).json({
          data: actividad
        });
      } catch (error) {
        return responderError(res, error);
      }
    }
  };
}
