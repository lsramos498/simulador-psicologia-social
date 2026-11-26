import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES, tieneRol } from '../modules/acceso/autorizacion.js';

function responder(res, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(status).json({
    error: status >= 500
      ? 'Ocurrió un error interno al procesar la solicitud.'
      : error.message
  });
}

export function crearRutasGrupos(servicio) {
  const router = Router();
  const docenteOAdmin = [autenticar, requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR)];

  router.get('/', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.listar(req.usuario.id, {
        esAdmin: tieneRol(req.usuario, ROLES.ADMINISTRADOR)
      });
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.post('/', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.crear(req.body, req.usuario.id);
      return res.status(201).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.get('/:id', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.obtener(req.params.id, req.usuario.id, {
        esAdmin: tieneRol(req.usuario, ROLES.ADMINISTRADOR)
      });
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.post('/:id/estudiantes', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.asignarEstudiantes(
        req.params.id,
        req.body?.estudiantesIds,
        req.usuario.id,
        { esAdmin: tieneRol(req.usuario, ROLES.ADMINISTRADOR) }
      );
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.delete('/:id/estudiantes/:estudianteId', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.retirarEstudiante(
        req.params.id,
        req.params.estudianteId,
        req.usuario.id,
        { esAdmin: tieneRol(req.usuario, ROLES.ADMINISTRADOR) }
      );
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
    const { crearRepositorioGrupos } = await import('../modules/grupos/grupos.repository.js');
    const { crearServicioGrupos } = await import('../modules/grupos/grupos.service.js');
    servicioPorDefecto = crearServicioGrupos(crearRepositorioGrupos(pool));
  }
  return servicioPorDefecto;
}

const servicioLazy = {
  listar(...args) {
    return obtenerServicioPorDefecto().then((s) => s.listar(...args));
  },
  crear(...args) {
    return obtenerServicioPorDefecto().then((s) => s.crear(...args));
  },
  obtener(...args) {
    return obtenerServicioPorDefecto().then((s) => s.obtener(...args));
  },
  asignarEstudiantes(...args) {
    return obtenerServicioPorDefecto().then((s) => s.asignarEstudiantes(...args));
  },
  retirarEstudiante(...args) {
    return obtenerServicioPorDefecto().then((s) => s.retirarEstudiante(...args));
  },
  idsDeGrupo(...args) {
    return obtenerServicioPorDefecto().then((s) => s.idsDeGrupo(...args));
  }
};

export default crearRutasGrupos(servicioLazy);
