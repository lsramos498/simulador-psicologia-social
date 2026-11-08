

import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularProgreso } from './calcularProgreso.js';


test('Calcula las preguntas pendientes', () => {
  const resultado = calcularProgreso(5, 3);

  assert.deepEqual(resultado, {
    totalPreguntas: 5,
    preguntasRespondidas: 3,
    preguntasPendientes: 2
  });
});

test('Reconoce cuando todas las preguntas están respondidas', () => {
  const resultado = calcularProgreso(5, 5);

  assert.equal(resultado.preguntasPendientes, 0);
});

test('Rechaza más respuestas que preguntas', () => {
  assert.throws(() => calcularProgreso(5, 6));
});

test('Rechaza cantidades negativas', () => {
  assert.throws(() => calcularProgreso(5, -1));
});

test('Rechaza cantidades que no sean números enteros', () => {
  assert.throws(() => calcularProgreso(5, 2.5));
});

test('Sin respuestas todas las decisiones aplicables están pendientes', () => {
  assert.deepEqual(calcularProgreso([10, 20, 40], []), {
    estadoRecorrido: 'determinado', totalPreguntas: 3,
    preguntasRespondidas: 0, preguntasPendientes: 3,
    decisionesPendientesIds: [10, 20, 40]
  });
});

test('Progreso parcial distingue opción nula y decisión sin fila', () => {
  const resultado = calcularProgreso([10, 20, 40], [
    { decisionId: 10, opcionId: 101 },
    { decisionId: 20, opcionId: null }
  ]);
  assert.equal(resultado.totalPreguntas, 3);
  assert.equal(resultado.preguntasRespondidas, 1);
  assert.equal(resultado.preguntasPendientes, 2);
  assert.deepEqual(resultado.decisionesPendientesIds, [20, 40]);
});

test('Todas respondidas no finaliza sesión ni inventa porcentaje o calificación', () => {
  assert.deepEqual(calcularProgreso([10, 20], [
    { decisionId: 10, opcionId: 101 }, { decisionId: 20, opcionId: 201 }
  ]), {
    estadoRecorrido: 'determinado', totalPreguntas: 2,
    preguntasRespondidas: 2, preguntasPendientes: 0, decisionesPendientesIds: []
  });
});

test('Cambiar opción A por B no aumenta el conteo', () => {
  const antes = calcularProgreso([10, 20], [{ decisionId: 10, opcionId: 101 }]);
  const despues = calcularProgreso([10, 20], [{ decisionId: 10, opcionId: 102 }]);
  assert.deepEqual(despues, antes);
});

test('IDs aplicables y respuestas repetidas no duplican decisiones', () => {
  const resultado = calcularProgreso([10, 20, 10, 20], [
    { decisionId: 10, opcionId: 101 }, { decisionId: 10, opcionId: 101 },
    { decisionId: 10, opcionId: 102 }
  ]);
  assert.equal(resultado.totalPreguntas, 2);
  assert.equal(resultado.preguntasRespondidas, 1);
  assert.deepEqual(resultado.decisionesPendientesIds, [20]);
});

test('Respuestas fuera del conjunto no cuentan ni alteran pendientes', () => {
  assert.deepEqual(calcularProgreso([10], [{ decisionId: 20, opcionId: 201 }]),
    calcularProgreso([10], []));
});

test('Acepta nombres de columnas MySQL y conjuntos Set', () => {
  assert.deepEqual(calcularProgreso(new Set([10, 20]), [
    { decision_id: 10, opcion_id: 101 }, { decision_id: 20, opcion_id: null }
  ]), calcularProgreso([10, 20], [{ decisionId: 10, opcionId: 101 }]));
});

test('Conjunto conocido vacío devuelve cero sin afirmar finalización', () => {
  assert.deepEqual(calcularProgreso([], [{ decisionId: 20, opcionId: 201 }]), {
    estadoRecorrido: 'determinado', totalPreguntas: 0,
    preguntasRespondidas: 0, preguntasPendientes: 0, decisionesPendientesIds: []
  });
});

for (const desconocido of [null, undefined]) {
  test(`Recorrido ${desconocido} no inventa cantidades aunque existan respuestas`, () => {
    assert.deepEqual(calcularProgreso(desconocido, [{ decisionId: 10, opcionId: 101 }]), {
      estadoRecorrido: 'indeterminado', totalPreguntas: null,
      preguntasRespondidas: null, preguntasPendientes: null, decisionesPendientesIds: null
    });
  });
}

for (const id of [0, -1, 1.5, '10', null, undefined, NaN, Infinity, 2147483648]) {
  test(`Rechaza ID aplicable inválido: ${id}`, () => {
    assert.throws(() => calcularProgreso([id], []), TypeError);
  });
  test(`Rechaza ID de decisión inválido: ${id}`, () => {
    assert.throws(() => calcularProgreso([10], [{ decisionId: id, opcionId: 101 }]), TypeError);
  });
  if (id !== null) {
    test(`Rechaza opción inválida: ${id}`, () => {
      assert.throws(() => calcularProgreso([10], [{ decisionId: 10, opcionId: id }]), TypeError);
    });
  }
}

for (const entrada of ['10,20', {}, true]) {
  test(`Rechaza colección aplicable inválida: ${JSON.stringify(entrada)}`, () => {
    assert.throws(() => calcularProgreso(entrada, []), TypeError);
  });
}

for (const entrada of [undefined, null, {}, 'respuestas', new Set()]) {
  test(`Rechaza colección de respuestas inválida: ${String(entrada)}`, () => {
    assert.throws(() => calcularProgreso([10], entrada), TypeError);
  });
}

for (const respuesta of [null, [], 10, {}, { decisionId: 10 }, { opcionId: 101 },
  { decisionId: 10, decision_id: 20, opcionId: 101 },
  { decisionId: 10, opcionId: 101, opcion_id: 102 }]) {
  test(`Rechaza respuesta inválida o contradictoria: ${JSON.stringify(respuesta)}`, () => {
    assert.throws(() => calcularProgreso([10], [respuesta]), TypeError);
  });
}

test('Valida datos incluso fuera del conjunto o con recorrido indeterminado', () => {
  assert.throws(() => calcularProgreso([], [{ decisionId: -1, opcionId: 101 }]), TypeError);
  assert.throws(() => calcularProgreso(null, [{ decisionId: 10, opcionId: '101' }]), TypeError);
});

test('No modifica las colecciones recibidas y conserva el orden aplicable', () => {
  const aplicables = Object.freeze([40, 10, 20]);
  const respuestas = Object.freeze([Object.freeze({ decisionId: 10, opcionId: 101 })]);
  assert.deepEqual(calcularProgreso(aplicables, respuestas).decisionesPendientesIds, [40, 20]);
});

test('Acepta el límite INT y alias coincidentes', () => {
  const resultado = calcularProgreso([2147483647], [{
    decisionId: 2147483647, decision_id: 2147483647, opcionId: 2147483647, opcion_id: 2147483647
  }]);
  assert.equal(resultado.preguntasRespondidas, 1);
});

test('Rechaza huecos en las colecciones', () => {
  assert.throws(() => calcularProgreso(new Array(1), []), TypeError);
  assert.throws(() => calcularProgreso([10], new Array(1)), TypeError);
});

