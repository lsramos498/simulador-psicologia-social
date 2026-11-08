import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioParticipacion } from './participacion.repository.js';

function preparar(resultado = { affectedRows: 1, insertId: 10 }) {
  const llamadas = [];
  const conexion = { execute: async (sql, parametros) => { llamadas.push({ sql, parametros }); return [resultado]; } };
  return { repo: crearRepositorioParticipacion(conexion), llamadas };
}
test('Bloquea sesión y respuesta con parámetros', async () => {
  const { repo, llamadas } = preparar([]);
  await repo.obtenerSesion(1, true);
  await repo.obtenerRespuesta(1, 2);
  assert.match(llamadas[0].sql, /FOR UPDATE/);
  assert.match(llamadas[1].sql, /FOR UPDATE/);
  assert.match(llamadas[1].sql, /opcion_id AS opcionId, fechaRespuesta, fechaModificacion/);
  assert.deepEqual(llamadas.map(x => x.parametros), [[1], [1, 2]]);
});
test('Primera inserción usa fecha del servidor y no fecha de modificación', async () => {
  const { repo, llamadas } = preparar();
  assert.equal(await repo.insertarRespuesta({ sesionId: 1, decisionId: 2, opcionId: 3 }), 10);
  assert.match(llamadas[0].sql, /CURRENT_TIMESTAMP/);
  assert.doesNotMatch(llamadas[0].sql, /fechaModificacion/);
  assert.deepEqual(llamadas[0].parametros, [1, 2, 3]);
});
for (const primera of [false, true]) {
  test(`Actualización acotada y fechas: primera=${primera}`, async () => {
    const { repo, llamadas } = preparar();
    assert.equal(await repo.actualizarRespuesta(10, 4, 1, 2, primera), 1);
    assert.deepEqual(llamadas[0].parametros, [4, 10, 1, 2]);
    assert.match(llamadas[0].sql, /WHERE id = \? AND sesion_id = \? AND decision_id = \?/);
    if (primera) assert.match(llamadas[0].sql, /fechaRespuesta = CURRENT_TIMESTAMP, fechaModificacion = NULL/);
    else {
      assert.match(llamadas[0].sql, /fechaModificacion = CURRENT_TIMESTAMP/);
      assert.doesNotMatch(llamadas[0].sql, /fechaRespuesta =/);
    }
  });
}
test('Consulta no revela corrección ni puntuación y excluye filas pendientes', async () => {
  const { repo, llamadas } = preparar([]);
  await repo.consultarRespuestas(1);
  assert.match(llamadas[0].sql, /opcion_id IS NOT NULL/);
  assert.doesNotMatch(llamadas[0].sql, /esCorrecta|puntuacionObtenida/);
});
test('Error SQL se propaga sin convertirse en éxito', async () => {
  const error = new Error('Fallo SQL simulado');
  const repo = crearRepositorioParticipacion({ execute: async () => { throw error; } });
  await assert.rejects(repo.actualizarRespuesta(10, 4, 1, 2), e => e === error);
});
test('Rollback fallido conserva error original y libera conexión', async () => {
  const original = new Error('operación');
  const rollback = new Error('rollback');
  let liberada = false;
  const repo = crearRepositorioParticipacion({ getConnection: async () => ({
    beginTransaction: async () => {}, rollback: async () => { throw rollback; },
    release: () => { liberada = true; }
  }) });
  await assert.rejects(repo.enTransaccion(async () => { throw original; }), e => e === original && e.cause === rollback);
  assert.equal(liberada, true);
});
