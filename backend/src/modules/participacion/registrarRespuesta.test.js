
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

for (const campo of ['sesionId', 'decisionId', 'opcionId']) {
  for (const valor of [undefined, null, '2', 1.5, 0, -1, 2147483648, NaN, Infinity]) {
    test(`Rechaza ${campo}=${valor} como error de entrada`, () => {
      assert.throws(() => registrarRespuesta({ sesionId: 1, decisionId: 2, opcionId: 3, [campo]: valor }), TypeError);
    });
  }
}
test('Acepta el límite INT y descarta identidad enviada en el cuerpo', () => {
  assert.deepEqual(registrarRespuesta({ sesionId: 2147483647, decisionId: 2, opcionId: 3, estudianteId: 99 }),
    { sesionId: 2147483647, decisionId: 2, opcionId: 3 });
});
