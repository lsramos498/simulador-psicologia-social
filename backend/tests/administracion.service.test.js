import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioAdministracion } from '../src/modules/acceso/administracion.service.js';
import { verificarContrasena } from '../src/modules/acceso/contrasenas.js';

/**
 * Repositorio falso en memoria: imita la base de datos para probar
 * las reglas del servicio sin MySQL. Datos ficticios solo para pruebas.
 */
function crearRepositorioFalso() {
  const bd = {
    roles: [{ id: 1, nombre: 'Administrador' }, { id: 2, nombre: 'Docente' }, { id: 3, nombre: 'Estudiante' }],
    permisos: [{ id: 1, nombre: 'CREAR_CASOS', descripcion: 'Crear casos' }],
    usuarios: [{ id: 1, correo: 'admin.prueba@unihumboldt.edu.co' }],
    usuarioRol: [{ usuarioId: 1, rolId: 1, asignadoPor: null }],
    rolPermiso: []
  };
  return {
    bd,
    obtenerRolPorNombre: async (n) => bd.roles.find((r) => r.nombre === n) ?? null,
    obtenerPermisoPorNombre: async (n) => bd.permisos.find((p) => p.nombre === n) ?? null,
    existeCorreo: async (c) => bd.usuarios.some((u) => u.correo === c),
    existeUsuario: async (id) => bd.usuarios.some((u) => u.id === id),
    async crearUsuarioConRol({ nombres, apellidos, correo, contrasenaHash, rolId, asignadoPor }) {
      const id = bd.usuarios.length + 1;
      bd.usuarios.push({ id, nombres, apellidos, correo, contrasenaHash });
      bd.usuarioRol.push({ usuarioId: id, rolId, asignadoPor });
      return id;
    },
    async asignarRol(usuarioId, rolId, asignadoPor) {
      if (!bd.usuarioRol.some((f) => f.usuarioId === usuarioId && f.rolId === rolId)) {
        bd.usuarioRol.push({ usuarioId, rolId, asignadoPor });
      }
    },
    async quitarRol(usuarioId, rolId) {
      const antes = bd.usuarioRol.length;
      bd.usuarioRol = bd.usuarioRol.filter((f) => !(f.usuarioId === usuarioId && f.rolId === rolId));
      return bd.usuarioRol.length < antes;
    },
    async asignarPermisoARol(rolId, permisoId) {
      if (!bd.rolPermiso.some((f) => f.rolId === rolId && f.permisoId === permisoId)) {
        bd.rolPermiso.push({ rolId, permisoId });
      }
    },
    async quitarPermisoDeRol(rolId, permisoId) {
      const antes = bd.rolPermiso.length;
      bd.rolPermiso = bd.rolPermiso.filter((f) => !(f.rolId === rolId && f.permisoId === permisoId));
      return bd.rolPermiso.length < antes;
    },
    listarRolesConPermisos: async () => bd.roles.map((r) => ({
      nombre: r.nombre,
      permisos: bd.rolPermiso.filter((f) => f.rolId === r.id)
        .map((f) => bd.permisos.find((p) => p.id === f.permisoId).nombre)
    })),
    listarPermisos: async () => bd.permisos.map(({ nombre, descripcion }) => ({ nombre, descripcion }))
  };
}

const ADMIN_ID = 1;
const DOCENTE = {
  nombres: ' Ana ',
  apellidos: 'Prueba',
  correo: ' Ana.Prueba@unihumboldt.edu.co ',
  contrasena: 'Contrasena-de-prueba-123'
};

function esperarError(promesa, statusCode, mensaje) {
  return assert.rejects(promesa, (error) => {
    assert.equal(error.statusCode, statusCode);
    if (mensaje) assert.match(error.message, mensaje);
    return true;
  });
}

// ---------- Crear docente ----------

test('crea un docente con rol Docente, contraseña en hash y quién lo asignó', async () => {
  const repo = crearRepositorioFalso();
  const resultado = await crearServicioAdministracion(repo).crearDocente(DOCENTE, ADMIN_ID);

  assert.deepEqual(resultado, {
    id: 2, nombres: 'Ana', apellidos: 'Prueba', correo: 'ana.prueba@unihumboldt.edu.co', roles: ['Docente']
  });
  const guardado = repo.bd.usuarios.find((u) => u.id === 2);
  assert.notEqual(guardado.contrasenaHash, DOCENTE.contrasena);
  assert.equal(await verificarContrasena(DOCENTE.contrasena, guardado.contrasenaHash), true);
  assert.deepEqual(repo.bd.usuarioRol.at(-1), { usuarioId: 2, rolId: 2, asignadoPor: ADMIN_ID });
});

test('el resultado de crear docente no incluye la contraseña ni su hash', async () => {
  const resultado = await crearServicioAdministracion(crearRepositorioFalso()).crearDocente(DOCENTE, ADMIN_ID);
  assert.equal(resultado.contrasena, undefined);
  assert.equal(resultado.contrasenaHash, undefined);
});

test('rechaza con 400 si faltan datos del docente y dice cuáles', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.crearDocente({ correo: 'x@unihumboldt.edu.co' }, ADMIN_ID), 400,
    /nombres, apellidos, contrasena/);
  await esperarError(servicio.crearDocente(null, ADMIN_ID), 400, /Faltan datos/);
});

test('rechaza con 400 un correo con formato inválido', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.crearDocente({ ...DOCENTE, correo: 'sin-arroba' }, ADMIN_ID), 400, /correo/);
});

test('rechaza con 409 un correo que ya existe', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(
    servicio.crearDocente({ ...DOCENTE, correo: 'admin.prueba@unihumboldt.edu.co' }, ADMIN_ID),
    409, /Ya existe/
  );
});

// ---------- Roles de un usuario ----------

test('asigna un rol existente a un usuario', async () => {
  const repo = crearRepositorioFalso();
  const servicio = crearServicioAdministracion(repo);
  await servicio.crearDocente(DOCENTE, ADMIN_ID);

  const resultado = await servicio.asignarRol('2', 'Administrador', ADMIN_ID);

  assert.deepEqual(resultado, { usuarioId: 2, rol: 'Administrador' });
  assert.ok(repo.bd.usuarioRol.some((f) => f.usuarioId === 2 && f.rolId === 1));
});

test('asignar un rol que el usuario ya tiene no lo duplica', async () => {
  const repo = crearRepositorioFalso();
  const servicio = crearServicioAdministracion(repo);
  await servicio.asignarRol(1, 'Administrador', ADMIN_ID);
  assert.equal(repo.bd.usuarioRol.filter((f) => f.usuarioId === 1).length, 1);
});

test('rechaza roles que no existen (no se crean roles nuevos)', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.asignarRol(1, 'SuperUsuario', ADMIN_ID), 404, /no existe/);
});

test('rechaza un usuario inexistente o con id inválido', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.asignarRol(99, 'Docente', ADMIN_ID), 404, /usuario no existe/);
  await esperarError(servicio.asignarRol('abc', 'Docente', ADMIN_ID), 400, /id/);
});

test('quita un rol al usuario', async () => {
  const repo = crearRepositorioFalso();
  const servicio = crearServicioAdministracion(repo);
  await servicio.crearDocente(DOCENTE, ADMIN_ID);

  await servicio.quitarRol(2, 'Docente', ADMIN_ID);
  assert.ok(!repo.bd.usuarioRol.some((f) => f.usuarioId === 2));
});

test('responde 404 al quitar un rol que el usuario no tiene', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.quitarRol(1, 'Docente', ADMIN_ID), 404, /no tiene ese rol/);
});

test('el administrador no puede quitarse su propio rol de Administrador', async () => {
  const repo = crearRepositorioFalso();
  await esperarError(crearServicioAdministracion(repo).quitarRol(1, 'Administrador', ADMIN_ID), 409, /propio rol/);
  assert.ok(repo.bd.usuarioRol.some((f) => f.usuarioId === 1 && f.rolId === 1));
});

// ---------- Permisos de un rol ----------

test('asigna un permiso a un rol y aparece en el listado', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await servicio.asignarPermiso('Docente', 'CREAR_CASOS');

  const roles = await servicio.listarRoles();
  assert.deepEqual(roles.find((r) => r.nombre === 'Docente').permisos, ['CREAR_CASOS']);
});

test('quita un permiso de un rol', async () => {
  const repo = crearRepositorioFalso();
  const servicio = crearServicioAdministracion(repo);
  await servicio.asignarPermiso('Docente', 'CREAR_CASOS');
  await servicio.quitarPermiso('Docente', 'CREAR_CASOS');
  assert.equal(repo.bd.rolPermiso.length, 0);
});

test('rechaza permisos que no existen en el catálogo', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.asignarPermiso('Docente', 'BORRAR_TODO'), 404, /no existe/);
});

test('responde 404 al quitar un permiso que el rol no tiene', async () => {
  const servicio = crearServicioAdministracion(crearRepositorioFalso());
  await esperarError(servicio.quitarPermiso('Docente', 'CREAR_CASOS'), 404, /no tiene ese permiso/);
});

test('lista el catálogo de permisos', async () => {
  const permisos = await crearServicioAdministracion(crearRepositorioFalso()).listarPermisos();
  assert.deepEqual(permisos, [{ nombre: 'CREAR_CASOS', descripcion: 'Crear casos' }]);
});

test('exige el repositorio de administración', () => {
  assert.throws(() => crearServicioAdministracion(null), TypeError);
});
