import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { crearServicioAcceso } from '../src/modules/acceso/acceso.service.js';
import { crearLimiteIntentos } from '../src/modules/acceso/limiteIntentos.js';
import { crearRutasAcceso } from '../src/routes/acceso.routes.js';

/**
 * POST /api/acceso/estudiantes/enviar-codigo (Sofía Gallego — acceso).
 * Ruta pública: el código solo puede llegar al correo del estudiante.
 */

const AHORA = new Date('2026-11-19T15:00:00');
const CORREO = 'estudiante.prueba@unihumboldt.edu.co';
const CONVOCATORIA = {
  actividadId: 7,
  estudianteId: 20,
  correo: CORREO,
  usuarioActivo: 1,
  casoTitulo: 'Caso de prueba',
  desarrolloSituacional: 'Desarrollo',
  contextoHistoria: 'Contexto',
  mensajePersonalizado: null
};

function crearEscenario({
  convocatoria = CONVOCATORIA,
  envio = { canal: 'Correo', demo: false },
  fallaEnvio = null,
  conNotificaciones = true
} = {}) {
  const actualizaciones = [];
  const enviados = [];
  const repositorio = {
    buscarAccesoPorCodigoHash: async () => null,
    buscarUsuarioPorCorreo: async () => null,
    obtenerRolesYPermisos: async () => ({ roles: [], permisos: [] }),
    buscarConvocatoriaActivaPorCorreo: async (correo) => (correo === CORREO ? convocatoria : null),
    async actualizarCodigoAutorizacion(actividadId, estudianteId, codigoHash) {
      actualizaciones.push({ actividadId, estudianteId, codigoHash });
      return 1;
    }
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
  return { servicio, actualizaciones, enviados };
}

function crearApp(servicio) {
  const app = express();
  app.use(express.json());
  app.use('/api/acceso', crearRutasAcceso(async () => servicio));
  return app;
}

const ruta = '/api/acceso/estudiantes/enviar-codigo';

test('con SMTP real: envía el código al correo, lo reemplaza y NO lo devuelve en la respuesta', async () => {
  const { servicio, actualizaciones, enviados } = crearEscenario();
  const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].datos.destinatario, CORREO);
  assert.equal(enviados[0].datos.codigoAutorizacion, 'NUEVO234');
  assert.deepEqual(actualizaciones, [{ actividadId: 7, estudianteId: 20, codigoHash: 'hash-del-codigo-nuevo' }]);
  assert.doesNotMatch(JSON.stringify(res.body), /NUEVO234|previewUrl|codigo"/);
});

test('correo no convocado: misma respuesta que uno convocado y no envía nada', async () => {
  const convocado = crearEscenario();
  const otro = crearEscenario();
  const a = await request(crearApp(convocado.servicio)).post(ruta).send({ correo: CORREO }).expect(200);
  const b = await request(crearApp(otro.servicio)).post(ruta).send({ correo: 'nadie@unihumboldt.edu.co' }).expect(200);

  assert.deepEqual(a.body, b.body);
  assert.equal(otro.enviados.length, 0);
  assert.equal(otro.actualizaciones.length, 0);
});

test('modo demo (ethereal) o correo no entregado: no devuelve el código ni reemplaza el anterior', async () => {
  for (const envio of [{ canal: 'Sistema', demo: true, previewUrl: 'https://ethereal.email/message/x' }, { canal: 'Sistema', demo: false }]) {
    const { servicio, actualizaciones } = crearEscenario({ envio });
    const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
    assert.doesNotMatch(JSON.stringify(res.body), /NUEVO234|ethereal|previewUrl/);
    assert.equal(actualizaciones.length, 0, 'el estudiante conserva el código que ya tenía');
  }
});

test('si el envío lanza un error: respuesta genérica, sin detalles y sin reemplazar el código', async () => {
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const { servicio, actualizaciones } = crearEscenario({ fallaEnvio: new Error('Invalid login: 535 smtp.gmail.com') });
    const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
    assert.doesNotMatch(JSON.stringify(res.body), /535|gmail|NUEVO234/);
    assert.equal(actualizaciones.length, 0);
  } finally {
    console.error = errorOriginal;
  }
});

test('ACCESO_CODIGO_EN_PANTALLA=true (solo demos locales) sí muestra y guarda el código', async () => {
  process.env.ACCESO_CODIGO_EN_PANTALLA = 'true';
  try {
    const { servicio, actualizaciones } = crearEscenario({ envio: { canal: 'Sistema', demo: true } });
    const res = await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
    assert.equal(res.body.codigo, 'NUEVO234');
    assert.equal(actualizaciones.length, 1);
  } finally {
    delete process.env.ACCESO_CODIGO_EN_PANTALLA;
  }
});

test('máximo 5 solicitudes por correo: la 6.ª responde 429 aunque las anteriores salieron bien', async () => {
  const { servicio, enviados } = crearEscenario();
  const app = crearApp(servicio);
  const estados = [];
  for (let i = 0; i < 6; i += 1) {
    estados.push((await request(app).post(ruta).send({ correo: CORREO })).status);
  }
  assert.deepEqual(estados, [200, 200, 200, 200, 200, 429]);
  assert.equal(enviados.length, 5);
});

test('sin servicio de correo responde 503 igual para cualquier correo (no revela convocados)', async () => {
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

test('una cuenta inactiva no recibe código', async () => {
  const { servicio, enviados } = crearEscenario({ convocatoria: { ...CONVOCATORIA, usuarioActivo: 0 } });
  await request(crearApp(servicio)).post(ruta).send({ correo: CORREO }).expect(200);
  assert.equal(enviados.length, 0);
});
