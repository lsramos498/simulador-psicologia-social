import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { crearCasoBase } from '../src/modules/casos/caso.model.js';

test('crearCasoBase exige título', () => {
  assert.throws(
    () => crearCasoBase({ id: 1, titulo: '   ' }),
    /título/
  );
});

test('crearCasoBase arma la estructura mínima del caso', () => {
  const caso = crearCasoBase({
    id: 10,
    titulo: '  Caso de prueba  ',
    descripcion: 'Descripción breve'
  });

  assert.equal(caso.id, 10);
  assert.equal(caso.titulo, 'Caso de prueba');
  assert.equal(caso.descripcion, 'Descripción breve');
  assert.equal(caso.estado, 'borrador');
  assert.deepEqual(caso.escenarios, []);
  assert.equal(caso.rubricaId, null);
  assert.ok(caso.creadoEn);
});

test('GET /api/casos lista los casos académicos', async () => {
  const response = await request(app)
    .get('/api/casos')
    .expect('Content-Type', /json/)
    .expect(200);

  assert.ok(response.body.total >= 1);
  assert.ok(Array.isArray(response.body.data));
  assert.equal(response.body.data[0].titulo, 'Conflicto en el aula');
});

test('GET /api/casos/:id devuelve un caso existente', async () => {
  const response = await request(app)
    .get('/api/casos/1')
    .expect('Content-Type', /json/)
    .expect(200);

  assert.equal(response.body.data.id, 1);
  assert.equal(response.body.data.titulo, 'Conflicto en el aula');
});

test('GET /api/casos/:id responde 404 si el caso no existe', async () => {
  const response = await request(app)
    .get('/api/casos/999')
    .expect('Content-Type', /json/)
    .expect(404);

  assert.match(response.body.error, /No se encontró el caso/);
});
