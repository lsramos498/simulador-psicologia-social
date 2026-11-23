import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import request from 'supertest';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { crearRepositorioSesiones } from '../src/modules/sesiones/sesiones.repository.js';
import { crearServicioSesiones } from '../src/modules/sesiones/sesiones.service.js';
import { crearRutasSesiones } from '../src/routes/sesiones.routes.js';

process.env.JWT_SECRETO = 'clave-de-prueba-para-reporte-0123456789';

function prepararPrueba(t) {
  // Ejecuta la consulta de producción en una base aislada con las mismas relaciones.
  // La compatibilidad con el motor y el esquema completos de MySQL se valida por separado.
  const bd = new DatabaseSync(':memory:');
  t.after(() => bd.close());
  bd.exec(`
    CREATE TABLE ActividadProgramada (id INTEGER PRIMARY KEY, docente_id INTEGER, caso_id INTEGER);
    CREATE TABLE Usuario (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, correoInstitucional TEXT);
    CREATE TABLE EstudianteAutorizado (actividad_id INTEGER, estudiante_id INTEGER,
                                      PRIMARY KEY (actividad_id, estudiante_id));
    CREATE TABLE SesionSimulacion (id INTEGER PRIMARY KEY, actividad_id INTEGER, estudiante_id INTEGER,
                                   numeroIntento INTEGER, estado TEXT, inicio TEXT,
                                   UNIQUE (actividad_id, estudiante_id, numeroIntento));
    CREATE TABLE Evaluacion (sesion_id INTEGER PRIMARY KEY, resultado TEXT);
    CREATE TABLE Escena (id INTEGER PRIMARY KEY, caso_id INTEGER);
    CREATE TABLE Decision (id INTEGER PRIMARY KEY, escena_id INTEGER);
    CREATE TABLE RespuestaEstudiante (sesion_id INTEGER, decision_id INTEGER, opcion_id INTEGER,
                                      PRIMARY KEY (sesion_id, decision_id));

    INSERT INTO ActividadProgramada VALUES (4, 1, 7), (8, 1, 7), (10, 1, 7), (11, 2, 8);
    INSERT INTO Usuario VALUES
      (5, 'María', 'Arias', 'maria@example.test'), (6, 'Luis', 'Bravo', 'luis@example.test'),
      (7, 'Ana', 'Cano', 'ana@example.test'), (8, 'Nora', 'Díaz', 'nora@example.test'),
      (9, 'Eva', 'Espitia', 'eva@example.test'), (16, 'Juan', 'Flores', 'juan@example.test');
    INSERT INTO EstudianteAutorizado VALUES
      (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 16), (8, 5), (11, 5);
    INSERT INTO SesionSimulacion VALUES
      (11, 4, 5, 1, 'Finalizado', '2026-05-01 10:00:00'),
      (12, 4, 5, 2, 'Finalizado', '2026-05-01 11:00:00'),
      (13, 4, 5, 3, 'Finalizado', NULL),
      (21, 4, 6, 1, 'Finalizado', '2026-05-01 10:00:00'),
      (22, 4, 6, 2, 'En curso', '2026-05-01 11:00:00'),
      (41, 4, 8, 1, 'Finalizado', NULL), (51, 4, 9, 1, 'Sin iniciar', NULL),
      (61, 11, 5, 1, 'Finalizado', '2026-05-01 10:00:00'),
      (71, 4, 16, 1, 'En curso', '2026-05-01 11:00:00');
    INSERT INTO Evaluacion VALUES
      (11, '5.00'), (12, '4.25'), (13, '0.00'), (21, '2.50'), (41, '0.00'), (61, '1.25');
    INSERT INTO Escena VALUES (1, 7), (2, 8);
    INSERT INTO Decision VALUES (1, 1), (2, 1), (3, 1), (4, 2);
    INSERT INTO RespuestaEstudiante VALUES (12, 1, 11), (12, 2, 21), (12, 3, 31),
                                        (22, 1, 11), (22, 2, NULL), (61, 4, 41), (71, 2, 21);
  `);

  const repo = crearRepositorioSesiones({
    getConnection: async () => { throw new Error('La consulta debe ser de solo lectura.'); },
    async execute(sql, parametros) {
      return [bd.prepare(sql).all(...parametros)];
    }
  });
  const app = express();
  app.use('/api/sesiones', crearRutasSesiones(async () => crearServicioSesiones(repo)));

  function exportar(actividadId, roles = ['Docente'], id = 1) {
    const peticion = request(app)
      .get(`/api/sesiones/actividades/${actividadId}/reporte-participacion.csv`);
    return roles
      ? peticion.set('Authorization', `Bearer ${firmarToken({ id, roles })}`)
      : peticion;
  }
  return { bd, exportar };
}

test('exporta una fila por convocado con progreso y nota del intento correspondiente', async (t) => {
  const { bd, exportar } = prepararPrueba(t);
  const respuesta = await exportar(4)
    .expect(200)
    .expect('Content-Type', /^text\/csv; charset=utf-8$/i)
    .expect('Content-Disposition', /^attachment; filename=("?)participacion-actividad-4\.csv\1$/)
    .expect('Cache-Control', 'no-store');

  const filas = respuesta.text.trimEnd().split('\r\n').slice(1);
  const nota = bd.prepare('SELECT resultado FROM Evaluacion WHERE sesion_id = ?');
  assert.deepEqual(filas, [
    `4,7,5,María,Arias,maria@example.test,Finalizado,2,3,3,${nota.get(12).resultado},2`,
    `4,7,6,Luis,Bravo,luis@example.test,En curso,2,1,3,${nota.get(21).resultado},1`,
    '4,7,7,Ana,Cano,ana@example.test,Ausente,,,,,',
    `4,7,8,Nora,Díaz,nora@example.test,Ausente,,,,${nota.get(41).resultado},1`,
    '4,7,9,Eva,Espitia,eva@example.test,Ausente,,,,,',
    '4,7,16,Juan,Flores,juan@example.test,En curso,1,1,3,,'
  ]);
});

test('incluye convocados aunque la actividad no tenga sesiones', async (t) => {
  const { exportar } = prepararPrueba(t);
  const respuesta = await exportar(8).expect(200);
  assert.match(respuesta.text, /\r\n8,7,5,María,Arias,maria@example.test,Ausente,,,,,\r\n$/);
  const sinConvocados = await exportar(10).expect(200);
  assert.match(sinConvocados.text, /^\uFEFFActividad,.*\r\n$/);
});

test('rechaza a cualquier usuario distinto de un docente creador sin rol administrador', async (t) => {
  const { exportar } = prepararPrueba(t);
  await exportar(4, null).expect(401);
  await exportar(4, ['Estudiante']).expect(403);
  await exportar(4, ['Docente'], 2).expect(403);
  await exportar(10, ['Docente'], 2).expect(403);
  await exportar(4, ['Administrador']).expect(403);
  await exportar(4, ['Docente', 'Administrador']).expect(403);
});

test('devuelve error para una actividad inexistente o un identificador inválido', async (t) => {
  const { exportar } = prepararPrueba(t);
  await exportar(9).expect(404);
  await exportar('abc').expect(400);
});
