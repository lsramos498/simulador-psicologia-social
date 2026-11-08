import { Router } from 'express';
import { autenticar } from '../modules/acceso/autenticar.middleware.js';
import { requiereRol } from '../modules/acceso/autorizar.middleware.js';
import { ROLES } from '../modules/acceso/autorizacion.js';
import { responderErrorHttp } from '../modules/acceso/errores.js';

/**
 * Rutas de administración (Sofía Gallego — acceso y permisos). RF-03.
 * Todas exigen un token válido (401) y el rol Administrador (403).
 *
 *   GET    /api/acceso/admin/roles                              roles y sus permisos
 *   GET    /api/acceso/admin/permisos                           catálogo de permisos
 *   POST   /api/acceso/admin/docentes                           crear docente
 *   POST   /api/acceso/admin/usuarios/:id/roles                 asignar rol   { "rol": "Docente" }
 *   DELETE /api/acceso/admin/usuarios/:id/roles/:rol            quitar rol
 *   POST   /api/acceso/admin/roles/:rol/permisos                asignar permiso { "permiso": "CREAR_CASOS" }
 *   DELETE /api/acceso/admin/roles/:rol/permisos/:permiso       quitar permiso
 */
export function crearRutasAdministracion(obtenerServicio) {
  const router = Router();

  // Chain of Responsibility: identidad primero, luego rol.
  router.use(autenticar, requiereRol(ROLES.ADMINISTRADOR));

  function ejecutar(accion, estado = 200) {
    return async (req, res) => {
      try {
        const servicio = await obtenerServicio();
        const data = await accion(servicio, req);
        return res.status(estado).json({ data });
      } catch (error) {
        return responderErrorHttp(res, error, 'administración');
      }
    };
  }

  router.get('/roles', ejecutar((s) => s.listarRoles()));
  router.get('/permisos', ejecutar((s) => s.listarPermisos()));

  router.post('/docentes', ejecutar((s, req) => s.crearDocente(req.body, req.usuario.id), 201));

  router.post('/usuarios/:id/roles', ejecutar((s, req) =>
    s.asignarRol(req.params.id, req.body?.rol, req.usuario.id), 201));
  router.delete('/usuarios/:id/roles/:rol', ejecutar((s, req) =>
    s.quitarRol(req.params.id, req.params.rol, req.usuario.id)));

  router.post('/roles/:rol/permisos', ejecutar((s, req) =>
    s.asignarPermiso(req.params.rol, req.body?.permiso), 201));
  router.delete('/roles/:rol/permisos/:permiso', ejecutar((s, req) =>
    s.quitarPermiso(req.params.rol, req.params.permiso)));

  return router;
}
