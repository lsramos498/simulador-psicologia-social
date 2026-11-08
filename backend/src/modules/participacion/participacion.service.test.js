import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioParticipacion } from './participacion.service.js';
import { crearRepositorioParticipacion } from './participacion.repository.js';

const datos = { sesionId: 1, decisionId: 2, opcionId: 3 };

function preparar(cambios = {}) {
  const llamadas = [];
  const repositorio = {
    obtenerSesion: async () => ({ estudianteId: 7, estado: 'En curso', casoId: 9 }),
    opcionValida: async () => true,
    obtenerRespuesta: async () => null,
    insertarRespuesta: async (respuesta) => { llamadas.push(respuesta); return 10; },
    actualizarRespuesta: async () => 1,
    consultarRespuestas: async () => [{ id: 10, ...datos }],
    ...cambios
  };
  repositorio.enTransaccion = async (operacion) => operacion(repositorio);
  return { servicio: crearServicioParticipacion(repositorio), llamadas };
}

test('El servicio registra una respuesta válida', async () => {
  const { servicio, llamadas } = preparar();
  assert.deepEqual(await servicio.registrar(datos, 7), { id: 10, ...datos });
  assert.deepEqual(llamadas, [datos]);
});

for (const entrada of [null, {}, { ...datos, opcionId: 0 }, { ...datos, decisionId: '2' },
  { ...datos, sesionId: 2147483648 }]) {
  test(`Rechaza datos inválidos: ${JSON.stringify(entrada)}`, async () => {
    const { servicio, llamadas } = preparar();
    await assert.rejects(servicio.registrar(entrada, 7));
    assert.equal(llamadas.length, 0);
  });
}

for (const estudianteId of [undefined, -1, '7']) {
  test(`Rechaza identidad provisional inválida: ${estudianteId}`, async () => {
    await assert.rejects(preparar().servicio.registrar(datos, estudianteId), TypeError);
  });
}

for (const [nombre, cambios, codigo] of [
  ['sesión inexistente', { obtenerSesion: async () => null }, 'SESION_NO_EXISTE'],
  ['sesión ajena', { obtenerSesion: async () => ({ estudianteId: 8 }) }, 'SESION_AJENA'],
  ...['Sin iniciar', 'Finalizado'].map((estado) => [estado, {
    obtenerSesion: async () => ({ estudianteId: 7, estado })
  }, 'ESTADO_NO_PERMITIDO']),
  ['relación caso/decisión/opción inválida', { opcionValida: async () => false }, 'OPCION_INVALIDA']
]) {
  test(`No guarda ante ${nombre}`, async () => {
    const { servicio, llamadas } = preparar(cambios);
    await assert.rejects(servicio.registrar(datos, 7), { codigo });
    assert.equal(llamadas.length, 0);
  });
}

test('Cambia la respuesta mientras la sesión sigue en curso', async () => {
  const actualizadas = [];
  const { servicio, llamadas } = preparar({
    obtenerRespuesta: async () => ({ id: 10, opcionId: 3, fechaRespuesta: new Date('2026-11-01'), fechaModificacion: null }),
    actualizarRespuesta: async (id, opcionId) => {
      actualizadas.push({ id, opcionId });
      return 1;
    }
  });

  const resultado = await servicio.registrar({ ...datos, opcionId: 4 }, 7);

  assert.equal(resultado.id, 10);
  assert.equal(resultado.opcionId, 4);
  assert.deepEqual(actualizadas, [{ id: 10, opcionId: 4 }]);
  assert.equal(llamadas.length, 0);
});

test('Consulta respuestas del propietario incluso después de finalizar', async () => {
  const { servicio } = preparar({ obtenerSesion: async () => ({ estudianteId: 7, estado: 'Finalizado' }) });
  assert.deepEqual(await servicio.consultar(1, 7), [{ id: 10, ...datos }]);
});

test('Consulta vacía y rechazo de consultas ajenas, inexistentes o inválidas', async () => {
  assert.deepEqual(await preparar({ consultarRespuestas: async () => [] }).servicio.consultar(1, 7), []);
  await assert.rejects(preparar().servicio.consultar(1, 8), { codigo: 'SESION_AJENA' });
  await assert.rejects(preparar({ obtenerSesion: async () => null }).servicio.consultar(1, 7), { codigo: 'SESION_NO_EXISTE' });
  await assert.rejects(preparar().servicio.consultar('1', 7), TypeError);
});

test('Traduce la restricción UNIQUE y propaga otros fallos de persistencia', async () => {
  await assert.rejects(preparar({ insertarRespuesta: async () => {
    throw Object.assign(new Error('Duplicado SQL'), { code: 'ER_DUP_ENTRY' });
  } }).servicio.registrar(datos, 7), { codigo: 'RESPUESTA_DUPLICADA' });
  const error = new Error('Sin conexión');
  await assert.rejects(preparar({ insertarRespuesta: async () => { throw error; } }).servicio.registrar(datos, 7), (actual) => actual === error);
});

test('El repositorio confirma la transacción antes de devolver el resultado', async () => {
  const llamadas = [];
  const conexion = {
    beginTransaction: async () => llamadas.push('inicio'),
    commit: async () => llamadas.push('commit'),
    rollback: async () => llamadas.push('rollback'),
    release: () => llamadas.push('release')
  };
  const repo = crearRepositorioParticipacion({ getConnection: async () => conexion });
  assert.equal(await repo.enTransaccion(async () => 10), 10);
  assert.deepEqual(llamadas, ['inicio', 'commit', 'release']);
  llamadas.length = 0;
  const error = new Error('Fallo de commit');
  conexion.commit = async () => { llamadas.push('commit'); throw error; };
  await assert.rejects(repo.enTransaccion(async () => 10), (actual) => actual === error);
  assert.deepEqual(llamadas, ['inicio', 'commit', 'rollback', 'release']);
  llamadas.length = 0;
  await assert.rejects(repo.enTransaccion(async () => { throw error; }), (actual) => actual === error);
  assert.deepEqual(llamadas, ['inicio', 'rollback', 'release']);
});

const original = { id: 10, opcionId: 3, fechaRespuesta: new Date('2026-11-01'), fechaModificacion: null };
test('Repetir opción no escribe ni cambia fechas', async () => {
  let cambios = 0;
  const { servicio } = preparar({ obtenerRespuesta: async () => original,
    actualizarRespuesta: async () => { cambios++; return 1; } });
  await servicio.registrar(datos, 7);
  assert.equal(cambios, 0);
  assert.equal(original.fechaModificacion, null);
});
test('Completa fila pendiente con el mismo ID y modo primera respuesta', async () => {
  let argumentos;
  const { servicio, llamadas } = preparar({
    obtenerRespuesta: async () => ({ id: 10, opcionId: null, fechaRespuesta: null, fechaModificacion: null }),
    actualizarRespuesta: async (...args) => { argumentos = args; return 1; }
  });
  assert.equal((await servicio.registrar(datos, 7)).id, 10);
  assert.deepEqual(argumentos, [10, 3, 1, 2, true]);
  assert.equal(llamadas.length, 0);
});
for (const fila of [
  { ...original, fechaRespuesta: null },
  { ...original, fechaRespuesta: new Date(NaN) },
  { ...original, fechaModificacion: new Date('2026-10-01') },
  { ...original, opcionId: null },
  { ...original, opcionId: 0 },
  { ...original, fechaModificacion: '2026-11-02' }
]) {
  test(`Rechaza datos existentes incoherentes ${JSON.stringify(fila)}`, async () => {
    let cambios = 0;
    const { servicio } = preparar({ obtenerRespuesta: async () => fila,
      actualizarRespuesta: async () => { cambios++; return 1; } });
    await assert.rejects(servicio.registrar(datos, 7), { codigo: 'RESPUESTA_INCONSISTENTE' });
    assert.equal(cambios, 0);
  });
}
test('Una actualización sin fila afectada es un fallo de integridad', async () => {
  const { servicio } = preparar({ obtenerRespuesta: async () => original, actualizarRespuesta: async () => 0 });
  await assert.rejects(servicio.registrar({ ...datos, opcionId: 4 }, 7), { codigo: 'RESPUESTA_INCONSISTENTE' });
});
for (const estado of ['Sin iniciar', 'Finalizado']) {
  test(`No modifica respuesta existente en ${estado}`, async () => {
    let leidas = 0;
    const { servicio } = preparar({ obtenerSesion: async () => ({ estudianteId: 7, estado }),
      obtenerRespuesta: async () => { leidas++; return original; } });
    await assert.rejects(servicio.registrar({ ...datos, opcionId: 4 }, 7), { codigo: 'ESTADO_NO_PERMITIDO' });
    assert.equal(leidas, 0);
  });
}

// Simula el contrato de exclusión; no demuestra bloqueos de MySQL.
function prepararConcurrencia() {
  let cola = Promise.resolve();
  let fila = null;
  let estado = 'En curso';
  let inserciones = 0;
  const exclusivo = (operacion) => {
    const actual = cola.then(operacion);
    cola = actual.catch(() => {});
    return actual;
  };
  const repo = {
    enTransaccion: (operacion) => exclusivo(() => operacion(repo)),
    obtenerSesion: async (id, bloquear) => {
      assert.equal(bloquear, true);
      return { estudianteId: 7, estado, casoId: 9 };
    },
    opcionValida: async () => true,
    obtenerRespuesta: async () => fila,
    insertarRespuesta: async (respuesta) => {
      inserciones++;
      fila = { id: 10, opcionId: respuesta.opcionId, fechaRespuesta: new Date(), fechaModificacion: null };
      return 10;
    },
    actualizarRespuesta: async (id, opcionId) => { fila = { ...fila, opcionId, fechaModificacion: new Date() }; return 1; }
  };
  return { servicio: crearServicioParticipacion(repo), cerrar: () => exclusivo(async () => { estado = 'Finalizado'; }),
    leer: () => ({ fila, inserciones }) };
}
test('Solicitudes simultáneas se serializan sin duplicar filas', async () => {
  const c = prepararConcurrencia();
  await Promise.all([c.servicio.registrar(datos, 7), c.servicio.registrar({ ...datos, opcionId: 4 }, 7)]);
  assert.equal(c.leer().inserciones, 1);
  assert.equal(c.leer().fila.opcionId, 4);
});
test('Cierre confirmado primero impide responder', async () => {
  const c = prepararConcurrencia();
  const cierre = c.cerrar();
  const respuesta = c.servicio.registrar(datos, 7);
  await cierre;
  await assert.rejects(respuesta, { codigo: 'ESTADO_NO_PERMITIDO' });
  assert.equal(c.leer().fila, null);
});
test('Respuesta confirmada primero se conserva después del cierre', async () => {
  const c = prepararConcurrencia();
  const respuesta = c.servicio.registrar(datos, 7);
  const cierre = c.cerrar();
  await respuesta;
  await cierre;
  await assert.rejects(c.servicio.registrar({ ...datos, opcionId: 4 }, 7), { codigo: 'ESTADO_NO_PERMITIDO' });
  assert.equal(c.leer().fila.opcionId, 3);
});
