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

// Claves ficticias solo para pruebas (las reales van en .env, nunca en Git).
process.env.CODIGO_AUTORIZACION_SECRETO = 'clave-de-prueba-solo-para-tests-0123456789';
process.env.JWT_SECRETO = 'clave-jwt-de-prueba-solo-para-tests-0123456789';

const AHORA = new Date('2026-11-03T15:00:00');
const CORREO = 'estudiante.prueba@unihumboldt.edu.co';
const CODIGO = 'ABCD2345';
const CODIGO_HASH = hashearCodigoAutorizacion(CODIGO);

const USUARIO = Object.freeze({
  id: 10,
  nombres: 'Estudiante',
  apellidos: 'Prueba',
  correoInstitucional: CORREO,
  activo: true
});

// ============================================================
// REPOSITORIO FALSO PARA EL INGRESO OTP ACTUAL
// ============================================================

// Repositorio alineado con el flujo OTP actual: el código se valida
// en CodigoLoginEstudiante y no en la convocatoria por actividad.
function crearRepositorioFalso({
  usuario = USUARIO,
  roles = ['Estudiante'],
  codigoValido = true,
  usuarioIdDelCodigo = 10,
  falla = null
} = {}) {
  return {
    async buscarAccesoPorCodigoHash() {
      return {
        autorizacion: null,
        estudiante: null,
        actividad: null,
        sesion: null
      };
    },

    async buscarUsuarioPorCorreo(correo) {
      if (falla) throw falla;
      if (!usuario || correo !== CORREO) return null;
      return { ...usuario };
    },

    async obtenerRolesYPermisos() {
      if (falla) throw falla;
      return {
        roles: [...roles],
        permisos: []
      };
    },

    async consumirCodigoLogin(codigoHash) {
      if (falla) throw falla;

      if (!codigoValido || codigoHash !== CODIGO_HASH) {
        return null;
      }

      return { usuarioId: usuarioIdDelCodigo };
    }
  };
}

// Construye una aplicación aislada para probar el ingreso OTP.
function crearAppDePrueba(opciones = {}) {
  const servicio = crearServicioAcceso(crearRepositorioFalso(opciones));
  const appPrueba = express();

  appPrueba.use(express.json());
  appPrueba.use('/api/acceso', crearRutasAcceso(async () => servicio));

  return appPrueba;
}

// Ejecuta el ingreso OTP mediante la ruta HTTP.
function ingresar(appPrueba, cuerpo) {
  return request(appPrueba)
    .post('/api/acceso/estudiantes/ingreso')
    .send(cuerpo);
}

// ============================================================
// REPOSITORIO FALSO PARA EL INGRESO LEGADO POR ACTIVIDAD
// ============================================================

// Pool falso que responde como MySQL según la tabla consultada.
function crearPoolFalso({
  convocatoria = {},
  sesion = null,
  roles = ['Estudiante'],
  falla = null
} = {}) {
  return {
    async execute(sql) {
      if (falla) throw falla;

      if (sql.includes('FROM EstudianteAutorizado')) {
        if (convocatoria === null) return [[]];

        return [[{
          actividad_id: 5,
          estudiante_id: 10,
          codigoAutorizacion: CODIGO_HASH,
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

      if (sql.includes('FROM SesionSimulacion')) {
        return [sesion ? [sesion] : []];
      }

      if (sql.includes('JOIN RolPermiso')) {
        return [[]];
      }

      if (sql.includes('JOIN Rol r')) {
        return [roles.map((nombre) => ({ nombre }))];
      }

      return [[]];
    }
  };
}

// Servicio para probar el ingreso legado mediante código de actividad.
// Estas pruebas no sustituyen ni modifican el flujo OTP actual.
function servicioLegado(opcionesPool = {}) {
  const repositorio = crearRepositorioAcceso(
    crearPoolFalso(opcionesPool)
  );

  return crearServicioAcceso(repositorio, {
    reloj: () => AHORA
  });
}

// ============================================================
// PRUEBAS DEL INGRESO OTP ACTUAL
// ============================================================

test('ingreso OTP válido: responde 200 con un token JWT del estudiante', async () => {
  const res = await ingresar(
    crearAppDePrueba(),
    { correo: CORREO, codigo: CODIGO }
  ).expect(200);

  assert.deepEqual(res.body.usuario, {
    id: 10,
    roles: ['Estudiante'],
    nombres: 'Estudiante',
    apellidos: 'Prueba',
    correo: CORREO
  });

  const usuarioDelToken = verificarToken(res.body.token);

  assert.equal(usuarioDelToken.id, 10);
  assert.deepEqual(usuarioDelToken.roles, ['Estudiante']);
  assert.equal(usuarioDelToken.actividadId, undefined);
});

test('acepta el código OTP en minúsculas y con espacios', async () => {
  await ingresar(
    crearAppDePrueba(),
    { correo: CORREO, codigo: ' abcd2345 ' }
  ).expect(200);
});

test('el ingreso OTP no depende de una convocatoria específica ni de actividadId en el token', async () => {
  const res = await ingresar(
    crearAppDePrueba(),
    { correo: CORREO, codigo: CODIGO }
  ).expect(200);

  assert.equal(res.body.usuario.actividadId, undefined);
  assert.equal(verificarToken(res.body.token).actividadId, undefined);
});

// ============================================================
// PRUEBAS DEL INGRESO LEGADO POR CÓDIGO DE ACTIVIDAD
// ============================================================

test('código de actividad válido: entrega un token JWT del estudiante con su actividad', async () => {
  const res = await servicioLegado()
    .ingresarEstudianteActividad({
      correo: CORREO,
      codigo: CODIGO
    });

  assert.equal(res.usuario.id, 10);
  assert.deepEqual(res.usuario.roles, ['Estudiante']);
  assert.equal(res.usuario.actividadId, 5);

  const usuarioDelToken = verificarToken(res.token);

  assert.equal(usuarioDelToken.id, 10);
  assert.deepEqual(usuarioDelToken.roles, ['Estudiante']);
  assert.equal(usuarioDelToken.actividadId, 5);
});

test('acepta el código de actividad en minúsculas y con espacios', async () => {
  const res = await servicioLegado()
    .ingresarEstudianteActividad({
      correo: CORREO,
      codigo: ' abcd2345 '
    });

  assert.equal(res.usuario.actividadId, 5);
});

test('código de actividad: 403 si el estudiante fue retirado de la convocatoria', async () => {
  await assert.rejects(
    servicioLegado({
      convocatoria: { estado: 'Retirado' }
    }).ingresarEstudianteActividad({
      correo: CORREO,
      codigo: CODIGO
    }),
    { statusCode: 403 }
  );
});

test('código de actividad: si la sesión ya finalizó entra solo a ver su resultado', async () => {
  const res = await servicioLegado({
    sesion: {
      estado: 'Finalizado',
      numeroIntento: 1
    }
  })
    .ingresarEstudianteActividad({
      correo: CORREO,
      codigo: CODIGO
    })
    .catch((error) => error);

  // Puede rechazar (403) o permitir consultar únicamente el resultado.
  // Nunca debe permitir iniciar una sesión nueva.
  if (res instanceof Error) {
    assert.equal(res.statusCode, 403);
  } else {
    assert.equal(res.usuario.verResultado, true);
  }
});

test('código de actividad: 403 si el usuario no tiene el rol Estudiante', async () => {
  await assert.rejects(
    servicioLegado({
      roles: ['Docente']
    }).ingresarEstudianteActividad({
      correo: CORREO,
      codigo: CODIGO
    }),
    {
      statusCode: 403,
      message: /rol Estudiante/
    }
  );
});

// ============================================================
// VALIDACIÓN DE ENTRADA DEL INGRESO OTP
// ============================================================

test('responde 400 si falta el correo o el código', async () => {
  const appPrueba = crearAppDePrueba();

  await ingresar(appPrueba, { codigo: CODIGO }).expect(400);
  await ingresar(appPrueba, { correo: CORREO }).expect(400);
  await ingresar(appPrueba, {
    correo: '   ',
    codigo: CODIGO
  }).expect(400);
  await ingresar(appPrueba, {
    correo: CORREO,
    codigo: 12345678
  }).expect(400);
  await ingresar(appPrueba, {}).expect(400);
});

// ============================================================
// RECHAZOS DEL INGRESO OTP
// ============================================================

test('responde 401 con un código OTP que no existe, expiró o ya fue usado', async () => {
  const res = await ingresar(
    crearAppDePrueba({ codigoValido: false }),
    {
      correo: CORREO,
      codigo: CODIGO
    }
  ).expect(401);

  assert.match(res.body.error, /no válidos/);
  assert.equal(res.body.token, undefined);
});

test('responde 401 con el correo de otra persona', async () => {
  await ingresar(
    crearAppDePrueba(),
    {
      correo: 'otra.persona@unihumboldt.edu.co',
      codigo: CODIGO
    }
  ).expect(401);
});

test('responde 401 si el código pertenece a otro usuario', async () => {
  await ingresar(
    crearAppDePrueba({ usuarioIdDelCodigo: 99 }),
    {
      correo: CORREO,
      codigo: CODIGO
    }
  ).expect(401);
});

test('responde 401 si la cuenta del estudiante está inactiva', async () => {
  await ingresar(
    crearAppDePrueba({
      usuario: { ...USUARIO, activo: false }
    }),
    {
      correo: CORREO,
      codigo: CODIGO
    }
  ).expect(401);
});

test('responde 403 si el usuario no tiene el rol Estudiante', async () => {
  const res = await ingresar(
    crearAppDePrueba({ roles: ['Docente'] }),
    {
      correo: CORREO,
      codigo: CODIGO
    }
  ).expect(403);

  assert.match(res.body.error, /solo para estudiantes/);
});

// ============================================================
// MANEJO DE ERRORES INTERNOS
// ============================================================

test('responde 500 sin detalles internos si falla la base de datos', async () => {
  const falla = Object.assign(
    new Error('connect ECONNREFUSED 127.0.0.1:3306'),
    { code: 'ECONNREFUSED' }
  );

  const errorOriginal = console.error;
  console.error = () => {};

  try {
    const res = await ingresar(
      crearAppDePrueba({ falla }),
      {
        correo: CORREO,
        codigo: CODIGO
      }
    ).expect(500);

    assert.equal(res.body.error, 'Error interno del servidor');
    assert.ok(!JSON.stringify(res.body).includes('3306'));
  } finally {
    console.error = errorOriginal;
  }
});

// ============================================================
// REGISTRO DE LA RUTA EN LA APLICACIÓN
// ============================================================

test('la aplicación expone POST /api/acceso/estudiantes/ingreso', async () => {
  const res = await request(app)
    .post('/api/acceso/estudiantes/ingreso')
    .send({})
    .expect(400);

  assert.match(res.body.error, /obligatorios/);
});

// ============================================================
// LÍMITE DE INTENTOS CONTRA FUERZA BRUTA
// ============================================================

test('después de 5 códigos incorrectos responde 429 para ese correo', async () => {
  const appPrueba = crearAppDePrueba({
    codigoValido: false
  });

  for (let i = 0; i < 5; i += 1) {
    await ingresar(
      appPrueba,
      {
        correo: CORREO,
        codigo: CODIGO
      }
    ).expect(401);
  }

  const res = await ingresar(
    appPrueba,
    {
      correo: CORREO,
      codigo: CODIGO
    }
  ).expect(429);

  assert.match(res.body.error, /Demasiados intentos/);
});
