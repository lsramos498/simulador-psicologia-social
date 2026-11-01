import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_AUTORIZACION,
  crearCodigoAutorizacion,
  generarCodigoAutorizacion,
  hashearCodigoAutorizacion,
  validarAccesoEstudiante,
  verificarCodigoAutorizacion
} from '../src/modules/acceso/codigos.js';

// Clave secreta ficticia solo para pruebas (la real va en .env, nunca en Git)
process.env.CODIGO_AUTORIZACION_SECRETO = 'clave-de-prueba-solo-para-tests-0123456789';

// Datos ficticios solo para pruebas
const AHORA = new Date('2026-11-03T15:00:00');

function crearRegistro(cambios = {}) {
  return {
    estudiante: {
      id: 10,
      correoInstitucional: 'estudiante.prueba@unihumboldt.edu.co',
      activo: true,
      ...cambios.estudiante
    },
    autorizacion: {
      actividad_id: 5,
      estudiante_id: 10,
      codigoAutorizacion: hashearCodigoAutorizacion('ABCD2345'),
      estado: ESTADOS_AUTORIZACION.AUTORIZADO,
      ...cambios.autorizacion
    },
    actividad: {
      id: 5,
      fechaInicio: '2026-11-03T14:00:00',
      fechaFin: '2026-11-03T18:00:00',
      ...cambios.actividad
    },
    sesion: cambios.sesion ?? null
  };
}

const credenciales = {
  correo: 'estudiante.prueba@unihumboldt.edu.co',
  codigo: 'ABCD2345'
};

function esperarError(fn, statusCode, mensaje) {
  assert.throws(fn, (error) => {
    assert.equal(error.statusCode, statusCode);
    assert.match(error.message, mensaje);
    return true;
  });
}

// ---------- Generación de códigos (RF-20) ----------

test('genera códigos de 8 caracteres sin letras ni números confusos', () => {
  const codigo = generarCodigoAutorizacion();
  assert.match(codigo, /^[A-HJKMNP-Z2-9]{8}$/);
});

test('genera códigos distintos en llamadas sucesivas', () => {
  const codigos = new Set(Array.from({ length: 200 }, generarCodigoAutorizacion));
  assert.equal(codigos.size, 200);
});

// ---------- Hash de códigos (decisión del equipo) ----------

test('el hash no contiene el código original y tiene 64 caracteres', () => {
  const hash = hashearCodigoAutorizacion('ABCD2345');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes('ABCD2345'));
});

test('el mismo código siempre produce el mismo hash (se puede buscar en la BD)', () => {
  assert.equal(hashearCodigoAutorizacion('ABCD2345'), hashearCodigoAutorizacion(' abcd2345 '));
});

test('códigos distintos producen hashes distintos', () => {
  assert.notEqual(hashearCodigoAutorizacion('ABCD2345'), hashearCodigoAutorizacion('ABCD2346'));
});

test('verificarCodigoAutorizacion acepta el código correcto y rechaza otro', () => {
  const hash = hashearCodigoAutorizacion('ABCD2345');
  assert.equal(verificarCodigoAutorizacion('abcd2345', hash), true);
  assert.equal(verificarCodigoAutorizacion('ZZZZ9999', hash), false);
  assert.equal(verificarCodigoAutorizacion('', hash), false);
  assert.equal(verificarCodigoAutorizacion('ABCD2345', null), false);
});

test('crearCodigoAutorizacion entrega el código para el correo y su hash para la BD', () => {
  const { codigo, codigoHash } = crearCodigoAutorizacion();
  assert.match(codigo, /^[A-HJKMNP-Z2-9]{8}$/);
  assert.equal(verificarCodigoAutorizacion(codigo, codigoHash), true);
});

test('falla con un mensaje claro si falta la clave secreta', () => {
  const original = process.env.CODIGO_AUTORIZACION_SECRETO;
  delete process.env.CODIGO_AUTORIZACION_SECRETO;
  try {
    assert.throws(() => hashearCodigoAutorizacion('ABCD2345'), /CODIGO_AUTORIZACION_SECRETO/);
  } finally {
    process.env.CODIGO_AUTORIZACION_SECRETO = original;
  }
});

// ---------- Acceso permitido (RF-01) ----------

test('permite el acceso con correo y código correctos', () => {
  const resultado = validarAccesoEstudiante(credenciales, crearRegistro(), AHORA);
  assert.deepEqual(resultado, { estudianteId: 10, actividadId: 5 });
});

test('acepta el correo en mayúsculas y el código con espacios o minúsculas', () => {
  const resultado = validarAccesoEstudiante(
    { correo: '  ESTUDIANTE.Prueba@unihumboldt.edu.co ', codigo: ' abcd2345 ' },
    crearRegistro(),
    AHORA
  );
  assert.equal(resultado.estudianteId, 10);
});

test('permite volver a entrar si la sesión está en curso', () => {
  const registro = crearRegistro({ sesion: { estado: 'En curso' } });
  assert.doesNotThrow(() => validarAccesoEstudiante(credenciales, registro, AHORA));
});

// ---------- Datos incompletos ----------

test('rechaza con 400 si falta el correo o el código', () => {
  esperarError(() => validarAccesoEstudiante({ codigo: 'ABCD2345' }, crearRegistro(), AHORA), 400, /obligatorios/);
  esperarError(() => validarAccesoEstudiante({ correo: credenciales.correo }, crearRegistro(), AHORA), 400, /obligatorios/);
  esperarError(() => validarAccesoEstudiante(null, crearRegistro(), AHORA), 400, /obligatorios/);
});

// ---------- Código o correo inválidos ----------

test('rechaza con 401 un código que no existe', () => {
  esperarError(() => validarAccesoEstudiante(credenciales, { autorizacion: null }, AHORA), 401, /no válidos/);
});

test('rechaza con 401 un código válido usado con el correo de otra persona', () => {
  esperarError(
    () => validarAccesoEstudiante({ ...credenciales, correo: 'otra.persona@unihumboldt.edu.co' }, crearRegistro(), AHORA),
    401,
    /no válidos/
  );
});

test('rechaza con 401 si el código pertenece a otro estudiante', () => {
  const registro = crearRegistro({ autorizacion: { estudiante_id: 99 } });
  esperarError(() => validarAccesoEstudiante(credenciales, registro, AHORA), 401, /no válidos/);
});

// ---------- Estudiante convocado ----------

test('rechaza con 403 a un estudiante retirado de la convocatoria', () => {
  const registro = crearRegistro({ autorizacion: { estado: ESTADOS_AUTORIZACION.RETIRADO } });
  esperarError(() => validarAccesoEstudiante(credenciales, registro, AHORA), 403, /no está autorizado/);
});

test('rechaza con 403 a un estudiante bloqueado', () => {
  const registro = crearRegistro({ autorizacion: { estado: ESTADOS_AUTORIZACION.BLOQUEADO } });
  esperarError(() => validarAccesoEstudiante(credenciales, registro, AHORA), 403, /no está autorizado/);
});

test('rechaza con 403 una cuenta inactiva', () => {
  const registro = crearRegistro({ estudiante: { activo: false } });
  esperarError(() => validarAccesoEstudiante(credenciales, registro, AHORA), 403, /inactiva/);
});

// ---------- Ventana de la actividad y sesión ----------

test('rechaza con 404 si la actividad del código no existe', () => {
  const registro = { ...crearRegistro(), actividad: null };
  esperarError(() => validarAccesoEstudiante(credenciales, registro, AHORA), 404, /no existe/);
});

test('rechaza con 403 antes de la fecha de inicio', () => {
  const temprano = new Date('2026-11-03T13:59:00');
  esperarError(() => validarAccesoEstudiante(credenciales, crearRegistro(), temprano), 403, /no ha comenzado/);
});

test('rechaza con 403 después de la fecha de fin', () => {
  const tarde = new Date('2026-11-03T18:01:00');
  esperarError(() => validarAccesoEstudiante(credenciales, crearRegistro(), tarde), 403, /terminó/);
});

test('rechaza con 403 si la sesión del estudiante ya finalizó', () => {
  const registro = crearRegistro({ sesion: { estado: 'Finalizado' } });
  esperarError(() => validarAccesoEstudiante(credenciales, registro, AHORA), 403, /finalizada/);
});