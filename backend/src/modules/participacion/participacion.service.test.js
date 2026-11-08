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
    obtenerDecisionesAplicables: async () => [2],
    consultarRespuestasParaProgreso: async () => [datos],
    ...cambios
  };
  repositorio.enTransaccion = async (operacion) => operacion(repositorio);
  return { servicio: crearServicioParticipacion(repositorio), llamadas };
}

test('El servicio registra una respuesta válida', async () => {
  const { servicio, llamadas } = preparar();
  assert.deepEqual(await servicio.registrar(datos, 7), { id: 10, ...datos,
    progreso: { estadoRecorrido: 'determinado', totalPreguntas: 1,
      preguntasRespondidas: 1, preguntasPendientes: 0, decisionesPendientesIds: [] } });
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
    obtenerDecisionesAplicables: async () => [2],
    consultarRespuestasParaProgreso: async () => fila ? [{ ...fila, decisionId: 2 }] : [],
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

test('Consulta progreso usa el caso de la sesión y el mismo contexto transaccional', async () => {
  const llamadas = [];
  const { servicio } = preparar({
    obtenerSesion: async (id, bloquear) => {
      llamadas.push(['sesion', id, bloquear]);
      return { estudianteId: 7, casoId: 9, estado: 'En curso' };
    },
    obtenerDecisionesAplicables: async (casoId) => { llamadas.push(['caso', casoId]); return [2, 5, 8]; },
    consultarRespuestasParaProgreso: async (...args) => {
      llamadas.push(['respuestas', ...args]);
      return [{ decisionId: 2, opcionId: 3 }, { decisionId: 5, opcionId: null }];
    }
  });
  assert.deepEqual(await servicio.consultarProgreso(1, 7), {
    estadoRecorrido: 'determinado', totalPreguntas: 3, preguntasRespondidas: 1,
    preguntasPendientes: 2, decisionesPendientesIds: [5, 8]
  });
  assert.deepEqual(llamadas, [['sesion', 1, true], ['caso', 9], ['respuestas', 1, 9]]);
});

for (const [nombre, sesion, codigo] of [
  ['ajena', { estudianteId: 8, casoId: 9 }, 'SESION_AJENA'],
  ['inexistente', null, 'SESION_NO_EXISTE']
]) {
  test(`Progreso de sesión ${nombre} no consulta contenido ni respuestas`, async () => {
    let lecturas = 0;
    const { servicio } = preparar({ obtenerSesion: async () => sesion,
      obtenerDecisionesAplicables: async () => { lecturas++; return []; },
      consultarRespuestasParaProgreso: async () => { lecturas++; return []; } });
    await assert.rejects(servicio.consultarProgreso(1, 7), { codigo });
    assert.equal(lecturas, 0);
  });
}

test('Consulta de progreso rechaza IDs inválidos', async () => {
  for (const [sesionId, estudianteId] of [['1', 7], [0, 7], [1, null], [1, -1]]) {
    await assert.rejects(preparar().servicio.consultarProgreso(sesionId, estudianteId), TypeError);
  }
});

test('Progreso vacío y conteos diferentes según el caso recibido', async () => {
  for (const ids of [[], [2], [2, 5, 8, 10]]) {
    const { servicio } = preparar({ obtenerDecisionesAplicables: async () => ids,
      consultarRespuestasParaProgreso: async () => [] });
    const progreso = await servicio.consultarProgreso(1, 7);
    assert.equal(progreso.totalPreguntas, ids.length);
    assert.equal(progreso.preguntasRespondidas, 0);
    assert.deepEqual(progreso.decisionesPendientesIds, ids);
  }
});

test('Consultar progreso de sesión finalizada no ejecuta cambios de estado', async () => {
  const sesion = Object.freeze({ estudianteId: 7, casoId: 9, estado: 'Finalizado' });
  const { servicio } = preparar({ obtenerSesion: async () => sesion });
  assert.equal((await servicio.consultarProgreso(1, 7)).preguntasRespondidas, 1);
  assert.equal(sesion.estado, 'Finalizado');
});

test('Registrar, modificar y repetir devuelven progreso posterior a la escritura', async () => {
  const c = prepararConcurrencia();
  const primera = await c.servicio.registrar(datos, 7);
  const modificada = await c.servicio.registrar({ ...datos, opcionId: 4 }, 7);
  const repetida = await c.servicio.registrar({ ...datos, opcionId: 4 }, 7);
  assert.equal(primera.progreso.preguntasRespondidas, 1);
  assert.deepEqual(modificada.progreso, primera.progreso);
  assert.deepEqual(repetida.progreso, primera.progreso);
  assert.equal(c.leer().inserciones, 1);
});

test('Fallo al consultar progreso después de insertar provoca rollback y no devuelve éxito', async () => {
  const pasos = [];
  const error = new Error('fallo de lectura simulado');
  const conexion = {
    beginTransaction: async () => pasos.push('inicio'),
    commit: async () => pasos.push('commit'),
    rollback: async () => pasos.push('rollback'), release: () => pasos.push('release'),
    execute: async (sql) => {
      if (sql.includes('FROM SesionSimulacion')) return [[{ estudianteId: 7, casoId: 9, estado: 'En curso' }]];
      if (sql.includes('SELECT o.id')) return [[{ id: 3 }]];
      if (sql.includes('FROM RespuestaEstudiante')) return [[]];
      if (sql.includes('INSERT INTO')) { pasos.push('insertar'); return [{ insertId: 10 }]; }
      throw error;
    }
  };
  const servicio = crearServicioParticipacion(crearRepositorioParticipacion({ getConnection: async () => conexion }));
  await assert.rejects(servicio.registrar(datos, 7), (actual) => actual === error);
  assert.deepEqual(pasos, ['inicio', 'insertar', 'rollback', 'release']);
});

test('Respuesta y progreso solo se entregan después del commit', async () => {
  const pasos = [];
  let confirmar;
  const espera = new Promise((resolve) => { confirmar = resolve; });
  const tx = {
    obtenerSesion: async () => ({ estudianteId: 7, casoId: 9, estado: 'En curso' }),
    opcionValida: async () => true, obtenerRespuesta: async () => null,
    insertarRespuesta: async () => 10, obtenerDecisionesAplicables: async () => [2],
    consultarRespuestasParaProgreso: async () => { pasos.push('calculo'); return [datos]; }
  };
  const servicio = crearServicioParticipacion({ enTransaccion: async (operacion) => {
    const resultado = await operacion(tx);
    await espera;
    pasos.push('commit');
    return resultado;
  } });
  const resultado = servicio.registrar(datos, 7).then((respuesta) => { pasos.push('entrega'); return respuesta; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(pasos, ['calculo']);
  confirmar();
  assert.equal((await resultado).progreso.preguntasRespondidas, 1);
  assert.deepEqual(pasos, ['calculo', 'commit', 'entrega']);
});
