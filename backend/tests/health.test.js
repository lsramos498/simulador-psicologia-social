import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

test('GET / responde con información de Lumina', async () => {
  const response = await request(app)
    .get('/')
    .expect('Content-Type', /json/)
    .expect(200);

  assert.equal(response.body.name, 'Lumina API');
  assert.equal(response.body.message, 'Backend de Lumina disponible.');
});

test('GET /api/health responde con estado ok', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect('Content-Type', /json/)
    .expect(200);

  assert.equal(response.body.status, 'ok');
  assert.equal(
    response.body.message,
    'API de Lumina funcionando correctamente.'
  );
});
