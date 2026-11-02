import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { crearRutasCasos } from '../src/routes/casos.routes.js';

process.env.JWT_SECRETO = 'clave-de-prueba-para-casos-0123456789';

function tokenDe(id, permisos) {
  return firmarToken({ id, roles: ['Docente'], permisos });
}

function appCon(servicio) {
  const app = express();
  app.use(express.json());
  app.use('/api/casos', crearRutasCasos(async () => servicio));
  return app;
}

test('POST /api/casos exige el permiso y usa el docente de la sesión', async () => {
  let recibido = null;
  const app = appCon({
    async crear(datos) {
      recibido = datos;
      return { id: 8, estado: 'Borrador', creadorId: datos.creadorId, titulo: datos.titulo };
    }
  });

  await request(app)
    .post('/api/casos')
    .send({ titulo: 'Caso', creadorId: 99 })
    .expect(401);

  await request(app)
    .post('/api/casos')
    .set('Authorization', `Bearer ${tokenDe(5, [])}`)
    .send({ titulo: 'Caso', creadorId: 99 })
    .expect(403);

  const response = await request(app)
    .post('/api/casos')
    .set('Authorization', `Bearer ${tokenDe(5, ['CREAR_CASOS'])}`)
    .send({
      titulo: 'Caso de aula',
      creadorId: 99,
      desarrolloSituacional: 'Hay una discusión.',
      contextoHistoria: 'Curso.',
      tiempoEstimadoSegundos: 480
    })
    .expect(201);

  assert.equal(recibido.creadorId, 5);
  assert.equal(response.body.data.creadorId, 5);
  assert.equal(response.body.data.titulo, 'Caso de aula');
});

test('POST /api/casos/construir responde 201', async () => {
  const app = appCon({
    async construir(datos) {
      return { id: 4, estado: 'Borrador', titulo: datos.titulo };
    }
  });

  const response = await request(app)
    .post('/api/casos/construir')
    .send({ titulo: 'Caso nuevo' })
    .expect(201);

  assert.equal(response.body.data.id, 4);
  assert.equal(response.body.data.titulo, 'Caso nuevo');
});

test('GET /api/casos/:id responde 404 cuando el caso no existe', async () => {
  const app = appCon({
    async obtener() {
      const error = new Error('No se encontró el caso.');
      error.statusCode = 404;
      error.codigo = 'CASO_NO_EXISTE';
      throw error;
    }
  });

  const response = await request(app)
    .get('/api/casos/999')
    .expect(404);

  assert.equal(response.body.codigo, 'CASO_NO_EXISTE');
});

test('POST /api/casos/:id/publicar devuelve las reglas que faltan', async () => {
  const app = appCon({
    async publicar() {
      const error = new Error('La estructura del caso no es válida.');
      error.statusCode = 422;
      error.codigo = 'ESTRUCTURA_INVALIDA';
      error.errores = ['El caso debe tener una rúbrica antes de publicarse.'];
      throw error;
    }
  });

  const response = await request(app)
    .post('/api/casos/2/publicar')
    .expect(422);

  assert.match(response.body.errores[0], /rúbrica/);
});
