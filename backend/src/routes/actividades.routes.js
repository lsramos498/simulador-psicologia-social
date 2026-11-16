import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES, tieneRol } from '../modules/acceso/autorizacion.js';
import { crearControladorActividades } from '../modules/actividades/actividades.controller.js';

function responder(res, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(status).json({
    error: status >= 500
      ? 'Ocurrió un error interno al procesar la solicitud.'
      : error.message
  });
}

export function crearRutasActividades(servicio) {
  const router = Router();
  const controlador = crearControladorActividades(servicio);
  const docenteOAdmin = [autenticar, requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR)];

  router.get('/', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.listar({
        docenteId: Number(req.usuario.id),
        todas: tieneRol(req.usuario, ROLES.ADMINISTRADOR)
      });
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });

  router.post('/', autenticar, controlador.crear);
  router.post('/cerrar-vencidas', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.cerrarVencidas();
      return res.status(200).json({ total: data.length, data });
    } catch (error) {
      return responder(res, error);
    }
  });
  router.get('/:id/convocatorias', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.listarConvocatorias(
        Number(req.params.id),
        Number(req.usuario.id)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });
  router.post('/:id/estudiantes', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.agregarEstudiante(
        Number(req.params.id),
        Number(req.body?.estudianteId),
        Number(req.usuario.id)
      );
      return res.status(201).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });
  router.delete('/:id/estudiantes/:estudianteId', ...docenteOAdmin, async (req, res) => {
    try {
      const data = await servicio.retirarEstudiante(
        Number(req.params.id),
        Number(req.params.estudianteId),
        Number(req.usuario.id)
      );
      return res.status(200).json({ data });
    } catch (error) {
      return responder(res, error);
    }
  });
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
    const { crearServicioNotificaciones } = await import('../modules/notificaciones/notificaciones.service.js');
    const notificaciones = crearServicioNotificaciones({
      async enviar(mensaje, contexto = {}) {
        try {
          const tipos = {
            CONVOCATORIA: 'Convocatoria',
            CAMBIO_ESTUDIANTE: 'CambioConvocatoria'
          };
          const [usuarios] = await pool.execute(
            'SELECT id FROM Usuario WHERE correoInstitucional = ? LIMIT 1',
            [mensaje.to]
          );
          const usuarioId = contexto.estudianteId ?? usuarios[0]?.id;
          if (!usuarioId) return;
          await pool.execute(
            `INSERT INTO Notificacion
               (usuario_id, actividad_id, tipo, canal, asunto, mensaje, estado, fechaCreacion, errorEnvio)
             VALUES (?, ?, ?, 'Correo', ?, ?, 'Fallida', NOW(), ?)`,
            [
              usuarioId,
              contexto.actividadId ?? null,
              tipos[contexto.tipo] ?? 'Convocatoria',
              mensaje.subject ?? null,
              mensaje.text,
              'El transporte de correo no está configurado.'
            ]
          );
        } catch (error) {
          console.error('No se pudo guardar la notificación:', error?.code || error?.message);
        }
      }
    });

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
  },
  async listar(filtro) {
    return (await obtenerServicioPorDefecto()).listar(filtro);
  },
  async listarConvocatorias(actividadId, docenteId) {
    return (await obtenerServicioPorDefecto()).listarConvocatorias(actividadId, docenteId);
  },
  async agregarEstudiante(actividadId, estudianteId, docenteId) {
    return (await obtenerServicioPorDefecto()).agregarEstudiante(
      actividadId,
      estudianteId,
      docenteId
    );
  },
  async retirarEstudiante(actividadId, estudianteId, docenteId) {
    return (await obtenerServicioPorDefecto()).retirarEstudiante(
      actividadId,
      estudianteId,
      docenteId
    );
  },
  async cerrarVencidas(ahora) {
    return (await obtenerServicioPorDefecto()).cerrarVencidas(ahora);
  },
  async alIniciar(actividadId) {
    const { obtenerServicioSesiones } = await import('./sesiones.routes.js');
    await (await obtenerServicioSesiones()).preparar(actividadId);
  }
};

export default crearRutasActividades(servicioLazy);
