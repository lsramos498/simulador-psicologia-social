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
    obtenerDecisionesAplicables: async () => [2, 5],
    consultarRespuestasParaProgreso: async () => [datos],
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
  assert.deepEqual(res.body.data.progreso, {
    estadoRecorrido: 'determinado', totalPreguntas: 2, preguntasRespondidas: 1,
    preguntasPendientes: 1, decisionesPendientesIds: [5]
  });
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
  assert.deepEqual(res.body.data.progreso, {
    estadoRecorrido: 'determinado', totalPreguntas: 2, preguntasRespondidas: 1,
    preguntasPendientes: 1, decisionesPendientesIds: [5]
  });
});
test('HTTP error de persistencia devuelve 500 sin detalles SQL', async () => {
  const res = await enviar(preparar({ insertarRespuesta: async () => { throw new Error('detalle-SQL-simulado'); } }));
  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /detalle-SQL/);
});

function consultarProgreso(app, sesionId = 1) {
  return request(app).get(`/api/participacion/sesiones/${sesionId}/progreso`)
    .set('Authorization', `Bearer ${token}`);
}

test('GET progreso devuelve 200 con el formato data y la identidad autenticada', async () => {
  const res = await consultarProgreso(preparar()).query({ estudianteId: 99 });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { data: {
    estadoRecorrido: 'determinado', totalPreguntas: 2, preguntasRespondidas: 1,
    preguntasPendientes: 1, decisionesPendientesIds: [5]
  } });
});

test('GET progreso sin autenticación no consulta persistencia', async () => {
  let consultas = 0;
  const app = preparar({ obtenerSesion: async () => { consultas++; return null; } });
  await request(app).get('/api/participacion/sesiones/1/progreso').expect(401);
  assert.equal(consultas, 0);
});

test('GET progreso con token inválido devuelve 401', async () => {
  await request(preparar()).get('/api/participacion/sesiones/1/progreso')
    .set('Authorization', 'Bearer invalido').expect(401);
});

for (const [nombre, sesion, status, codigo] of [
  ['ajena', { estudianteId: 8, casoId: 9 }, 403, 'SESION_AJENA'],
  ['inexistente', null, 404, 'SESION_NO_EXISTE']
]) {
  test(`GET progreso de sesión ${nombre} devuelve ${status}`, async () => {
    let lecturas = 0;
    const app = preparar({ obtenerSesion: async () => sesion,
      obtenerDecisionesAplicables: async () => { lecturas++; return []; } });
    const res = await consultarProgreso(app);
    assert.equal(res.status, status);
    assert.equal(res.body.codigo, codigo);
    assert.equal(lecturas, 0);
  });
}

for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
  test(`GET progreso rechaza identificador inválido ${id}`, async () => {
    let consultas = 0;
    const app = preparar({ obtenerSesion: async () => { consultas++; return null; } });
    const res = await consultarProgreso(app, id);
    assert.equal(res.status, 400);
    assert.equal(consultas, 0);
  });
}

test('GET progreso permite consultar sesión propia finalizada sin escribir', async () => {
  let escrituras = 0;
  const app = preparar({
    obtenerSesion: async () => ({ estudianteId: 7, casoId: 9, estado: 'Finalizado' }),
    insertarRespuesta: async () => { escrituras++; return 10; },
    actualizarRespuesta: async () => { escrituras++; return 1; }
  });
  await consultarProgreso(app).expect(200);
  assert.equal(escrituras, 0);
});

test('GET progreso conserva el manejo de fallos internos sin revelar SQL', async () => {
  const app = preparar({ obtenerDecisionesAplicables: async () => { throw new Error('detalle-SQL-progreso-simulado'); } });
  const res = await consultarProgreso(app);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Ocurrió un error interno al procesar la solicitud.' });
});
