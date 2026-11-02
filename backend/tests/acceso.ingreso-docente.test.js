import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { crearRepositorioAcceso } from '../src/modules/acceso/acceso.repository.js';
import { crearServicioAcceso } from '../src/modules/acceso/acceso.service.js';
import { hashearContrasena } from '../src/modules/acceso/contrasenas.js';
import { verificarToken } from '../src/modules/acceso/tokens.js';
import { crearRutasAcceso } from '../src/routes/acceso.routes.js';

// Claves y contraseñas ficticias solo para pruebas (las reales van en .env, nunca en Git)
process.env.CODIGO_AUTORIZACION_SECRETO = 'clave-de-prueba-solo-para-tests-0123456789';
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

const CORREO = 'docente.prueba@unihumboldt.edu.co';
const CONTRASENA = 'Contrasena-de-prueba-123';
const HASH = await hashearContrasena(CONTRASENA);

// Pool falso: responde como MySQL según la tabla consultada.
function crearPoolFalso({
  usuario = {},
  roles = ['Docente'],
  permisos = ['CREAR_CASOS'],
  falla = null
} = {}) {
  return {
    async execute(sql, parametros) {
      if (falla) throw falla;
      // Roles y permisos primero: 'FROM Usuario' también aparece en 'FROM UsuarioRol'.
      if (sql.includes('JOIN RolPermiso')) return [permisos.map((nombre) => ({ nombre }))];
      if (sql.includes('JOIN Rol r')) return [roles.map((nombre) => ({ nombre }))];
      if (sql.includes('FROM Usuario')) {
        if (usuario === null || parametros[0] !== CORREO) return [[]];
        return [[{ id: 2, correoInstitucional: CORREO, contrasenaHash: HASH, activo: 1, ...usuario }]];
      }
      return [[]];
    }
  };
}

function crearAppDePrueba(opcionesPool) {
  const servicio = crearServicioAcceso(crearRepositorioAcceso(crearPoolFalso(opcionesPool)));
  const appPrueba = express();
  appPrueba.use(express.json());
  appPrueba.use('/api/acceso', crearRutasAcceso(async () => servicio));
  return appPrueba;
}

function ingresar(appPrueba, cuerpo) {
  return request(appPrueba).post('/api/acceso/ingreso').send(cuerpo);
}

// ---------- Ingreso exitoso ----------

test('docente con correo y contraseña correctos recibe su token (200)', async () => {
  const res = await ingresar(crearAppDePrueba(), { correo: CORREO, contrasena: CONTRASENA }).expect(200);

  assert.deepEqual(res.body.usuario, { id: 2, roles: ['Docente'], permisos: ['CREAR_CASOS'] });
  assert.deepEqual(verificarToken(res.body.token), {
    id: 2, roles: ['Docente'], permisos: ['CREAR_CASOS']
  });
});

test('el administrador también puede ingresar', async () => {
  const res = await ingresar(crearAppDePrueba({ roles: ['Administrador'], permisos: [] }), {
    correo: CORREO, contrasena: CONTRASENA
  }).expect(200);
  assert.deepEqual(res.body.usuario.roles, ['Administrador']);
});

test('acepta el correo en mayúsculas y con espacios', async () => {
  await ingresar(crearAppDePrueba(), { correo: '  DOCENTE.Prueba@unihumboldt.edu.co ', contrasena: CONTRASENA })
    .expect(200);
});

test('la respuesta nunca incluye el hash de la contraseña', async () => {
  const res = await ingresar(crearAppDePrueba(), { correo: CORREO, contrasena: CONTRASENA }).expect(200);
  assert.ok(!JSON.stringify(res.body).includes('scrypt'));
});

// ---------- Validación de entrada ----------

test('responde 400 si falta el correo o la contraseña', async () => {
  const appPrueba = crearAppDePrueba();
  await ingresar(appPrueba, { contrasena: CONTRASENA }).expect(400);
  await ingresar(appPrueba, { correo: CORREO }).expect(400);
  await ingresar(appPrueba, { correo: CORREO, contrasena: '' }).expect(400);
  await ingresar(appPrueba, { correo: CORREO, contrasena: 12345678 }).expect(400);
  await ingresar(appPrueba, {}).expect(400);
});

// ---------- Rechazos ----------

test('responde 401 con una contraseña incorrecta', async () => {
  const res = await ingresar(crearAppDePrueba(), { correo: CORREO, contrasena: 'otra-contrasena' }).expect(401);
  assert.match(res.body.error, /no válidos/);
  assert.equal(res.body.token, undefined);
});

test('responde 401 con el mismo mensaje si el correo no existe', async () => {
  const res = await ingresar(crearAppDePrueba(), { correo: 'nadie@unihumboldt.edu.co', contrasena: CONTRASENA })
    .expect(401);
  assert.equal(res.body.error, 'Correo o contraseña no válidos');
});

test('responde 401 si el usuario no tiene contraseña registrada (por ejemplo, un estudiante)', async () => {
  await ingresar(crearAppDePrueba({ usuario: { contrasenaHash: null }, roles: ['Estudiante'] }), {
    correo: CORREO, contrasena: CONTRASENA
  }).expect(401);
});

test('responde 403 si la cuenta está inactiva', async () => {
  const res = await ingresar(crearAppDePrueba({ usuario: { activo: 0 } }), { correo: CORREO, contrasena: CONTRASENA })
    .expect(403);
  assert.match(res.body.error, /inactiva/);
});

test('responde 403 si el usuario es estudiante (ellos ingresan con su código)', async () => {
  const res = await ingresar(crearAppDePrueba({ roles: ['Estudiante'], permisos: [] }), {
    correo: CORREO, contrasena: CONTRASENA
  }).expect(403);
  assert.match(res.body.error, /docentes y administradores/);
});

test('responde 403 si el usuario no tiene ningún rol', async () => {
  await ingresar(crearAppDePrueba({ roles: [], permisos: [] }), { correo: CORREO, contrasena: CONTRASENA })
    .expect(403);
});

test('responde 500 sin detalles internos si falla la base de datos', async () => {
  const falla = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), { code: 'ECONNREFUSED' });
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const res = await ingresar(crearAppDePrueba({ falla }), { correo: CORREO, contrasena: CONTRASENA }).expect(500);
    assert.equal(res.body.error, 'Error interno del servidor');
  } finally {
    console.error = errorOriginal;
  }
});

// ---------- La ruta está registrada en la aplicación ----------

test('la aplicación expone POST /api/acceso/ingreso', async () => {
  // Sin datos responde 400 antes de conectarse a MySQL.
  const res = await request(app).post('/api/acceso/ingreso').send({}).expect(400);
  assert.match(res.body.error, /obligatorios/);
});
