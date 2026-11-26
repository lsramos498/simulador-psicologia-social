import test from 'node:test';
import assert from 'node:assert/strict';
import { configurarZonaHorariaMySql } from './configurarZonaHoraria.js';

test('configura la zona horaria SQL de cada conexión nueva del pool', () => {
  let listener;
  const pool = { on: (evento, callback) => { assert.equal(evento, 'connection'); listener = callback; } };
  const llamadas = [];
  const conexion = {
    query: (...args) => llamadas.push(args),
    destroy: () => assert.fail('No debe destruir una conexión válida')
  };

  assert.equal(configurarZonaHorariaMySql(pool, '-05:00'), pool);
  listener(conexion);

  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0][0], 'SET SESSION time_zone = ?');
  assert.deepEqual(llamadas[0][1], ['-05:00']);
  assert.equal(typeof llamadas[0][2], 'function');
});

test('destruye la conexión si MySQL rechaza la zona horaria configurada', () => {
  let listener;
  let destruida = false;
  const originalError = console.error;
  console.error = () => {};
  try {
    configurarZonaHorariaMySql(
      { on: (_evento, callback) => { listener = callback; } },
      '-05:00'
    );
    listener({
      query: (_sql, _params, callback) => callback(new Error('zona inválida')),
      destroy: () => { destruida = true; }
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(destruida, true);
});
