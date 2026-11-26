
import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarRespuesta } from './registrarRespuesta.js';

test('Valida una respuesta con datos correctos', () => {
  const datos = {
    sesionId: 1,
    decisionId: 3,
    opcionId: 4
  };

  const resultado = registrarRespuesta(datos);

  assert.deepEqual(resultado, datos);
});

test('Rechaza una respuesta sin opción', () => {
  const datos = {
    sesionId: 1,
    decisionId: 3
  };

  assert.throws(() => registrarRespuesta(datos));
});

test('Rechaza una respuesta sin datos', () => {
  assert.throws(() => registrarRespuesta(null), TypeError);
});

test('Rechaza identificadores incorrectos', () => {
  assert.throws(() => registrarRespuesta({
    sesionId: -1,
    decisionId: 3,
    opcionId: 4
  }));
});
