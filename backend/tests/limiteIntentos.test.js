import test from 'node:test';
import assert from 'node:assert/strict';
import { crearLimiteIntentos, LIMITE_POR_DEFECTO } from '../src/modules/acceso/limiteIntentos.js';

/**
 * Límite de intentos de ingreso (Sofía Gallego — acceso y permisos).
 * Pruebas unitarias: el reloj es falso para no esperar 15 minutos de verdad.
 */

function crearReloj(inicio = 0) {
  let ahora = inicio;
  return {
    reloj: () => ahora,
    avanzar: (ms) => { ahora += ms; }
  };
}

test('por defecto bloquea tras 5 fallos durante 15 minutos', () => {
  assert.deepEqual(LIMITE_POR_DEFECTO, { maxIntentos: 5, bloqueoMs: 15 * 60 * 1000 });
});

test('no bloquea antes de llegar al máximo de fallos', () => {
  const limite = crearLimiteIntentos({ maxIntentos: 3 });
  limite.registrarFallo('a@x.co');
  limite.registrarFallo('a@x.co');
  assert.equal(limite.estaBloqueado('a@x.co'), false);
});

test('bloquea al llegar al máximo de fallos', () => {
  const limite = crearLimiteIntentos({ maxIntentos: 3 });
  for (let i = 0; i < 3; i += 1) limite.registrarFallo('a@x.co');
  assert.equal(limite.estaBloqueado('a@x.co'), true);
});

test('cada clave lleva su propia cuenta', () => {
  const limite = crearLimiteIntentos({ maxIntentos: 2 });
  limite.registrarFallo('a@x.co');
  limite.registrarFallo('a@x.co');
  assert.equal(limite.estaBloqueado('a@x.co'), true);
  assert.equal(limite.estaBloqueado('b@x.co'), false);
});

test('un ingreso correcto (reiniciar) borra los fallos acumulados', () => {
  const limite = crearLimiteIntentos({ maxIntentos: 2 });
  limite.registrarFallo('a@x.co');
  limite.reiniciar('a@x.co');
  limite.registrarFallo('a@x.co');
  assert.equal(limite.estaBloqueado('a@x.co'), false);
});

test('el bloqueo se levanta cuando pasa el tiempo de bloqueo', () => {
  const { reloj, avanzar } = crearReloj();
  const limite = crearLimiteIntentos({ maxIntentos: 1, bloqueoMs: 1000, reloj });
  limite.registrarFallo('a@x.co');
  assert.equal(limite.estaBloqueado('a@x.co'), true);

  avanzar(999);
  assert.equal(limite.estaBloqueado('a@x.co'), true);

  avanzar(1);
  assert.equal(limite.estaBloqueado('a@x.co'), false);
});

test('después de vencer el bloqueo, la cuenta empieza de cero', () => {
  const { reloj, avanzar } = crearReloj();
  const limite = crearLimiteIntentos({ maxIntentos: 2, bloqueoMs: 1000, reloj });
  limite.registrarFallo('a@x.co');
  limite.registrarFallo('a@x.co');
  avanzar(1000);
  limite.registrarFallo('a@x.co');
  assert.equal(limite.estaBloqueado('a@x.co'), false);
});

test('rechaza una configuración inválida', () => {
  assert.throws(() => crearLimiteIntentos({ maxIntentos: 0 }), TypeError);
  assert.throws(() => crearLimiteIntentos({ bloqueoMs: -1 }), TypeError);
});
