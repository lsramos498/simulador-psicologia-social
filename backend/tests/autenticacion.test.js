import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { ROLES } from '../src/modules/acceso/autorizacion.js';
import { autenticar } from '../src/modules/acceso/autenticar.middleware.js';
import { requierePermiso } from '../src/modules/acceso/autorizar.middleware.js';
import { firmarToken, verificarToken } from '../src/modules/acceso/tokens.js';

// Clave ficticia solo para pruebas (la real va en .env, nunca en Git)
const SECRETO_PRUEBA = 'clave-jwt-de-prueba-solo-para-tests-0123456789';
process.env.JWT_SECRETO = SECRETO_PRUEBA;

// Usuarios ficticios solo para pruebas
const docenteCreador = { id: 2, roles: [ROLES.DOCENTE], permisos: ['CREAR_CASOS'] };
const docenteSinPermiso = { id: 3, roles: [ROLES.DOCENTE], permisos: [] };
const estudiante = { id: 10, roles: [ROLES.ESTUDIANTE], actividadId: 5 };

function esperarError401(fn, mensaje) {
  assert.throws(fn, (error) => {
    assert.equal(error.statusCode, 401);
    assert.match(error.message, mensaje);
    return true;
  });
}

// ---------- Pruebas unitarias: firmar y verificar ----------

test('firma y verifica un token conservando id, roles y permisos', () => {
  const usuario = verificarToken(firmarToken(docenteCreador));
  assert.deepEqual(usuario, { id: 2, roles: ['Docente'], permisos: ['CREAR_CASOS'] });
});

test('el token del estudiante conserva la actividad a la que ingresó', () => {
  const usuario = verificarToken(firmarToken(estudiante));
  assert.deepEqual(usuario, { id: 10, roles: ['Estudiante'], permisos: [], actividadId: 5 });
});

test('por defecto el token dura 1 hora (decisión del equipo)', () => {
  const original = process.env.JWT_EXPIRACION;
  delete process.env.JWT_EXPIRACION;
  try {
    const datos = jwt.decode(firmarToken(docenteCreador));
    assert.equal(datos.exp - datos.iat, 3600);
  } finally {
    if (original !== undefined) process.env.JWT_EXPIRACION = original;
  }
});

test('no firma tokens para usuarios sin id o sin roles', () => {
  assert.throws(() => firmarToken({ roles: [ROLES.DOCENTE] }), TypeError);
  assert.throws(() => firmarToken({ id: 1, roles: [] }), TypeError);
});

test('rechaza con 401 un token ausente', () => {
  esperarError401(() => verificarToken(undefined), /autenticarse/);
});

test('rechaza con 401 un token alterado', () => {
  const token = firmarToken(docenteSinPermiso);
  const [cabecera, , firma] = token.split('.');
  // Intenta darse el permiso CREAR_CASOS cambiando el contenido del token.
  const contenidoFalso = Buffer.from(JSON.stringify({
    sub: '3', roles: ['Docente'], permisos: ['CREAR_CASOS']
  })).toString('base64url');
  esperarError401(() => verificarToken(`${cabecera}.${contenidoFalso}.${firma}`), /no válido/);
});

test('rechaza con 401 un token firmado con otra clave', () => {
  const token = jwt.sign({ roles: ['Administrador'] }, 'otra-clave-cualquiera-de-32-caracteres!!', {
    subject: '1'
  });
  esperarError401(() => verificarToken(token), /no válido/);
});

test('rechaza con 401 un token sin firma (algoritmo none)', () => {
  const token = jwt.sign({ roles: ['Administrador'] }, null, { algorithm: 'none', subject: '1' });
  esperarError401(() => verificarToken(token), /no válido/);
});

test('rechaza con 401 un token expirado', () => {
  const haceDosHoras = Math.floor(Date.now() / 1000) - 7200;
  const token = jwt.sign(
    { roles: ['Docente'], permisos: [], iat: haceDosHoras, exp: haceDosHoras + 60 },
    SECRETO_PRUEBA,
    { subject: '2' }
  );
  esperarError401(() => verificarToken(token), /expiró/);
});

test('falla con un mensaje claro si falta JWT_SECRETO', () => {
  const original = process.env.JWT_SECRETO;
  delete process.env.JWT_SECRETO;
  try {
    assert.throws(() => firmarToken(docenteCreador), /JWT_SECRETO/);
  } finally {
    process.env.JWT_SECRETO = original;
  }
});

// ---------- Integración: middleware autenticar en una ruta ----------

function crearAppDePrueba() {
  const app = express();
  app.get('/perfil', autenticar, (req, res) => {
    res.status(200).json({ usuario: req.usuario });
  });
  app.post('/casos', autenticar, requierePermiso('CREAR_CASOS'), (_req, res) => {
    res.status(201).json({ ok: true });
  });
  return app;
}

test('sin encabezado Authorization responde 401', async () => {
  const res = await request(crearAppDePrueba()).get('/perfil').expect(401);
  assert.match(res.body.error, /autenticarse/);
});

test('con un formato distinto de Bearer responde 401', async () => {
  const token = firmarToken(docenteCreador);
  await request(crearAppDePrueba()).get('/perfil').set('Authorization', `Token ${token}`).expect(401);
});

test('con un token inválido responde 401', async () => {
  await request(crearAppDePrueba()).get('/perfil').set('Authorization', 'Bearer abc.def.ghi').expect(401);
});

test('con un token válido deja el usuario en req.usuario', async () => {
  const token = firmarToken(estudiante);
  const res = await request(crearAppDePrueba())
    .get('/perfil')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(res.body.usuario.id, 10);
  assert.deepEqual(res.body.usuario.roles, ['Estudiante']);
});

test('autenticar + requierePermiso: docente con permiso crea (201)', async () => {
  const token = firmarToken(docenteCreador);
  await request(crearAppDePrueba()).post('/casos').set('Authorization', `Bearer ${token}`).expect(201);
});

test('autenticar + requierePermiso: docente sin permiso recibe 403', async () => {
  const token = firmarToken(docenteSinPermiso);
  await request(crearAppDePrueba()).post('/casos').set('Authorization', `Bearer ${token}`).expect(403);
});