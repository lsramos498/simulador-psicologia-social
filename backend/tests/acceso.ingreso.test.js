import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { crearRepositorioAcceso } from '../src/modules/acceso/acceso.repository.js';
import { crearServicioAcceso } from '../src/modules/acceso/acceso.service.js';
import { hashearCodigoAutorizacion } from '../src/modules/acceso/codigos.js';
import { verificarToken } from '../src/modules/acceso/tokens.js';
import { crearRutasAcceso } from '../src/routes/acceso.routes.js';

// Claves ficticias solo para pruebas (las reales van en .env, nunca en Git)
process.env.CODIGO_AUTORIZACION_SECRETO = 'clave-de-prueba-solo-para-tests-0123456789';
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

const AHORA = new Date('2026-11-03T15:00:00');
const CORREO = 'estudiante.prueba@unihumboldt.edu.co';
const CODIGO = 'ABCD2345';

// Pool falso: responde como MySQL según la tabla consultada.
function crearPoolFalso({ convocatoria = {}, sesion = null, roles = ['Estudiante'], falla = null } = {}) {
  return {
    async execute(sql) {
      if (falla) throw falla;
      if (sql.includes('FROM EstudianteAutorizado')) {
        if (convocatoria === null) return [[]];
        return [[{
          actividad_id: 5,
          estudiante_id: 10,
          codigoAutorizacion: hashearCodigoAutorizacion(CODIGO),
          estado: 'Autorizado',
          usuarioId: 10,
          correoInstitucional: CORREO,
          activo: 1,
          actividadId: 5,
          fechaInicio: new Date('2026-11-03T14:00:00'),
          fechaFin: new Date('2026-11-03T18:00:00'),
          ...convocatoria
        }]];
      }
      if (sql.includes('FROM SesionSimulacion')) return [sesion ? [sesion] : []];
      if (sql.includes('JOIN RolPermiso')) return [[]];
      if (sql.includes('JOIN Rol r')) return [roles.map((nombre) => ({ nombre }))];
      return [[]];
    }
  };
}

function crearAppDePrueba(opcionesPool) {
  const repositorio = crearRepositorioAcceso(crearPoolFalso(opcionesPool));
  const servicio = crearServicioAcceso(repositorio, { reloj: () => AHORA });
  const appPrueba = express();
  appPrueba.use(express.json());
  appPrueba.use('/api/acceso', crearRutasAcceso(async () => servicio));
  return appPrueba;
}

function ingresar(appPrueba, cuerpo) {
  return request(appPrueba).post('/api/acceso/estudiantes/ingreso').send(cuerpo);
}

// ---------- Ingreso exitoso ----------

test('ingreso válido: responde 200 con un token JWT del estudiante', async () => {
  const res = await ingresar(crearAppDePrueba(), { correo: CORREO, codigo: CODIGO }).expect(200);

  assert.deepEqual(res.body.usuario, { id: 10, roles: ['Estudiante'], actividadId: 5 });

  const usuarioDelToken = verificarToken(res.body.token);
  assert.equal(usuarioDelToken.id, 10);
  assert.deepEqual(usuarioDelToken.roles, ['Estudiante']);
  assert.equal(usuarioDelToken.actividadId, 5);
});

test('acepta el código en minúsculas y con espacios', async () => {
  await ingresar(crearAppDePrueba(), { correo: CORREO, codigo: ' abcd2345 ' }).expect(200);
});

// ---------- Validación de entrada ----------

test('responde 400 si falta el correo o el código', async () => {
  const appPrueba = crearAppDePrueba();
  await ingresar(appPrueba, { codigo: CODIGO }).expect(400);
  await ingresar(appPrueba, { correo: CORREO }).expect(400);
  await ingresar(appPrueba, { correo: '   ', codigo: CODIGO }).expect(400);
  await ingresar(appPrueba, { correo: CORREO, codigo: 12345678 }).expect(400);
  await ingresar(appPrueba, {}).expect(400);
});

// ---------- Rechazos ----------

test('responde 401 con un código que no existe', async () => {
  const res = await ingresar(crearAppDePrueba({ convocatoria: null }), { correo: CORREO, codigo: CODIGO })
    .expect(401);
  assert.match(res.body.error, /no válidos/);
  assert.equal(res.body.token, undefined);
});

test('responde 401 con el correo de otra persona', async () => {
  await ingresar(crearAppDePrueba(), { correo: 'otra.persona@unihumboldt.edu.co', codigo: CODIGO })
    .expect(401);
});

test('responde 403 si el estudiante fue retirado de la convocatoria', async () => {
  await ingresar(crearAppDePrueba({ convocatoria: { estado: 'Retirado' } }), { correo: CORREO, codigo: CODIGO })
    .expect(403);
});

test('responde 403 si la sesión del estudiante ya finalizó', async () => {
  await ingresar(crearAppDePrueba({ sesion: { estado: 'Finalizado', numeroIntento: 1 } }), {
    correo: CORREO, codigo: CODIGO
  }).expect(403);
});

test('responde 403 si el usuario no tiene el rol Estudiante', async () => {
  const res = await ingresar(crearAppDePrueba({ roles: ['Docente'] }), { correo: CORREO, codigo: CODIGO })
    .expect(403);
  assert.match(res.body.error, /rol Estudiante/);
});

test('responde 500 sin detalles internos si falla la base de datos', async () => {
  const falla = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), { code: 'ECONNREFUSED' });
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const res = await ingresar(crearAppDePrueba({ falla }), { correo: CORREO, codigo: CODIGO }).expect(500);
    assert.equal(res.body.error, 'Error interno del servidor');
    assert.ok(!JSON.stringify(res.body).includes('3306'));
  } finally {
    console.error = errorOriginal;
  }
});

// ---------- La ruta está registrada en la aplicación ----------

test('la aplicación expone POST /api/acceso/estudiantes/ingreso', async () => {
  // Sin datos responde 400 antes de conectarse a MySQL.
  const res = await request(app).post('/api/acceso/estudiantes/ingreso').send({}).expect(400);
  assert.match(res.body.error, /obligatorios/);
});