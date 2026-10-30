import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {
  ROLES,
  tienePermiso,
  tieneRol
} from '../src/modules/acceso/autorizacion.js';
import {
  requierePermiso,
  requiereRol
} from '../src/modules/acceso/autorizar.middleware.js';

// Usuarios ficticios solo para pruebas
const administrador = { id: 1, roles: [ROLES.ADMINISTRADOR], permisos: [] };
const docenteCreador = { id: 2, roles: [ROLES.DOCENTE], permisos: ['crear_casos'] };
const docenteSinPermiso = { id: 3, roles: [ROLES.DOCENTE], permisos: [] };
const estudiante = { id: 4, roles: [ROLES.ESTUDIANTE], permisos: [] };

// ---------- Pruebas unitarias ----------

test('tieneRol reconoce un rol que el usuario sí tiene', () => {
  assert.equal(tieneRol(administrador, ROLES.ADMINISTRADOR), true);
});

test('tieneRol acepta varios roles permitidos', () => {
  assert.equal(tieneRol(docenteCreador, ROLES.ADMINISTRADOR, ROLES.DOCENTE), true);
});

test('tieneRol rechaza un rol que el usuario no tiene', () => {
  assert.equal(tieneRol(estudiante, ROLES.DOCENTE), false);
});

test('tieneRol responde false si el usuario no tiene roles', () => {
  assert.equal(tieneRol({ id: 9 }, ROLES.DOCENTE), false);
});

test('tienePermiso distingue docentes con y sin permiso de crear casos', () => {
  assert.equal(tienePermiso(docenteCreador, 'crear_casos'), true);
  assert.equal(tienePermiso(docenteSinPermiso, 'crear_casos'), false);
});

test('las reglas rechazan un usuario inexistente', () => {
  assert.throws(() => tieneRol(null, ROLES.DOCENTE), TypeError);
  assert.throws(() => tienePermiso(undefined, 'crear_casos'), TypeError);
});

// ---------- Pruebas de integración con una ruta de prueba ----------

function crearAppDePrueba(usuario) {
  const app = express();
  app.use((req, _res, next) => {
    // Simula lo que hará el middleware de autenticación
    if (usuario) req.usuario = usuario;
    next();
  });
  app.get('/solo-admin', requiereRol(ROLES.ADMINISTRADOR), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post('/casos', requierePermiso('crear_casos'), (_req, res) => {
    res.status(201).json({ ok: true });
  });
  return app;
}

test('ruta de administrador: sin autenticación responde 401', async () => {
  const res = await request(crearAppDePrueba(null)).get('/solo-admin').expect(401);
  assert.match(res.body.error, /autenticarse/);
});

test('ruta de administrador: un docente recibe 403', async () => {
  const res = await request(crearAppDePrueba(docenteCreador)).get('/solo-admin').expect(403);
  assert.match(res.body.error, /rol/);
});

test('ruta de administrador: el administrador entra (200)', async () => {
  await request(crearAppDePrueba(administrador)).get('/solo-admin').expect(200);
});

test('crear casos: docente con permiso entra (201)', async () => {
  await request(crearAppDePrueba(docenteCreador)).post('/casos').expect(201);
});

test('crear casos: docente sin permiso recibe 403', async () => {
  await request(crearAppDePrueba(docenteSinPermiso)).post('/casos').expect(403);
});

test('crear casos: estudiante recibe 403', async () => {
  await request(crearAppDePrueba(estudiante)).post('/casos').expect(403);
});

test('crear casos: sin autenticación responde 401', async () => {
  await request(crearAppDePrueba(null)).post('/casos').expect(401);
});
