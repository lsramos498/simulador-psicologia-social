import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS_CASO } from '../src/modules/casos/caso.model.js';

test('los estados del caso coinciden con el esquema', () => {
  assert.deepEqual(
    Object.values(ESTADOS_CASO),
    ['Borrador', 'Publicado', 'Archivado']
  );
});
