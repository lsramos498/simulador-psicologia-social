import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioEspacios } from './espacios.service.js';

function repositorioFalso() {
  const espacios = [];
  return {
    espacios,
    async insertar({ nombre, codigo }) {
      if (codigo && espacios.some((espacio) => espacio.codigo === codigo)) {
        throw Object.assign(new Error('duplicado'), { code: 'ER_DUP_ENTRY' });
      }
      const id = espacios.length + 1;
      espacios.push({ id, nombre, codigo, activo: 1 });
      return id;
    },
    async listar() {
      return espacios;
    }
  };
}

test('Crea un espacio académico y lo lista como activo', async () => {
  const servicio = crearServicioEspacios(repositorioFalso());
  const creado = await servicio.crear({ nombre: '  Psicología social  ', codigo: ' PS-1 ' });

  assert.deepEqual(creado, { id: 1, nombre: 'Psicología social', codigo: 'PS-1', activo: true });
  assert.deepEqual(await servicio.listar(), [creado]);
});

test('Rechaza un espacio sin nombre y un código repetido', async () => {
  const servicio = crearServicioEspacios(repositorioFalso());
  await assert.rejects(servicio.crear({ nombre: '   ' }), { statusCode: 400 });
  await servicio.crear({ nombre: 'Aula 1', codigo: 'A1' });
  await assert.rejects(servicio.crear({ nombre: 'Aula 2', codigo: 'A1' }), { statusCode: 409 });
});
