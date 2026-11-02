import { Router } from 'express';
import {
  crearControladorActividades
} from '../modules/actividades/actividades.controller.js';

export function crearRutasActividades(servicio) {
  const router = Router();
  const controlador = crearControladorActividades(servicio);

  router.post('/', controlador.crear);
  router.get('/:id', controlador.consultarPorId);

  return router;
}
