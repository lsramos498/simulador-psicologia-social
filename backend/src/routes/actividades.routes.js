import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { crearControladorActividades } from '../modules/actividades/actividades.controller.js';

export function crearRutasActividades(servicio) {
  const router = Router();
  const controlador = crearControladorActividades(servicio);

  router.post('/', autenticar, controlador.crear);
  router.get('/:id', autenticar, controlador.consultarPorId);
  router.post('/:id/iniciar', autenticar, controlador.iniciar);
  router.post('/:id/cerrar', autenticar, controlador.cerrar);

  return router;
}

let servicioPorDefecto;

async function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    const { crearRepositorioActividades } = await import('../modules/actividades/actividades.repository.js');
    const { crearServicioActividades } = await import('../modules/actividades/actividades.service.js');
    const { crearCodigoAutorizacion } = await import('../modules/acceso/codigos.js');
    const { crearServicioNotificaciones } = await import(
      '../modules/notificaciones/notificaciones.service.js'
    );

    const { crearTransporteSMTP } = await import(
      '../modules/notificaciones/notificaciones.smtp.js'
    );

    const transporte = crearTransporteSMTP();
    const notificaciones = crearServicioNotificaciones(transporte);

    servicioPorDefecto = crearServicioActividades(
      crearRepositorioActividades(pool),
      crearCodigoAutorizacion,
      () => new Date(),
      notificaciones
    );
  }

  return servicioPorDefecto;
}

const servicioLazy = {
  async crear(datos, docenteId) {
    return (await obtenerServicioPorDefecto()).crear(datos, docenteId);
  },
  async consultarPorId(actividadId) {
    return (await obtenerServicioPorDefecto()).consultarPorId(actividadId);
  },
  async iniciar(actividadId, docenteId) {
    return (await obtenerServicioPorDefecto()).iniciar(actividadId, docenteId);
  },
  async cerrar(actividadId, docenteId) {
    return (await obtenerServicioPorDefecto()).cerrar(actividadId, docenteId);
  }
};

export default crearRutasActividades(servicioLazy);
export async function ejecutarCierreAutomaticoActividades() {
  const servicio = await obtenerServicioPorDefecto();
  return servicio.cerrarVencidas();
}
