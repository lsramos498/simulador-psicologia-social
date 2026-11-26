import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioParticipacion } from './participacion.service.js';
import { crearRepositorioParticipacion } from './participacion.repository.js';

const datos = { sesionId: 1, decisionId: 2, opcionId: 3 };

function sesionEnCurso(extra = {}) {
  const ahora = Date.now();
  return {
    id: 1,
    actividadId: 3,
    estudianteId: 7,
    estado: 'En curso',
    casoId: 9,
    inicio: new Date(ahora - 5_000),
    tiempoLimiteSegundos: 600,
    estadoActividad: 'Iniciada',
    fechaInicio: new Date(ahora - 60_000),
    fechaFin: new Date(ahora + 3_600_000),
    estadoAutorizacion: 'Autorizado',
    ...extra
  };
}

function preparar(cambios = {}) {
  const llamadas = [];
  const repositorio = {
    obtenerSesion: async () => sesionEnCurso(),
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
  ['sesión ajena', { obtenerSesion: async () => sesionEnCurso({ estudianteId: 8 }) }, 'SESION_AJENA'],
  ...['Sin iniciar', 'Finalizado'].map((estado) => [estado, {
    obtenerSesion: async () => sesionEnCurso({ estado })
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
    obtenerRespuesta: async () => ({ id: 10 }),
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

test('El docente de la actividad puede consultar respuestas ajenas', async () => {
  const { servicio } = preparar({
    obtenerSesion: async () => sesionEnCurso({ estudianteId: 7, docenteId: 55 })
  });
  assert.deepEqual(
    await servicio.consultar(1, { id: 55, roles: ['Docente'] }),
    [{ id: 10, ...datos }]
  );
});

test('Un administrador puede consultar respuestas de cualquier sesión', async () => {
  const { servicio } = preparar({
    obtenerSesion: async () => sesionEnCurso({ estudianteId: 7, docenteId: 55 })
  });
  assert.deepEqual(
    await servicio.consultar(1, { id: 99, roles: ['Administrador'] }),
    [{ id: 10, ...datos }]
  );
});

test('Consulta vacía y rechazo de consultas ajenas, inexistentes o inválidas', async () => {
  assert.deepEqual(await preparar({ consultarRespuestas: async () => [] }).servicio.consultar(1, 7), []);
  await assert.rejects(preparar().servicio.consultar(1, 8), { codigo: 'SESION_AJENA' });
  await assert.rejects(
    preparar({ obtenerSesion: async () => sesionEnCurso({ estudianteId: 7, docenteId: 55 }) })
      .servicio.consultar(1, { id: 99, roles: ['Docente'] }),
    { codigo: 'SESION_AJENA' }
  );
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

test('Rechaza una respuesta cuando se agotó el tiempo de la sesión', async () => {
  const { servicio, llamadas } = preparar({
    obtenerSesion: async () => sesionEnCurso({
      inicio: new Date(Date.now() - 10_000),
      tiempoLimiteSegundos: 1
    })
  });
  await assert.rejects(servicio.registrar(datos, 7), { codigo: 'TIEMPO_AGOTADO' });
  assert.equal(llamadas.length, 0);
});

test('Calcula el progreso y oculta la retroalimentación mientras la sesión sigue en curso', async () => {
  const { servicio } = preparar({
    contarPreguntas: async () => 4,
    contarRespuestas: async () => 1,
    listarRetroalimentacion: async () => [{ decisionId: 2, explicacion: 'Porque' }]
  });
  assert.deepEqual(await servicio.progreso(1, 7), {
    totalPreguntas: 4,
    preguntasRespondidas: 1,
    preguntasPendientes: 3
  });
  await assert.rejects(servicio.retroalimentacion(1, 7), { codigo: 'ESTADO_NO_PERMITIDO' });
});
