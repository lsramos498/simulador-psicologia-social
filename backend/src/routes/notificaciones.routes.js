import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { responderErrorHttp } from '../modules/acceso/errores.js';

export function crearRutasNotificaciones(obtenerServicio) {
  const router = Router();

  router.get('/', autenticar, async (req, res) => {
    try {
      const data = await (await obtenerServicio()).listarPropias(req.usuario?.id);
      return res.status(200).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'notificaciones');
    }
  });

  router.post('/:id/leer', autenticar, async (req, res) => {
    try {
      const data = await (await obtenerServicio()).marcarLeida(
        Number(req.params.id),
        req.usuario?.id
      );
      return res.status(200).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'notificaciones');
    }
  });

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    const { crearRepositorioNotificaciones } = await import(
      '../modules/notificaciones/notificaciones.repository.js'
    );
    const { crearTransporteNotificaciones } = await import(
      '../modules/notificaciones/notificaciones.transporte.js'
    );
    const { crearServicioNotificaciones } = await import(
      '../modules/notificaciones/notificaciones.service.js'
    );
    const repositorio = crearRepositorioNotificaciones(pool);
    const transporte = await crearTransporteNotificaciones(repositorio);
    servicioPorDefecto = crearServicioNotificaciones(transporte, repositorio);
  }
  return servicioPorDefecto;
}

export default crearRutasNotificaciones(obtenerServicioPorDefecto);
