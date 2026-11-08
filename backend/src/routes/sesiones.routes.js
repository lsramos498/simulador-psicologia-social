
import { Router } from 'express';
import { crearControladorSesiones } from '../modules/sesiones/sesiones.controller.js';
import { crearRepositorioSesiones } from '../modules/sesiones/sesiones.repository.js';
import { crearServicioSesiones } from '../modules/sesiones/sesiones.service.js';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES } from '../modules/acceso/autorizacion.js';

export function crearRutasSesiones(obtenerServicio) {
  const router = Router();

  router.post(
    '/actividades/:actividadId/iniciar',
    autenticar,
    requiereRol(ROLES.ESTUDIANTE),
    async (req, res) => {
      const controlador = crearControladorSesiones(
        await obtenerServicio()
      );

      return controlador.iniciar(req, res);
    }
  );

  router.post(
    '/:sesionId/finalizar',
    autenticar,
    requiereRol(ROLES.ESTUDIANTE),
    async (req, res) => {
      const controlador = crearControladorSesiones(
        await obtenerServicio()
      );

      return controlador.finalizar(req, res);
    }
  );

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');

    const repositorio = crearRepositorioSesiones(pool);

    servicioPorDefecto = crearServicioSesiones(repositorio);
  }

  return servicioPorDefecto;
}

export default crearRutasSesiones(obtenerServicioPorDefecto);
