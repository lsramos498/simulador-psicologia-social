import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';

const ESTADOS_HTTP = {
  SESION_NO_EXISTE: 404,
  SESION_AJENA: 403,
  ESTADO_NO_PERMITIDO: 409,
  OPCION_INVALIDA: 422,
  RESPUESTA_DUPLICADA: 409,
  RESPUESTA_NO_MODIFICABLE: 409
};

function responder(res, error) {
  if (error instanceof TypeError) {
    return res.status(400).json({ error: error.message });
  }

  const status = ESTADOS_HTTP[error?.codigo] ?? 500;
  if (status >= 500) {
    console.error('Error en participación:', error?.code || error?.message);
    return res.status(500).json({ error: 'Ocurrió un error interno al procesar la solicitud.' });
  }

  return res.status(status).json({ error: error.message, codigo: error.codigo });
}

export function crearRutasParticipacion(obtenerServicio) {
  const router = Router();

  router.post('/respuestas', autenticar, async (req, res) => {
    try {
      const servicio = await obtenerServicio();
      const data = await servicio.registrar(req.body, req.usuario.id);
      return res.status(201).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.get('/sesiones/:sesionId/respuestas', autenticar, async (req, res) => {
    try {
      const servicio = await obtenerServicio();
      const data = await servicio.consultar(Number(req.params.sesionId), req.usuario.id);
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    const { crearRepositorioParticipacion } = await import('../modules/participacion/participacion.repository.js');
    const { crearServicioParticipacion } = await import('../modules/participacion/participacion.service.js');
    servicioPorDefecto = crearServicioParticipacion(crearRepositorioParticipacion(pool));
  }

  return servicioPorDefecto;
}

export default crearRutasParticipacion(obtenerServicioPorDefecto);
