import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { firmarToken } from '../src/modules/acceso/tokens.js';
import { requiereCasoDeSuActividad } from '../src/modules/acceso/autorizar.middleware.js';
import { crearBuscadorCasoDeActividad } from '../src/modules/acceso/casoDeActividad.js';
import { crearRutasCasos } from '../src/routes/casos.routes.js';

/**
 * RF-10 / RF-20 (Sofía Gallego — acceso): un estudiante solo consulta el caso
 * de la actividad con la que ingresó. Clave ficticia solo para pruebas.
 */
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

const token = (usuario) => `Bearer ${firmarToken(usuario)}`;
const estudiante = { id: 20, roles: ['Estudiante'], permisos: [], actividadId: 5 }; // actividad 5 → caso 3
const sinActividad = { id: 21, roles: ['Estudiante'], permisos: [] };
const docente = { id: 7, roles: ['Docente'], permisos: ['CREAR_CASOS'] };
const admin = { id: 1, roles: ['Administrador'], permisos: [] };

const CASOS = [
  { id: 3, titulo: 'Caso de su actividad', escenas: [] },
  { id: 9, titulo: 'Caso de otra actividad', escenas: [] }
];

function crearApp({ buscar = async (actividadId) => (actividadId === 5 ? 3 : null) } = {}) {
  const consultados = [];
  const servicio = {
    async listar() { return CASOS.map(({ id, titulo }) => ({ id, titulo })); },
    async obtener(id) {
      consultados.push(Number(id));
      return CASOS.find((c) => c.id === Number(id));
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/casos', crearRutasCasos(async () => servicio, {
    buscarCasoDeActividad: buscar,
    buscarCasosDelEstudiante: async () => [] // sin convocatorias (no toca MySQL)
  }));
  return { app, consultados };
}

// ---------- Rutas de casos ----------

test('el estudiante consulta el caso de SU actividad (200)', async () => {
  const { app } = crearApp();
  const res = await request(app).get('/api/casos/3').set('Authorization', token(estudiante)).expect(200);
  assert.equal(res.body.data.id, 3);
});

test('el estudiante recibe 403 en el caso de otra actividad y el servicio no lo consulta', async () => {
  const { app, consultados } = crearApp();
  const res = await request(app).get('/api/casos/9').set('Authorization', token(estudiante)).expect(403);
  assert.match(res.body.error, /caso/);
  assert.deepEqual(consultados, []);
});

test('el listado de casos le muestra al estudiante solo el de su actividad', async () => {
  const { app } = crearApp();
  const res = await request(app).get('/api/casos').set('Authorization', token(estudiante)).expect(200);
  assert.deepEqual(res.body.data.map((c) => c.id), [3]);
  assert.equal(res.body.total, 1);
});

test('un estudiante sin actividad en el token recibe 403 en detalle y listado', async () => {
  const { app } = crearApp();
  await request(app).get('/api/casos/3').set('Authorization', token(sinActividad)).expect(403);
  await request(app).get('/api/casos').set('Authorization', token(sinActividad)).expect(403);
});

test('si la actividad del token ya no existe, el estudiante recibe 403', async () => {
  const { app } = crearApp({ buscar: async () => null });
  await request(app).get('/api/casos/3').set('Authorization', token(estudiante)).expect(403);
});

test('docentes y administradores siguen viendo cualquier caso y el listado completo', async () => {
  for (const usuario of [docente, admin]) {
    const { app } = crearApp({ buscar: async () => { throw new Error('no debería consultarse'); } });
    await request(app).get('/api/casos/9').set('Authorization', token(usuario)).expect(200);
    const res = await request(app).get('/api/casos').set('Authorization', token(usuario)).expect(200);
    assert.equal(res.body.total, 2);
  }
});

test('si falla la consulta del caso responde 500 sin detalles', async () => {
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const { app } = crearApp({ buscar: async () => { throw new Error('ECONNREFUSED 127.0.0.1:3306'); } });
    const res = await request(app).get('/api/casos/3').set('Authorization', token(estudiante)).expect(500);
    assert.doesNotMatch(JSON.stringify(res.body), /ECONNREFUSED|3306/);
  } finally {
    console.error = errorOriginal;
  }
});

test('sin token sigue respondiendo 401', async () => {
  const { app } = crearApp();
  await request(app).get('/api/casos/3').expect(401);
  await request(app).get('/api/casos').expect(401);
});

// ---------- Middleware y consulta ----------

test('requiereCasoDeSuActividad falla al definir la ruta si no recibe funciones', () => {
  assert.throws(() => requiereCasoDeSuActividad('x'), TypeError);
  assert.throws(() => requiereCasoDeSuActividad(async () => 1, 'id'), TypeError);
});

test('requiereCasoDeSuActividad responde 401 si se usa sin autenticar', async () => {
  const app = express();
  app.get('/casos/:id', requiereCasoDeSuActividad(async () => 3), (_req, res) => res.sendStatus(200));
  await request(app).get('/casos/3').expect(401);
});

test('la consulta del caso usa SQL parametrizado y devuelve null si no existe', async () => {
  const llamadas = [];
  const conexion = {
    async execute(sql, valores) {
      llamadas.push({ sql, valores });
      return [valores[0] === 5 ? [{ casoId: 3 }] : []];
    }
  };
  const buscar = crearBuscadorCasoDeActividad(conexion);
  assert.equal(await buscar(5), 3);
  assert.equal(await buscar(6), null);
  assert.match(llamadas[0].sql, /WHERE id = \?/);
  assert.deepEqual(llamadas[0].valores, [5]);
  assert.throws(() => crearBuscadorCasoDeActividad(null), TypeError);
});

// ---------- Ingreso con código de sesión (OTP): el token no trae actividad ----------

const estudianteOtp = { id: 30, roles: ['Estudiante'], permisos: [] }; // convocado a actividades con casos 3 y 4

function crearAppOtp({ casosDelEstudiante = async (id) => (id === 30 ? [3, 4] : []) } = {}) {
  const servicio = {
    async listar() { return [{ id: 3 }, { id: 4 }, { id: 9 }]; },
    async obtener(id) { return { id: Number(id), escenas: [] }; }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/casos', crearRutasCasos(async () => servicio, {
    buscarCasoDeActividad: async () => { throw new Error('no debería usarse sin actividadId'); },
    buscarCasosDelEstudiante: casosDelEstudiante
  }));
  return app;
}

test('OTP: el estudiante ve los casos de las actividades a las que está convocado', async () => {
  const app = crearAppOtp();
  await request(app).get('/api/casos/3').set('Authorization', token(estudianteOtp)).expect(200);
  await request(app).get('/api/casos/4').set('Authorization', token(estudianteOtp)).expect(200);
});

test('OTP: el estudiante recibe 403 en un caso de una actividad a la que no está convocado', async () => {
  await request(crearAppOtp()).get('/api/casos/9').set('Authorization', token(estudianteOtp)).expect(403);
});

test('OTP: el listado muestra solo los casos de sus convocatorias', async () => {
  const res = await request(crearAppOtp()).get('/api/casos').set('Authorization', token(estudianteOtp)).expect(200);
  assert.deepEqual(res.body.data.map((c) => c.id), [3, 4]);
});

test('OTP: un estudiante sin convocatorias recibe 403', async () => {
  const app = crearAppOtp({ casosDelEstudiante: async () => [] });
  await request(app).get('/api/casos/3').set('Authorization', token(estudianteOtp)).expect(403);
  await request(app).get('/api/casos').set('Authorization', token(estudianteOtp)).expect(403);
});

test('OTP: la consulta de casos del estudiante usa SQL parametrizado y solo convocatorias Autorizado', async () => {
  const { crearBuscadorCasosDelEstudiante } = await import('../src/modules/acceso/casoDeActividad.js');
  const llamadas = [];
  const buscar = crearBuscadorCasosDelEstudiante({
    async execute(sql, valores) { llamadas.push({ sql, valores }); return [[{ casoId: 3 }, { casoId: 4 }]]; }
  });
  assert.deepEqual(await buscar(30), [3, 4]);
  assert.match(llamadas[0].sql, /estudiante_id = \? AND ea\.estado = 'Autorizado'/);
  assert.deepEqual(llamadas[0].valores, [30]);
});
