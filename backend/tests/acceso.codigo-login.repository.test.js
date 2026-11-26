import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioAcceso } from '../src/modules/acceso/acceso.repository.js';

/**
 * El usuario de la aplicación (lumina_app) solo tiene SELECT, INSERT, UPDATE y
 * DELETE. Por eso el repositorio NO puede crear tablas al vuelo: la tabla
 * CodigoLoginEstudiante viene en schema.sql (o en migrations/002 para bases viejas).
 */
function crearPoolEspia() {
  const sentencias = [];
  return {
    sentencias,
    async execute(sql) {
      sentencias.push(sql);
      return [{ insertId: 1, affectedRows: 1 }];
    }
  };
}

test('guardar y consumir el código de sesión nunca ejecuta CREATE TABLE', async () => {
  const pool = crearPoolEspia();
  const repositorio = crearRepositorioAcceso(pool);
  await repositorio.guardarCodigoLogin(10, 'hash', new Date(), new Date());
  try { await repositorio.consumirCodigoLogin('hash', new Date()); } catch { /* pool espía sin filas */ }
  assert.equal(pool.sentencias.some((sql) => /CREATE\s+TABLE/i.test(sql)), false);
  assert.ok(pool.sentencias.some((sql) => /INSERT INTO CodigoLoginEstudiante/.test(sql)));
});
