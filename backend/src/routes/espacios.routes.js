import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES } from '../modules/acceso/autorizacion.js';
import { responderErrorHttp } from '../modules/acceso/errores.js';

export function crearRutasEspacios(obtenerServicio) {
  const router = Router();

  router.use(autenticar, requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR));

  router.get('/', async (_req, res) => {
    try {
      const data = await (await obtenerServicio()).listar();
      return res.status(200).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'espacios académicos');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const data = await (await obtenerServicio()).crear(req.body);
      return res.status(201).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'espacios académicos');
    }
  });

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    const { crearRepositorioEspacios } = await import('../modules/espacios/espacios.repository.js');
    const { crearServicioEspacios } = await import('../modules/espacios/espacios.service.js');
    servicioPorDefecto = crearServicioEspacios(crearRepositorioEspacios(pool));
  }
  return servicioPorDefecto;
}

export default crearRutasEspacios(obtenerServicioPorDefecto);
