import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereActividadAutorizada, requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES, tieneRol } from '../modules/acceso/autorizacion.js';
import { responderErrorHttp } from '../modules/acceso/errores.js';
import { generarReporteParticipacion } from '../modules/sesiones/reporteParticipacion.js';

export function crearRutasSesiones(obtenerServicio) {
  const router = Router();

  router.post(
    '/actividades/:actividadId/iniciar',
    autenticar,
    requiereRol(ROLES.ESTUDIANTE),
    requiereActividadAutorizada((req) => req.params.actividadId),
    async (req, res) => {
      try {
        const data = await (await obtenerServicio()).iniciarPropia(
          Number(req.params.actividadId),
          req.usuario.id
        );
        return res.status(200).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'sesiones');
      }
    }
  );

  router.get(
    '/actividades/:actividadId/monitor',
    autenticar,
    requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR),
    async (req, res) => {
      try {
        const actividadId = Number(req.params.actividadId);
        const data = await (await obtenerServicio()).listarPorActividad(
          actividadId,
          {
            id: req.usuario.id,
            esAdmin: tieneRol(req.usuario, ROLES.ADMINISTRADOR)
          }
        );
        return res.status(200).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'sesiones');
      }
    }
  );

  router.get(
    '/actividades/:actividadId/reporte-participacion.csv',
    autenticar,
    requiereRol(ROLES.DOCENTE),
    async (req, res) => {
      try {
        if (tieneRol(req.usuario, ROLES.ADMINISTRADOR)) {
          return res.status(403).json({ error: 'Solo el docente creador puede descargar el reporte.' });
        }
        const actividadId = Number(req.params.actividadId);
        const filas = await (await obtenerServicio()).consultarReporteParticipacion(
          actividadId,
          req.usuario.id
        );
        return res
          .attachment(`participacion-actividad-${actividadId}.csv`)
          .type('text/csv')
          .set('Cache-Control', 'no-store')
          .send(generarReporteParticipacion(filas));
      } catch (error) {
        return responderErrorHttp(res, error, 'sesiones');
      }
    }
  );

  router.get(
    '/actividades/:actividadId',
    autenticar,
    requiereActividadAutorizada((req) => req.params.actividadId),
    async (req, res) => {
      try {
        const data = await (await obtenerServicio()).consultarPropia(
          Number(req.params.actividadId),
          req.usuario.id
        );
        return res.status(200).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'sesiones');
      }
    }
  );

  router.get('/:id', autenticar, async (req, res) => {
    try {
      const data = await (await obtenerServicio()).consultar(Number(req.params.id), {
        id: req.usuario.id,
        esAdmin: tieneRol(req.usuario, ROLES.ADMINISTRADOR)
      });
      return res.status(200).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'sesiones');
    }
  });

  router.put(
    '/:id/comentario-docente',
    autenticar,
    requiereRol(ROLES.DOCENTE),
    async (req, res) => {
      try {
        const { creado, comentarioDocente } = await (await obtenerServicio()).guardarComentarioDocente(
          Number(req.params.id),
          req.usuario.id,
          req.body?.comentarioDocente
        );
        return res.status(creado ? 201 : 200).json({ data: { comentarioDocente } });
      } catch (error) {
        return responderErrorHttp(res, error, 'sesiones');
      }
    }
  );

  router.post('/:id/finalizar', autenticar, async (req, res) => {
    try {
      const data = await (await obtenerServicio()).finalizarPropia(
        Number(req.params.id),
        req.usuario.id
      );
      return res.status(200).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'sesiones');
    }
  });

  router.post(
    '/:id/cerrar',
    autenticar,
    requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR),
    async (req, res) => {
      try {
        const data = await (await obtenerServicio()).cerrarPorDocente(
          Number(req.params.id),
          req.usuario.id,
          new Date(),
          tieneRol(req.usuario, ROLES.ADMINISTRADOR)
        );
        return res.status(200).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'sesiones');
      }
    }
  );

  return router;
}

let servicioPorDefecto;

export async function obtenerServicioSesiones() {
  if (!servicioPorDefecto) {
    const { pool } = await import('../config/database.js');
    const { crearRepositorioSesiones } = await import('../modules/sesiones/sesiones.repository.js');
    const { crearServicioSesiones } = await import('../modules/sesiones/sesiones.service.js');
    servicioPorDefecto = crearServicioSesiones(crearRepositorioSesiones(pool));
  }
  return servicioPorDefecto;
}

export default crearRutasSesiones(obtenerServicioSesiones);
