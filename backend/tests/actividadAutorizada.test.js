import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { autenticar } from '../src/modules/acceso/autenticar.middleware.js';
import { requiereActividadAutorizada } from '../src/modules/acceso/autorizar.middleware.js';
import { ROLES } from '../src/modules/acceso/autorizacion.js';
import { firmarToken } from '../src/modules/acceso/tokens.js';

/**
 * Un estudiante solo accede a la actividad de su código (Sofía Gallego — acceso y permisos).
 * Ruta de ejemplo con la forma que tendrá la de inicio de sesión del estudiante
 * (módulo de actividades): POST /actividades/:id/sesiones.
 * Clave ficticia solo para pruebas (la real va en .env, nunca en Git).
 */
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

function crearAppDePrueba(middleware = requiereActividadAutorizada()) {
  const llamadas = [];
  const app = express();
  app.post('/actividades/:id/sesiones', autenticar, middleware, (req, res) => {
    llamadas.push(req.params.id);
    res.status(201).json({ ok: true });
  });
  return { app, llamadas };
}

const token = (usuario) => `Bearer ${firmarToken(usuario)}`;
const estudianteActividad5 = { id: 20, roles: [ROLES.ESTUDIANTE], permisos: [], actividadId: 5 };
const docente = { id: 7, roles: [ROLES.DOCENTE], permisos: ['CREAR_CASOS'] };

test('el estudiante entra a la actividad de su código (201)', async () => {
  const { app, llamadas } = crearAppDePrueba();
  await request(app).post('/actividades/5/sesiones')
    .set('Authorization', token(estudianteActividad5))
    .expect(201);
  assert.deepEqual(llamadas, ['5']);
});

test('el estudiante recibe 403 en una actividad que no es la de su código, y la ruta no se ejecuta', async () => {
  const { app, llamadas } = crearAppDePrueba();
  const res = await request(app).post('/actividades/8/sesiones')
    .set('Authorization', token(estudianteActividad5))
    .expect(403);
  assert.match(res.body.error, /actividad/);
  assert.equal(llamadas.length, 0);
});

test('un estudiante sin actividad en su token recibe 403', async () => {
  const { app, llamadas } = crearAppDePrueba();
  await request(app).post('/actividades/5/sesiones')
    .set('Authorization', token({ id: 21, roles: [ROLES.ESTUDIANTE], permisos: [] }))
    .expect(403);
  assert.equal(llamadas.length, 0);
});

test('una actividad que no es un número recibe 403 para el estudiante', async () => {
  const { app, llamadas } = crearAppDePrueba();
  await request(app).post('/actividades/abc/sesiones')
    .set('Authorization', token(estudianteActividad5))
    .expect(403);
  assert.equal(llamadas.length, 0);
});

test('sin token responde 401', async () => {
  const { app, llamadas } = crearAppDePrueba();
  await request(app).post('/actividades/5/sesiones').expect(401);
  assert.equal(llamadas.length, 0);
});

test('docentes y administradores pasan: su control lo hace el módulo de actividades', async () => {
  const { app } = crearAppDePrueba();
  await request(app).post('/actividades/8/sesiones')
    .set('Authorization', token(docente))
    .expect(201);
});

test('sin autenticar responde 401 aunque se use solo (sin req.usuario)', async () => {
  const app = express();
  app.post('/actividades/:id/sesiones', requiereActividadAutorizada(), (_req, res) => res.sendStatus(201));
  await request(app).post('/actividades/5/sesiones').expect(401);
});

test('acepta otra forma de leer la actividad de la ruta', async () => {
  const app = express();
  app.use(express.json());
  app.post('/sesiones', autenticar, requiereActividadAutorizada((req) => req.body.actividadId),
    (_req, res) => res.sendStatus(201));

  await request(app).post('/sesiones').set('Authorization', token(estudianteActividad5))
    .send({ actividadId: 5 }).expect(201);
  await request(app).post('/sesiones').set('Authorization', token(estudianteActividad5))
    .send({ actividadId: 6 }).expect(403);
});

test('falla al definir la ruta si no recibe una función', () => {
  assert.throws(() => requiereActividadAutorizada('id'), TypeError);
});
