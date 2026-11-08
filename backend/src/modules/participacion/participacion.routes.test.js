import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { crearRutasParticipacion } from '../../routes/participacion.routes.js';
import { firmarToken } from '../acceso/tokens.js';
import { crearServicioParticipacion } from './participacion.service.js';

const secretoAnterior = process.env.JWT_SECRETO;
process.env.JWT_SECRETO = 'clave-solo-pruebas-http-participacion-123456';
after(() => {
  if (secretoAnterior === undefined) delete process.env.JWT_SECRETO;
  else process.env.JWT_SECRETO = secretoAnterior;
});
const token = firmarToken({ id: 7, roles: ['Estudiante'] });
const datos = { sesionId: 1, decisionId: 2, opcionId: 3 };
function preparar(cambios = {}) {
  const repo = {
    obtenerSesion: async () => ({ estudianteId: 7, estado: 'En curso', casoId: 9 }),
    opcionValida: async () => true, obtenerRespuesta: async () => null,
    insertarRespuesta: async () => 10, consultarRespuestas: async () => [{ id: 10, ...datos }],
    ...cambios
  };
  repo.enTransaccion = async operacion => operacion(repo);
  const app = express();
  app.use(express.json());
  app.use('/api/participacion', crearRutasParticipacion(async () => crearServicioParticipacion(repo)));
  return app;
}
function enviar(app, cuerpo = datos) {
  return request(app).post('/api/participacion/respuestas').set('Authorization', `Bearer ${token}`).send(cuerpo);
}
test('HTTP usa identidad del token e ignora estudianteId del cliente', async () => {
  const res = await enviar(preparar(), { ...datos, estudianteId: 99 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.id, 10);
});
for (const cuerpo of [{}, { ...datos, opcionId: null }, { ...datos, opcionId: '3' }, { ...datos, sesionId: 2147483648 }]) {
  test(`HTTP datos inválidos devuelven 400: ${JSON.stringify(cuerpo)}`, async () => {
    assert.equal((await enviar(preparar(), cuerpo)).status, 400);
  });
}
test('HTTP sin token o con token alterado devuelve 401', async () => {
  const app = preparar();
  await request(app).post('/api/participacion/respuestas').send(datos).expect(401);
  await request(app).get('/api/participacion/sesiones/1/respuestas').expect(401);
  await request(app).post('/api/participacion/respuestas').set('Authorization', 'Bearer invalido').send(datos).expect(401);
});
for (const [nombre, cambios, status] of [
  ['ajena', { obtenerSesion: async () => ({ estudianteId: 8 }) }, 403],
  ['inexistente', { obtenerSesion: async () => null }, 404],
  ['finalizada', { obtenerSesion: async () => ({ estudianteId: 7, estado: 'Finalizado' }) }, 409],
  ['sin iniciar', { obtenerSesion: async () => ({ estudianteId: 7, estado: 'Sin iniciar' }) }, 409],
  ['opción de otra decisión o caso', { opcionValida: async () => false }, 422]
]) {
  test(`HTTP ${nombre}: ${status}`, async () => { assert.equal((await enviar(preparar(cambios))).status, status); });
}
test('HTTP consulta propia, ajena y parámetro inválido', async () => {
  const app = preparar();
  const consultar = (app, id) => request(app).get(`/api/participacion/sesiones/${id}/respuestas`).set('Authorization', `Bearer ${token}`);
  await consultar(app, 1).expect(200);
  await consultar(app, 'abc').expect(400);
  await consultar(preparar({ obtenerSesion: async () => ({ estudianteId: 8 }) }), 1).expect(403);
});
test('HTTP modifica a otra opción válida mediante el router existente', async () => {
  let opcion;
  const app = preparar({ obtenerRespuesta: async () => ({ id: 10, opcionId: 3, fechaRespuesta: new Date(), fechaModificacion: null }),
    actualizarRespuesta: async (id, nueva) => { opcion = nueva; return 1; } });
  const res = await enviar(app, { ...datos, opcionId: 4 });
  assert.equal(res.status, 201);
  assert.equal(opcion, 4);
});
test('HTTP error de persistencia devuelve 500 sin detalles SQL', async () => {
  const res = await enviar(preparar({ insertarRespuesta: async () => { throw new Error('detalle-SQL-simulado'); } }));
  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /detalle-SQL/);
});
