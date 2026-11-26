import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';

const ESTADOS_HTTP = {
  SESION_NO_EXISTE: 404,
  SESION_AJENA: 403,
  ESTADO_NO_PERMITIDO: 409,
  OPCION_INVALIDA: 422,
  RESPUESTA_DUPLICADA: 409,
  RESPUESTA_NO_MODIFICABLE: 409,
  TIEMPO_AGOTADO: 409,
  FUERA_DE_VENTANA: 403,
  ACTIVIDAD_NO_INICIADA: 409,
  NO_AUTORIZADO: 403
};

function responder(res, error) {
  if (error instanceof TypeError) {
    return res.status(400).json({ error: error.message });
  }

  const status = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : (ESTADOS_HTTP[error?.codigo] ?? 500);
  if (status >= 500) {
    console.error('Error en participación:', error?.code || error?.message);
    return res.status(500).json({ error: 'Ocurrió un error interno al procesar la solicitud.' });
  }

  return res.status(status).json({ error: error.message, codigo: error.codigo });
}

export function crearRutasParticipacion(obtenerServicio, opciones = {}) {
  const router = Router();

  async function atender(req, res, accion, status) {
    try {
      if (opciones.antes) await opciones.antes();
      const servicio = await obtenerServicio();
      const data = await accion(servicio, req);
      return res.status(status).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  }

  router.post('/respuestas', autenticar, (req, res) => atender(
    req,
    res,
    (servicio) => servicio.registrar(req.body, req.usuario.id),
    201
  ));

  router.get('/sesiones/:sesionId/respuestas', autenticar, (req, res) => atender(
    req,
    res,
    (servicio) => servicio.consultar(Number(req.params.sesionId), req.usuario),
    200
  ));

  router.get('/sesiones/:sesionId/progreso', autenticar, (req, res) => atender(
    req,
    res,
    (servicio) => servicio.progreso(Number(req.params.sesionId), req.usuario),
    200
  ));

  router.get('/sesiones/:sesionId/retroalimentacion', autenticar, (req, res) => atender(
    req,
    res,
    (servicio) => servicio.retroalimentacion(Number(req.params.sesionId), req.usuario),
    200
  ));

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

export default crearRutasParticipacion(obtenerServicioPorDefecto, {
  antes: async () => {
    const { obtenerServicioSesiones } = await import('./sesiones.routes.js');
    await (await obtenerServicioSesiones()).cerrarVencidas();
  }
});
