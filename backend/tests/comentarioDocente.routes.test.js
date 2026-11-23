import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { crearRepositorioSesiones } from '../src/modules/sesiones/sesiones.repository.js';
import { crearServicioSesiones } from '../src/modules/sesiones/sesiones.service.js';
import { crearRutasSesiones } from '../src/routes/sesiones.routes.js';

process.env.JWT_SECRETO = 'clave-local-para-pruebas-del-comentario-docente';

function preparar(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE ActividadProgramada (
      id INTEGER PRIMARY KEY, docente_id INTEGER, estado TEXT, fechaInicio TEXT,
      fechaFin TEXT, tiempoLimiteSegundos INTEGER, rubrica_id INTEGER, caso_id INTEGER
    );
    CREATE TABLE SesionSimulacion (
      id INTEGER PRIMARY KEY, actividad_id INTEGER, estudiante_id INTEGER,
      numeroIntento INTEGER, estado TEXT, inicio TEXT, fin TEXT,
      segundosConsumidos INTEGER, motivoCierre TEXT
    );
    CREATE TABLE Evaluacion (
      id INTEGER PRIMARY KEY, sesion_id INTEGER UNIQUE, resultado DECIMAL(8,2),
      retroalimentacionGeneral TEXT, comentarioDocente TEXT, fechaEvaluacion TEXT
    );
    CREATE TABLE ResultadoCriterio (
      evaluacion_id INTEGER, criterio_id INTEGER, puntuacion DECIMAL(8,2), observacion TEXT
    );
    INSERT INTO ActividadProgramada VALUES
      (4, 11, 'Iniciada', '2026-05-01', '2026-05-02', 1800, 21, 31);
    INSERT INTO SesionSimulacion VALUES
      (51, 4, 20, 1, 'Finalizado', NULL, NULL, 0, NULL),
      (52, 4, 22, 1, 'En curso', NULL, NULL, 0, NULL),
      (53, 4, 23, 1, 'Finalizado', NULL, NULL, 0, NULL);
    INSERT INTO Evaluacion VALUES
      (61, 51, 4.25, 'Resultado automático', NULL, '2026-05-02');
  `);
  const conexion = {
    async execute(sql, parametros) {
      // SQLite usa una transacción de escritura en lugar de FOR UPDATE.
      const consulta = db.prepare(sql.replace(/ FOR UPDATE$/u, ''));
      return /^UPDATE/u.test(sql) ? [consulta.run(...parametros)] : [consulta.all(...parametros)];
    },
    async beginTransaction() { db.exec('BEGIN IMMEDIATE'); },
    async commit() { db.exec('COMMIT'); },
    async rollback() { db.exec('ROLLBACK'); },
    release() {}
  };
  const repo = crearRepositorioSesiones({ ...conexion, getConnection: async () => conexion });
  const app = express();
  app.use(express.json());
  app.use('/api/sesiones', crearRutasSesiones(async () => crearServicioSesiones(repo)));
  const docente = { id: 11, roles: ['Docente'] };
  const estudiante = { id: 20, roles: ['Estudiante'], actividadId: 4 };
  function autorizar(peticion, usuario) {
    return usuario ? peticion.set('Authorization', `Bearer ${firmarToken(usuario)}`) : peticion;
  }
  function guardar(comentarioDocente, usuario = docente, sesionId = 51) {
    return autorizar(request(app).put(`/api/sesiones/${sesionId}/comentario-docente`), usuario)
      .send({ comentarioDocente, resultado: 0, retroalimentacionGeneral: 'No modificar' });
  }
  function consultar(ruta, usuario = docente) {
    return autorizar(request(app).get(`/api/sesiones/${ruta}`), usuario);
  }
  return { db, guardar, consultar, docente, estudiante };
}

test('el creador registra y edita el comentario sin cambiar la nota ni el mensaje automático', async (t) => {
  const { db, guardar, consultar } = preparar(t);
  const estado = db.prepare('SELECT resultado, retroalimentacionGeneral, comentarioDocente FROM Evaluacion');
  const texto = 'Buen análisis.\nRevisa el último punto.';
  const creado = await guardar(`  ${texto}  `).expect(201);
  assert.deepEqual(creado.body.data, { comentarioDocente: texto });
  assert.deepEqual({ ...estado.get() }, {
    resultado: 4.25,
    retroalimentacionGeneral: 'Resultado automático',
    comentarioDocente: texto
  });
  const editado = await guardar('Comentario actualizado').expect(200);
  const consulta = await consultar('51').expect(200);
  assert.equal(editado.body.data.comentarioDocente, 'Comentario actualizado');
  assert.equal(consulta.body.data.evaluacion.comentarioDocente, 'Comentario actualizado');
  assert.deepEqual({ ...estado.get() }, {
    resultado: 4.25,
    retroalimentacionGeneral: 'Resultado automático',
    comentarioDocente: 'Comentario actualizado'
  });
});

test('el estudiante propietario puede consultar el comentario en el resultado de su actividad', async (t) => {
  const { guardar, consultar, estudiante } = preparar(t);
  await guardar('Valoración docente').expect(201);
  const respuesta = await consultar('actividades/4', estudiante).expect(200);
  const { evaluacion, sesion } = respuesta.body.data;
  assert.equal(sesion.estado, 'Finalizado');
  assert.equal(evaluacion.comentarioDocente, 'Valoración docente');
  assert.equal(evaluacion.resultado, 4.25);
  assert.equal(evaluacion.retroalimentacionGeneral, 'Resultado automático');
  await consultar('51', { ...estudiante, id: 22 }).expect(403);
  await consultar('actividades/4', { ...estudiante, actividadId: 5 }).expect(403);
});

test('rechaza comentarios vacíos o inválidos y sesiones sin evaluación finalizada', async (t) => {
  const { guardar, docente } = preparar(t);
  for (const texto of ['', ' \n \t ', undefined, 123, 'é'.repeat(32_768)]) {
    await guardar(texto).expect(400);
  }
  await guardar('Comentario', docente, 52).expect(409);
  await guardar('Comentario', docente, 53).expect(409);
  await guardar('Comentario', docente, 99).expect(404);
  await guardar('Comentario después de los rechazos').expect(201);
});

test('rechaza docentes ajenos, estudiantes, administradores sin rol docente y usuarios anónimos', async (t) => {
  const { guardar, estudiante, docente } = preparar(t);
  await guardar('Ajeno', { id: 12, roles: ['Docente'] }).expect(403);
  await guardar('Estudiante', estudiante).expect(403);
  await guardar('Sin rol docente', { ...docente, roles: ['Administrador'] }).expect(403);
  await guardar('Anónimo', null).expect(401);
  await guardar('Comentario del creador').expect(201);
});
