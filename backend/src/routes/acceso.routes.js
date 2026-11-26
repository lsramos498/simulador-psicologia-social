import { Router } from 'express';
import { crearRepositorioAcceso } from '../modules/acceso/acceso.repository.js';
import { crearServicioAcceso } from '../modules/acceso/acceso.service.js';
import { crearRepositorioAdministracion } from '../modules/acceso/administracion.repository.js';
import { crearServicioAdministracion } from '../modules/acceso/administracion.service.js';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES, tieneRol } from '../modules/acceso/autorizacion.js';
import { crearRutasAdministracion } from './administracion.routes.js';
import { responderErrorHttp } from '../modules/acceso/errores.js';

/**
 * Rutas del módulo de acceso (Sofía Gallego — acceso y permisos).
 *
 *   POST /api/acceso/estudiantes/enviar-codigo
 *   body: { "correo": "..." }
 *
 *   POST /api/acceso/estudiantes/ingreso
 *   body: { "correo": "...", "codigo": "..." }
 *
 *   POST /api/acceso/ingreso
 *   body: { "correo": "...", "contrasena": "..." }
 */

function esTextoConContenido(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

export function crearRutasAcceso(obtenerServicio) {
  const router = Router();

  router.post('/estudiantes/enviar-codigo', async (req, res) => {
    const { correo } = req.body ?? {};

    if (!esTextoConContenido(correo)) {
      return res.status(400).json({
        error: 'El correo institucional es obligatorio'
      });
    }

    try {
      const servicio = await obtenerServicio();
      const resultado = await servicio.enviarCodigoEstudiante({ correo });
      return res.status(200).json(resultado);
    } catch (error) {
      return responderErrorHttp(res, error, 'envío de código de estudiante');
    }
  });

  router.post('/estudiantes/ingreso', async (req, res) => {
    const { correo, codigo } = req.body ?? {};

    if (!esTextoConContenido(correo) || !esTextoConContenido(codigo)) {
      return res.status(400).json({
        error: 'El correo institucional y el código de inicio de sesión son obligatorios'
      });
    }

    try {
      const servicio = await obtenerServicio();
      const resultado = await servicio.ingresarEstudiante({ correo, codigo });

      return res.status(200).json(resultado);
    } catch (error) {
      return responderErrorHttp(res, error, 'ingreso de estudiante');
    }
  });

  router.get('/estudiantes/mis-actividades', autenticar, async (req, res) => {
    try {
      if (!tieneRol(req.usuario, ROLES.ESTUDIANTE)) {
        return res.status(403).json({ error: 'Solo estudiantes.' });
      }
      const servicio = await obtenerServicio();
      const data = await servicio.listarMisActividades(req.usuario.id);
      return res.status(200).json({ data });
    } catch (error) {
      return responderErrorHttp(res, error, 'mis actividades');
    }
  });

  router.post('/ingreso', async (req, res) => {
    const { correo, contrasena } = req.body ?? {};

    if (
      !esTextoConContenido(correo) ||
      typeof contrasena !== 'string' ||
      contrasena === ''
    ) {
      return res.status(400).json({
        error: 'El correo institucional y la contraseña son obligatorios'
      });
    }

    try {
      const servicio = await obtenerServicio();
      const resultado = await servicio.ingresarConContrasena({
        correo,
        contrasena
      });

      return res.status(200).json(resultado);
    } catch (error) {
      return responderErrorHttp(res, error, 'ingreso con contraseña');
    }
  });

  // Roster para convocar (docente y admin). Solo datos públicos de estudiantes.
  router.get(
    '/estudiantes',
    autenticar,
    requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR),
    async (_req, res) => {
      try {
        const admin = await obtenerServicioAdministracion();
        const data = await admin.listarEstudiantes();
        return res.status(200).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'listado de estudiantes');
      }
    }
  );

  // Alta masiva desde texto/PDF parseado en el cliente (antes de POST /estudiantes).
  router.post(
    '/estudiantes/lote',
    autenticar,
    requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR),
    async (req, res) => {
      try {
        const { parsearListaEstudiantes } = await import(
          '../modules/acceso/estudiantes.lote.js'
        );
        const texto = typeof req.body?.texto === 'string' ? req.body.texto : '';
        const { filas, errores } = parsearListaEstudiantes(texto);
        if (filas.length === 0) {
          return res.status(400).json({
            error: 'No se encontraron estudiantes válidos en el archivo o texto.',
            errores
          });
        }

        const admin = await obtenerServicioAdministracion();
        const creados = [];
        const omitidos = [];
        for (const fila of filas) {
          try {
            const data = await admin.crearEstudiante(fila, req.usuario.id);
            creados.push(data);
          } catch (error) {
            omitidos.push({
              correo: fila.correo,
              motivo: error.message || 'No se pudo crear'
            });
          }
        }

        return res.status(201).json({
          data: {
            creados,
            omitidos,
            erroresParseo: errores,
            totalCreados: creados.length,
            totalOmitidos: omitidos.length
          }
        });
      } catch (error) {
        return responderErrorHttp(res, error, 'alta masiva de estudiantes');
      }
    }
  );

  // Alta de estudiantes para Docente y Admin (misma lógica que /admin/estudiantes).
  router.post(
    '/estudiantes',
    autenticar,
    requiereRol(ROLES.DOCENTE, ROLES.ADMINISTRADOR),
    async (req, res) => {
      try {
        const admin = await obtenerServicioAdministracion();
        const data = await admin.crearEstudiante(req.body, req.usuario.id);
        return res.status(201).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'creación de estudiante');
      }
    }
  );

  return router;
}

// La conexión a MySQL se carga solo cuando llega la primera petición,
// así las pruebas que no usan la base de datos no necesitan un .env.
let servicioPorDefecto;
let servicioAdministracion;

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

    const repoNotif = crearRepositorioNotificaciones(pool);
    const transporte = await crearTransporteNotificaciones(repoNotif);
    const notificaciones = crearServicioNotificaciones(transporte, repoNotif);

    servicioPorDefecto = crearServicioAcceso(crearRepositorioAcceso(pool), {
      notificaciones
    });
  }

  return servicioPorDefecto;
}

async function obtenerServicioAdministracion() {
  if (!servicioAdministracion) {
    const { pool } = await import('../config/database.js');

    servicioAdministracion = crearServicioAdministracion(
      crearRepositorioAdministracion(pool)
    );
  }

  return servicioAdministracion;
}

const rutasAcceso = crearRutasAcceso(obtenerServicioPorDefecto);

// RF-03: rutas del administrador bajo /api/acceso/admin.
rutasAcceso.use(
  '/admin',
  crearRutasAdministracion(obtenerServicioAdministracion)
);

export default rutasAcceso;
