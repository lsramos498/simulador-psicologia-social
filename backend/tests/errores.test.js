import test from 'node:test';
import assert from 'node:assert/strict';
import { crearErrorHttp, responderErrorHttp } from '../src/modules/acceso/errores.js';

/**
 * Errores HTTP del módulo de acceso (Sofía Gallego — acceso y permisos).
 * La respuesta al cliente nunca debe incluir detalles internos.
 */

function crearRespuestaFalsa() {
  return {
    estado: null,
    cuerpo: null,
    status(codigo) { this.estado = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; }
  };
}

test('crearErrorHttp arma un error con su código HTTP', () => {
  const error = crearErrorHttp('No tiene permiso', 403);
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'No tiene permiso');
  assert.equal(error.statusCode, 403);
});

test('un error esperado se responde con su código y su mensaje', () => {
  const res = crearRespuestaFalsa();
  responderErrorHttp(res, crearErrorHttp('Faltan datos', 400), 'prueba');
  assert.equal(res.estado, 400);
  assert.deepEqual(res.cuerpo, { error: 'Faltan datos' });
});

test('un error inesperado responde 500 sin detalles internos', (t) => {
  t.mock.method(console, 'error', () => {}); // silencia el registro en la prueba
  const res = crearRespuestaFalsa();
  const error = new Error("Unknown column 'contrasenaHash' in SELECT * FROM Usuario");
  error.code = 'ER_BAD_FIELD_ERROR';

  responderErrorHttp(res, error, 'prueba');

  assert.equal(res.estado, 500);
  assert.deepEqual(res.cuerpo, { error: 'Error interno del servidor' });
  assert.ok(!JSON.stringify(res.cuerpo).includes('Usuario'));
});
