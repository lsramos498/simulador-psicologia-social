import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { crearServicioAdministracion } from '../src/modules/acceso/administracion.service.js';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { crearRutasAdministracion } from '../src/routes/administracion.routes.js';

// Clave ficticia solo para pruebas (la real va en .env, nunca en Git)
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

// Tokens de usuarios ficticios
const tokenAdmin = firmarToken({ id: 1, roles: ['Administrador'], permisos: [] });
const tokenDocente = firmarToken({ id: 2, roles: ['Docente'], permisos: ['CREAR_CASOS'] });
const tokenEstudiante = firmarToken({ id: 3, roles: ['Estudiante'], actividadId: 5 });

// Repositorio en memoria mínimo para las rutas.
function crearRepositorioFalso() {
  const usuarios = [{ id: 1, correo: 'admin.prueba@unihumboldt.edu.co' }];
  const roles = [{ id: 1, nombre: 'Administrador' }, { id: 2, nombre: 'Docente' }, { id: 3, nombre: 'Estudiante' }];
  const permisos = [{ id: 1, nombre: 'CREAR_CASOS', descripcion: 'Crear casos' }];
  const usuarioRol = [{ usuarioId: 1, rolId: 1 }];
  const rolPermiso = [];
  return {
    obtenerRolPorNombre: async (n) => roles.find((r) => r.nombre === n) ?? null,
    obtenerPermisoPorNombre: async (n) => permisos.find((p) => p.nombre === n) ?? null,
    existeCorreo: async (c) => usuarios.some((u) => u.correo === c),
    existeUsuario: async (id) => usuarios.some((u) => u.id === id),
    async crearUsuarioConRol({ correo, rolId }) {
      const id = usuarios.length + 1;
      usuarios.push({ id, correo });
      usuarioRol.push({ usuarioId: id, rolId });
      return id;
    },
    async asignarRol(usuarioId, rolId) { usuarioRol.push({ usuarioId, rolId }); },
    async quitarRol(usuarioId, rolId) {
      const i = usuarioRol.findIndex((f) => f.usuarioId === usuarioId && f.rolId === rolId);
      if (i === -1) return false;
      usuarioRol.splice(i, 1);
      return true;
    },
    async asignarPermisoARol(rolId, permisoId) { rolPermiso.push({ rolId, permisoId }); },
    async quitarPermisoDeRol(rolId, permisoId) {
      const i = rolPermiso.findIndex((f) => f.rolId === rolId && f.permisoId === permisoId);
      if (i === -1) return false;
      rolPermiso.splice(i, 1);
      return true;
    },
    listarRolesConPermisos: async () => roles.map((r) => ({
      nombre: r.nombre,
      permisos: rolPermiso.filter((f) => f.rolId === r.id).map(() => 'CREAR_CASOS')
    })),
    listarPermisos: async () => permisos.map(({ nombre, descripcion }) => ({ nombre, descripcion }))
  };
}

function crearAppDePrueba(repositorio = crearRepositorioFalso()) {
  const servicio = crearServicioAdministracion(repositorio);
  const appPrueba = express();
  appPrueba.use(express.json());
  appPrueba.use('/api/acceso/admin', crearRutasAdministracion(async () => servicio));
  return appPrueba;
}

const DOCENTE = {
  nombres: 'Ana',
  apellidos: 'Prueba',
  correo: 'ana.prueba@unihumboldt.edu.co',
  contrasena: 'Contrasena-de-prueba-123'
};

// ---------- Protección: solo Administrador ----------

test('sin token responde 401 en todas las rutas de administración', async () => {
  const appPrueba = crearAppDePrueba();
  await request(appPrueba).get('/api/acceso/admin/roles').expect(401);
  await request(appPrueba).post('/api/acceso/admin/docentes').send(DOCENTE).expect(401);
});

test('un docente recibe 403 (no puede crear docentes ni darse permisos)', async () => {
  const appPrueba = crearAppDePrueba();
  await request(appPrueba).post('/api/acceso/admin/docentes')
    .set('Authorization', `Bearer ${tokenDocente}`).send(DOCENTE).expect(403);
  await request(appPrueba).post('/api/acceso/admin/usuarios/2/roles')
    .set('Authorization', `Bearer ${tokenDocente}`).send({ rol: 'Administrador' }).expect(403);
});

test('un estudiante recibe 403', async () => {
  await request(crearAppDePrueba()).get('/api/acceso/admin/permisos')
    .set('Authorization', `Bearer ${tokenEstudiante}`).expect(403);
});

// ---------- Operaciones del administrador ----------

test('el administrador crea un docente (201) sin exponer la contraseña', async () => {
  const res = await request(crearAppDePrueba()).post('/api/acceso/admin/docentes')
    .set('Authorization', `Bearer ${tokenAdmin}`).send(DOCENTE).expect(201);
  assert.equal(res.body.data.correo, DOCENTE.correo);
  assert.deepEqual(res.body.data.roles, ['Docente']);
  assert.ok(!JSON.stringify(res.body).includes(DOCENTE.contrasena));
  assert.ok(!JSON.stringify(res.body).includes('scrypt'));
});

test('crear docente con datos incompletos responde 400', async () => {
  const res = await request(crearAppDePrueba()).post('/api/acceso/admin/docentes')
    .set('Authorization', `Bearer ${tokenAdmin}`).send({ nombres: 'Ana' }).expect(400);
  assert.match(res.body.error, /Faltan datos/);
});

test('crear un docente con un correo repetido responde 409', async () => {
  const appPrueba = crearAppDePrueba();
  await request(appPrueba).post('/api/acceso/admin/docentes')
    .set('Authorization', `Bearer ${tokenAdmin}`).send(DOCENTE).expect(201);
  await request(appPrueba).post('/api/acceso/admin/docentes')
    .set('Authorization', `Bearer ${tokenAdmin}`).send(DOCENTE).expect(409);
});

test('el administrador asigna y quita roles', async () => {
  const appPrueba = crearAppDePrueba();
  await request(appPrueba).post('/api/acceso/admin/docentes')
    .set('Authorization', `Bearer ${tokenAdmin}`).send(DOCENTE).expect(201);

  await request(appPrueba).post('/api/acceso/admin/usuarios/2/roles')
    .set('Authorization', `Bearer ${tokenAdmin}`).send({ rol: 'Administrador' }).expect(201);
  await request(appPrueba).delete('/api/acceso/admin/usuarios/2/roles/Administrador')
    .set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
});

test('el administrador no puede quitarse su propio rol (409)', async () => {
  await request(crearAppDePrueba()).delete('/api/acceso/admin/usuarios/1/roles/Administrador')
    .set('Authorization', `Bearer ${tokenAdmin}`).expect(409);
});

test('el administrador asigna un permiso a un rol y lo ve en el listado', async () => {
  const appPrueba = crearAppDePrueba();
  await request(appPrueba).post('/api/acceso/admin/roles/Docente/permisos')
    .set('Authorization', `Bearer ${tokenAdmin}`).send({ permiso: 'CREAR_CASOS' }).expect(201);

  const res = await request(appPrueba).get('/api/acceso/admin/roles')
    .set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
  assert.deepEqual(res.body.data.find((r) => r.nombre === 'Docente').permisos, ['CREAR_CASOS']);
});

test('roles o permisos inexistentes responden 404', async () => {
  const appPrueba = crearAppDePrueba();
  await request(appPrueba).post('/api/acceso/admin/roles/Docente/permisos')
    .set('Authorization', `Bearer ${tokenAdmin}`).send({ permiso: 'BORRAR_TODO' }).expect(404);
  await request(appPrueba).post('/api/acceso/admin/usuarios/1/roles')
    .set('Authorization', `Bearer ${tokenAdmin}`).send({ rol: 'SuperUsuario' }).expect(404);
});

test('un error de base de datos responde 500 sin detalles', async () => {
  const repo = crearRepositorioFalso();
  repo.listarPermisos = async () => { throw Object.assign(new Error('ECONNREFUSED 3306'), { code: 'ECONNREFUSED' }); };
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const res = await request(crearAppDePrueba(repo)).get('/api/acceso/admin/permisos')
      .set('Authorization', `Bearer ${tokenAdmin}`).expect(500);
    assert.equal(res.body.error, 'Error interno del servidor');
  } finally {
    console.error = errorOriginal;
  }
});

// ---------- Registradas en la aplicación ----------

test('la aplicación expone /api/acceso/admin protegido (401 sin token, sin tocar MySQL)', async () => {
  await request(app).get('/api/acceso/admin/roles').expect(401);
});
