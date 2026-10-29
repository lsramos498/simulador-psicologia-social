
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  puedeModificarRespuesta
} = require('./puedeModificarRespuesta');

test('Permite modificar si la participación no ha finalizado', () => {
  const resultado = puedeModificarRespuesta(false);

  assert.equal(resultado, true);
});

test('No permite modificar si la participación ya finalizó', () => {
  const resultado = puedeModificarRespuesta(true);

  assert.equal(resultado, false);
});

test('Rechaza un estado de finalización inválido', () => {
  assert.throws(
    () => puedeModificarRespuesta('finalizada'),
    TypeError
  );
});
