import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularEvaluacion } from './evaluacion.js';

const preguntas = [
  { decisionId: 1, opcionCorrectaId: 10 },
  { decisionId: 2, opcionCorrectaId: 20 }
];

const criterios = [
  { criterioId: 4, rubricaId: 8, ponderacion: '60.00', puntajeMaximo: '5.00' },
  { criterioId: 5, rubricaId: 8, ponderacion: 40, puntajeMaximo: 5 }
];

test('Reparte la nota según la ponderación y cuenta la pregunta vacía como cero', () => {
  const nota = calcularEvaluacion({
    preguntas,
    respuestas: [{ decisionId: 1, opcionId: 10 }],
    criterios
  });

  assert.equal(nota.correctas, 1);
  assert.equal(nota.respondidas, 1);
  assert.equal(nota.total, 2);
  assert.equal(nota.resultado, 2.5);
  assert.deepEqual(nota.criterios.map((criterio) => criterio.puntuacion), [2.5, 2.5]);
  assert.match(nota.retroalimentacionGeneral, /incompleto/i);
});

test('La ausencia deja la evaluación en cero', () => {
  const nota = calcularEvaluacion({ preguntas, respuestas: [], criterios });

  assert.equal(nota.resultado, 0);
  assert.equal(nota.respondidas, 0);
  assert.ok(nota.criterios.every((criterio) => criterio.puntuacion === 0));
  assert.match(nota.retroalimentacionGeneral, /Ausencia/);
});

test('Una respuesta que no es la esperada no suma', () => {
  const nota = calcularEvaluacion({
    preguntas: [{ decisionId: 1, opcionCorrectaId: 10 }],
    respuestas: [{ decisionId: 1, opcionId: 11 }],
    criterios: [{ criterioId: 4, rubricaId: 8, ponderacion: 100, puntajeMaximo: 5 }]
  });

  assert.equal(nota.correctas, 0);
  assert.equal(nota.respondidas, 1);
  assert.equal(nota.resultado, 0);
});
