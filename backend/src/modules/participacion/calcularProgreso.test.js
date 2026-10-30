

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

