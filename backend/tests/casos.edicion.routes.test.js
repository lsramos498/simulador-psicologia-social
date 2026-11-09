import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { crearRutasCasos } from '../src/routes/casos.routes.js';

process.env.JWT_SECRETO = 'clave-de-prueba-para-casos-edicion-0123456789';

function tokenDe(id, permisos = ['CREAR_CASOS']) {
  return firmarToken({ id, roles: ['Docente'], permisos });
}

function appCon(servicio) {
  const app = express();
  app.use(express.json());
  app.use('/api/casos', crearRutasCasos(async () => servicio));
  return app;
}

test('PATCH /api/casos/:id/escenas/:escenaId responde 200', async () => {
  let recibido = null;
  const app = appCon({
    async actualizarEscena(casoId, escenaId, datos, actor) {
      recibido = { casoId, escenaId, datos, actorId: actor.id };
      return { id: Number(casoId), estado: 'Borrador' };
    }
  });

  await request(app)
    .patch('/api/casos/1/escenas/2')
    .set('Authorization', `Bearer ${tokenDe(5)}`)
    .send({
      nombre: 'Pasillo',
      contexto: 'Antes del aula',
      orden: 1,
      esFinal: false
    })
    .expect(200);

  assert.equal(recibido.escenaId, '2');
  assert.equal(recibido.actorId, 5);
  assert.equal(recibido.datos.nombre, 'Pasillo');
});

test('PATCH /api/casos/:id/decisiones/:decisionId responde 200', async () => {
  let decisionId = null;
  const app = appCon({
    async actualizarDecision(_casoId, id) {
      decisionId = id;
      return { id: 1, estado: 'Borrador' };
    }
  });

  await request(app)
    .patch('/api/casos/1/decisiones/9')
    .set('Authorization', `Bearer ${tokenDe(5)}`)
    .send({ pregunta: '¿Qué hace Ana?', orden: 1 })
    .expect(200);

  assert.equal(decisionId, '9');
});

test('PATCH /api/casos/:id/opciones/:opcionId responde 200', async () => {
  let opcionId = null;
  const app = appCon({
    async actualizarOpcion(_casoId, id) {
      opcionId = id;
      return { id: 1, estado: 'Borrador' };
    }
  });

  await request(app)
    .patch('/api/casos/1/opciones/4')
    .set('Authorization', `Bearer ${tokenDe(5)}`)
    .send({
      texto: 'Escucha',
      esCorrecta: true,
      orden: 1,
      explicacion: 'Contiene el conflicto.'
    })
    .expect(200);

  assert.equal(opcionId, '4');
});
