
const test = require('node:test');
const assert = require('node:assert/strict');

const { registrarRespuesta } = require('./registrarRespuesta');

test('Registra una respuesta con todos sus datos', () => {
  const datos = {
    estudianteId: 1,
    sesionId: 2,
    preguntaId: 3,
    opcionId: 4
  };

  const resultado = registrarRespuesta(datos);

  assert.deepEqual(resultado, datos);
});

test('Rechaza una respuesta con datos incompletos', () => {
  const datos = {
    estudianteId: 1,
    sesionId: 2,
    preguntaId: 3
  };

  assert.throws(() => registrarRespuesta(datos));
});

test('Rechaza una respuesta sin datos', () => {
  assert.throws(() => registrarRespuesta(null), TypeError);
});
