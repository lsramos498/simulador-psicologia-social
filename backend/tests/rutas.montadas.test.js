import test from 'node:test';
import request from 'supertest';
import app from '../src/app.js';

test('actividades, participación y casos no responden sin autenticación', async () => {
  await request(app).post('/api/actividades').send({}).expect(401);
  await request(app).post('/api/participacion/respuestas').send({}).expect(401);
  await request(app).get('/api/casos').expect(401);
});
