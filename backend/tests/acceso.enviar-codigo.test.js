import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { crearServicioAcceso } from '../src/modules/acceso/acceso.service.js';
import { crearLimiteIntentos } from '../src/modules/acceso/limiteIntentos.js';
import { crearRutasAcceso } from '../src/routes/acceso.routes.js';
import { TIPOS_NOTIFICACION } from '../src/modules/notificaciones/notificaciones.factory.js';

/**
 * POST /api/acceso/estudiantes/enviar-codigo
 * OTP de inicio de sesión (no código de una actividad).
 */

const AHORA = new Date('2026-11-19T15:00:00');
const CORREO = 'estudiante.prueba@unihumboldt.edu.co';
const USUARIO = {
  id: 20,
  correoInstitucional: CORREO,
  activo: 1,
  nombres: 'Ana',
  apellidos: 'Prueba'
};

function crearEscenario({
  usuario = USUARIO,
  roles = ['Estudiante'],
  envio = { canal: 'Correo', demo: false },
  fallaEnvio = null,
  conNotificaciones = true
} = {}) {
  const codigosGuardados = [];
  const enviados = [];
  const repositorio = {
    buscarAccesoPorCodigoHash: async () => null,
    buscarUsuarioPorCorreo: async (correo) =>
      correo === CORREO && usuario ? { ...usuario } : null,
    obtenerRolesYPermisos: async () => ({ roles, permisos: [] }),
    async guardarCodigoLogin(usuarioId, codigoHash, expiraEn) {
      codigosGuardados.push({ usuarioId, codigoHash, expiraEn });
      return 1;
    },
    consumirCodigoLogin: async () => null,
    listarActividadesDelEstudiante: async () => []
  };
  const notificaciones = {
    async enviar(tipo, datos) {
      enviados.push({ tipo, datos });
      if (fallaEnvio) throw fallaEnvio;
      return envio;
    }
  };
  const servicio = crearServicioAcceso(repositorio, {
    reloj: () => AHORA,
    limiteIntentos: crearLimiteIntentos({ reloj: () => AHORA.getTime() }),
    notificaciones: conNotificaciones ? notificaciones : null,
    generarCodigo: () => ({ codigo: 'NUEVO234', codigoHash: 'hash-del-codigo-nuevo' })
  });
  return { servicio, codigosGuardados, enviados };
}

function crearApp(servicio) {
  const app = express();
  app.use(express.json());
  app.use('/api/acceso', crearRutasAcceso(async () => servicio));
  return app;
}

const ruta = '/api/acceso/estudiantes/enviar-codigo';

test('con SMTP real: envía OTP de sesión, lo guarda y NO lo devuelve en la respuesta', async () => {
  const { servicio, codigosGuardados, enviados } = crearEscenario();
  const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].tipo, TIPOS_NOTIFICACION.CODIGO_SESION);
  assert.equal(enviados[0].datos.destinatario, CORREO);
  assert.equal(enviados[0].datos.codigoAutorizacion, 'NUEVO234');
  assert.equal(codigosGuardados.length, 1);
  assert.equal(codigosGuardados[0].usuarioId, 20);
  assert.equal(codigosGuardados[0].codigoHash, 'hash-del-codigo-nuevo');
  assert.doesNotMatch(JSON.stringify(res.body), /NUEVO234|previewUrl|codigo"/);
});

test('correo desconocido: misma respuesta genérica y no envía nada', async () => {
  const conocido = crearEscenario();
  const otro = crearEscenario();
  const a = await request(crearApp(conocido.servicio)).post(ruta).send({ correo: CORREO }).expect(200);
  const b = await request(crearApp(otro.servicio))
    .post(ruta)
    .send({ correo: 'nadie@unihumboldt.edu.co' })
    .expect(200);

  assert.deepEqual(a.body, b.body);
  assert.equal(otro.enviados.length, 0);
  assert.equal(otro.codigosGuardados.length, 0);
});

test('modo demo: guarda el OTP y NUNCA lo devuelve en la respuesta', async () => {
  const { servicio, codigosGuardados } = crearEscenario({
    envio: { canal: 'Sistema', demo: true, previewUrl: 'https://ethereal.email/message/x' }
  });
  const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
  assert.doesNotMatch(JSON.stringify(res.body), /NUEVO234|codigo"/);
  assert.equal(codigosGuardados.length, 1);
});

test('si el envío lanza un error: respuesta genérica y sin guardar código', async () => {
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const { servicio, codigosGuardados } = crearEscenario({
      fallaEnvio: new Error('Invalid login: 535 smtp.gmail.com')
    });
    const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
    assert.doesNotMatch(JSON.stringify(res.body), /535|gmail|NUEVO234/);
    assert.equal(codigosGuardados.length, 0);
  } finally {
    console.error = errorOriginal;
  }
});

test('ACCESO_CODIGO_EN_PANTALLA=true: demo local sí incluye el OTP en la respuesta', async () => {
  process.env.ACCESO_CODIGO_EN_PANTALLA = 'true';
  try {
    const { servicio, codigosGuardados } = crearEscenario({
      envio: { canal: 'Correo', demo: false }
    });
    const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
    assert.equal(res.body.codigoAutorizacion, 'NUEVO234');
    assert.equal(res.body.demoLocal, true);
    assert.equal(codigosGuardados.length, 1);
  } finally {
    delete process.env.ACCESO_CODIGO_EN_PANTALLA;
  }
});

test('máximo 5 solicitudes por correo: la 6.ª responde 429', async () => {
  const { servicio, enviados } = crearEscenario();
  const app = crearApp(servicio);
  const estados = [];
  for (let i = 0; i < 6; i += 1) {
    estados.push((await request(app).post(ruta).send({ correo: CORREO })).status);
  }
  assert.deepEqual(estados, [200, 200, 200, 200, 200, 429]);
  assert.equal(enviados.length, 5);
});

test('sin servicio de correo responde 503 igual para cualquier correo', async () => {
  const { servicio } = crearEscenario({ conNotificaciones: false });
  const app = crearApp(servicio);
  await request(app).post(ruta).send({ correo: CORREO }).expect(503);
  await request(app).post(ruta).send({ correo: 'nadie@unihumboldt.edu.co' }).expect(503);
});

test('sin correo o con un tipo inválido responde 400', async () => {
  const { servicio } = crearEscenario();
  const app = crearApp(servicio);
  await request(app).post(ruta).send({}).expect(400);
  await request(app).post(ruta).send({ correo: ['x'] }).expect(400);
});

test('cuenta inactiva no recibe código', async () => {
  const { servicio, enviados } = crearEscenario({
    usuario: { ...USUARIO, activo: 0 }
  });
  await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
  assert.equal(enviados.length, 0);
});

test('usuario sin rol estudiante: respuesta genérica y sin envío', async () => {
  const { servicio, enviados, codigosGuardados } = crearEscenario({ roles: ['Docente'] });
  await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
  assert.equal(enviados.length, 0);
  assert.equal(codigosGuardados.length, 0);
});
