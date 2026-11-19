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
    : error instanceof TypeError
      ? 400
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

        // El arreglo interno no sale. El docente recibe los códigos una sola vez:
        // el correo todavía no tiene transporte, y el hash guardado no se puede leer después.
        const {
          estudiantesAutorizados: codigosInternos,
          ...resultadoPublico
        } = resultado;
        const codigosDeAcceso = Array.isArray(codigosInternos)
          ? codigosInternos.map(({ estudianteId, codigoAutorizacion }) => ({
            estudianteId,
            codigo: codigoAutorizacion
          }))
          : [];

        return res.status(201).json({
          mensaje: 'Actividad programada correctamente.',
          data: {
            ...resultadoPublico,
            codigosDeAcceso
          }
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
        const actividad = await servicio.consultarPorId(Number(req.params.id));

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
    },

    async iniciar(req, res) {
      return cambiarEstado(servicio.iniciar, req, res, async (actividadId) => {
        if (typeof servicio.alIniciar === 'function') {
          await servicio.alIniciar(actividadId);
        }
      });
    },

    async cerrar(req, res) {
      return cambiarEstado(servicio.cerrar, req, res);
    }
  };
}

async function cambiarEstado(operacion, req, res, despues) {
  const docenteId = obtenerDocenteAutenticado(req);

  if (!docenteId) {
    return res.status(401).json({
      error: 'Se requiere una sesión autenticada de docente.'
    });
  }

  try {
    const actividadId = Number(req.params.id);
    const data = await operacion(actividadId, docenteId);
    if (despues) await despues(actividadId);
    return res.status(200).json({ data });
  } catch (error) {
    return responderError(res, error);
  }
}
