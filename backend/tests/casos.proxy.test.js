import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { crearRutasCasos } from '../src/routes/casos.routes.js';

/**
 * Patrón Proxy aplicado en una ruta real (Sofía Gallego — acceso y permisos).
 * POST /api/casos protege crear() con crearServicioProtegido: sin el permiso
 * CREAR_CASOS el servicio real de casos nunca se ejecuta.
 * Clave ficticia solo para pruebas (la real va en .env, nunca en Git).
 */
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

function crearAppDePrueba() {
  const llamadas = [];
  const servicioReal = {
    async crear(datos) {
      llamadas.push(datos);
      return { id: 1, ...datos };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/casos', crearRutasCasos(async () => servicioReal));
  return { app, llamadas };
}

const token = (usuario) => `Bearer ${firmarToken(usuario)}`;
const docenteConPermiso = { id: 7, roles: ['Docente'], permisos: ['CREAR_CASOS'] };
const docenteSinPermiso = { id: 8, roles: ['Docente'], permisos: [] };
const estudiante = { id: 9, roles: ['Estudiante'], permisos: [] };

test('POST /api/casos: docente con CREAR_CASOS crea el caso a través del proxy (201)', async () => {
  const { app, llamadas } = crearAppDePrueba();
  const res = await request(app).post('/api/casos')
    .set('Authorization', token(docenteConPermiso))
    .send({ titulo: 'Caso de prueba' })
    .expect(201);

  assert.equal(res.body.data.titulo, 'Caso de prueba');
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].creadorId, 7); // la identidad sale del token
});

test('POST /api/casos: docente sin permiso recibe 403 y el servicio real no se ejecuta', async () => {
  const { app, llamadas } = crearAppDePrueba();
  const res = await request(app).post('/api/casos')
    .set('Authorization', token(docenteSinPermiso))
    .send({ titulo: 'Caso de prueba' })
    .expect(403);

  assert.match(res.body.error, /permiso/);
  assert.equal(llamadas.length, 0);
});

test('POST /api/casos: un estudiante recibe 403 y el servicio real no se ejecuta', async () => {
  const { app, llamadas } = crearAppDePrueba();
  await request(app).post('/api/casos')
    .set('Authorization', token(estudiante))
    .send({ titulo: 'Caso de prueba' })
    .expect(403);
  assert.equal(llamadas.length, 0);
});

test('POST /api/casos: sin token responde 401 antes de llegar al proxy', async () => {
  const { app, llamadas } = crearAppDePrueba();
  await request(app).post('/api/casos').send({ titulo: 'Caso de prueba' }).expect(401);
  assert.equal(llamadas.length, 0);
});
