import test from 'node:test';
import assert from 'node:assert/strict';
import {
  datosActualizacionDecision,
  datosActualizacionEscena
} from '../src/modules/casos/caso.validacion.js';

test('datosActualizacionEscena recorta el nombre y exige contexto', () => {
  const escena = datosActualizacionEscena({
    nombre: '  El aula  ',
    contexto: 'Inicio de la discusión.',
    orden: 2,
    esFinal: false
  });

  assert.equal(escena.nombre, 'El aula');
  assert.equal(escena.orden, 2);
  assert.throws(
    () => datosActualizacionEscena({
      nombre: 'Aula',
      contexto: '   ',
      orden: 1,
      esFinal: false
    }),
    (error) => error.errores.some((item) => item.includes('contexto'))
  );
});

test('datosActualizacionDecision acepta ayuda opcional', () => {
  const decision = datosActualizacionDecision({
    pregunta: '  ¿Qué hace Ana?  ',
    orden: 1
  });

  assert.equal(decision.pregunta, '¿Qué hace Ana?');
  assert.equal(decision.ayuda, null);
});
