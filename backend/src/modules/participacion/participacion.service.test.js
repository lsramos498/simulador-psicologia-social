import test from 'node:test';
import assert from 'node:assert/strict';

import { crearServicioParticipacion } from './participacion.service.js';
import { crearRepositorioParticipacion } from './participacion.repository.js';

const datos = {
  sesionId: 1,
  decisionId: 2,
  opcionId: 3
};

function preparar(cambios = {}) {
  const llamadas = [];
  const conexion = { identificador: 'conexion-prueba' };

  const repositorio = {
    obtenerSesion: async () => ({
      id: 1,
      estudianteId: 7,
      estado: 'En curso',
      casoId: 9
    }),
    opcionValida: async () => true,
    obtenerRespuesta: async () => null,
    insertarRespuesta: async (respuesta) => {
      llamadas.push(respuesta);
      return 10;
    },
    actualizarRespuesta: async () => 1,
    consultarRespuestas: async () => [{ id: 10, ...datos }],
    ...cambios
  };

  repositorio.enTransaccion = async (operacion) =>
    operacion(repositorio, conexion);

  const validarSesionParaResponder = async (
    sesionId,
    estudianteId,
    conexionRecibida
  ) => {
    assert.equal(sesionId, datos.sesionId);
    assert.strictEqual(conexionRecibida, conexion);

    const sesion = await repositorio.obtenerSesion(sesionId);

    if (!sesion) {
      throw Object.assign(new Error('La sesión no existe.'), {
        codigo: 'SESION_NO_EXISTE'
      });
    }

    if (sesion.estudianteId !== estudianteId) {
      throw Object.assign(
        new Error('La sesión no pertenece al estudiante indicado.'),
        { codigo: 'SESION_AJENA' }
      );
    }

    if (sesion.estado !== 'En curso') {
      throw Object.assign(
        new Error('Solo se puede responder en una sesión En curso.'),
        { codigo: 'ESTADO_NO_PERMITIDO' }
      );
    }

    return {
      permitida: true,
      codigo: null,
      mensaje: null,
      sesion,
      casoId: sesion.casoId
    };
  };

  return {
    servicio: crearServicioParticipacion(
      repositorio,
      validarSesionParaResponder
    ),
    llamadas,
    conexion,
    repositorio,
    validarSesionParaResponder
  };
}

test('El servicio registra una respuesta válida', async () => {
  const { servicio, llamadas } = preparar();

  assert.deepEqual(
    await servicio.registrar(datos, 7),
    { id: 10, ...datos }
  );

  assert.deepEqual(llamadas, [datos]);
});

for (const entrada of [
  null,
  {},
  { ...datos, opcionId: 0 },
  { ...datos, decisionId: '2' },
  { ...datos, sesionId: 2147483648 }
]) {
  test(`Rechaza datos inválidos: ${JSON.stringify(entrada)}`, async () => {
    const { servicio, llamadas } = preparar();

    await assert.rejects(servicio.registrar(entrada, 7));

    assert.equal(llamadas.length, 0);
  });
}

for (const estudianteId of [undefined, -1, '7']) {
  test(`Rechaza identidad provisional inválida: ${estudianteId}`, async () => {
    await assert.rejects(
      preparar().servicio.registrar(datos, estudianteId),
      TypeError
    );
  });
}

for (const [nombre, cambios, codigo] of [
  [
    'sesión inexistente',
    { obtenerSesion: async () => null },
    'SESION_NO_EXISTE'
  ],
  [
    'sesión ajena',
    { obtenerSesion: async () => ({ estudianteId: 8 }) },
    'SESION_AJENA'
  ],
  ...['Sin iniciar', 'Finalizado'].map((estado) => [
    estado,
    {
      obtenerSesion: async () => ({
        estudianteId: 7,
        estado,
        casoId: 9
      })
    },
    'ESTADO_NO_PERMITIDO'
  ])
]) {
  test(`No guarda ante ${nombre}`, async () => {
    const { servicio, llamadas } = preparar(cambios);

    await assert.rejects(
      servicio.registrar(datos, 7),
      { codigo }
    );

    assert.equal(llamadas.length, 0);
  });
}

test('No guarda ante una relación caso/decisión/opción inválida', async () => {
  const { servicio, llamadas } = preparar({
    opcionValida: async () => false
  });

  await assert.rejects(
    servicio.registrar(datos, 7),
    { codigo: 'OPCION_INVALIDA' }
  );

  assert.equal(llamadas.length, 0);
});

test('Cambia la respuesta mientras la sesión sigue en curso', async () => {
  const actualizadas = [];

  const { servicio, llamadas } = preparar({
    obtenerRespuesta: async () => ({ id: 10 }),
    actualizarRespuesta: async (id, opcionId) => {
      actualizadas.push({ id, opcionId });
      return 1;
    }
  });

  const resultado = await servicio.registrar(
    { ...datos, opcionId: 4 },
    7
  );

  assert.equal(resultado.id, 10);
  assert.equal(resultado.opcionId, 4);

  assert.deepEqual(actualizadas, [
    { id: 10, opcionId: 4 }
  ]);

  assert.equal(llamadas.length, 0);
});

test('Consulta respuestas del propietario incluso después de finalizar', async () => {
  const { servicio } = preparar({
    obtenerSesion: async () => ({
      estudianteId: 7,
      estado: 'Finalizado'
    })
  });

  assert.deepEqual(
    await servicio.consultar(1, 7),
    [{ id: 10, ...datos }]
  );
});

test('Consulta vacía y rechazo de consultas ajenas, inexistentes o inválidas', async () => {
  assert.deepEqual(
    await preparar({
      consultarRespuestas: async () => []
    }).servicio.consultar(1, 7),
    []
  );

  await assert.rejects(
    preparar().servicio.consultar(1, 8),
    { codigo: 'SESION_AJENA' }
  );

  await assert.rejects(
    preparar({
      obtenerSesion: async () => null
    }).servicio.consultar(1, 7),
    { codigo: 'SESION_NO_EXISTE' }
  );

  await assert.rejects(
    preparar().servicio.consultar('1', 7),
    TypeError
  );
});

test('Traduce la restricción UNIQUE y propaga otros fallos de persistencia', async () => {
  await assert.rejects(
    preparar({
      insertarRespuesta: async () => {
        throw Object.assign(new Error('Duplicado SQL'), {
          code: 'ER_DUP_ENTRY'
        });
      }
    }).servicio.registrar(datos, 7),
    { codigo: 'RESPUESTA_DUPLICADA' }
  );

  const error = new Error('Sin conexión');

  await assert.rejects(
    preparar({
      insertarRespuesta: async () => {
        throw error;
      }
    }).servicio.registrar(datos, 7),
    (actual) => actual === error
  );
});

test('El servicio de Sesiones recibe la misma conexión de Participación', async () => {
  const {
    repositorio,
    conexion,
    validarSesionParaResponder
  } = preparar();

  let conexionRecibida;

  const validador = async (
    sesionId,
    estudianteId,
    conexionFisica
  ) => {
    conexionRecibida = conexionFisica;

    return validarSesionParaResponder(
      sesionId,
      estudianteId,
      conexionFisica
    );
  };

  const servicioIntegrado = crearServicioParticipacion(
    repositorio,
    validador
  );

  await servicioIntegrado.registrar(datos, 7);

  assert.strictEqual(conexionRecibida, conexion);
});

test('El tiempo agotado confirma la transacción y no guarda la respuesta', async () => {
  const llamadas = [];
  const conexion = { identificador: 'conexion-tiempo-agotado' };
  const inserciones = [];

  const transaccion = {
    opcionValida: async () => true,
    obtenerRespuesta: async () => null,
    insertarRespuesta: async (respuesta) => {
      inserciones.push(respuesta);
      return 10;
    },
    actualizarRespuesta: async () => 1
  };

  const repositorio = {
    enTransaccion: async (operacion) => {
      llamadas.push('inicio');

      try {
        const resultado = await operacion(transaccion, conexion);
        llamadas.push('commit');
        return resultado;
      } catch (error) {
        llamadas.push('rollback');
        throw error;
      }
    }
  };

  const validarSesionParaResponder = async (
    sesionId,
    estudianteId,
    conexionRecibida
  ) => {
    assert.equal(sesionId, datos.sesionId);
    assert.equal(estudianteId, 7);
    assert.equal(conexionRecibida, conexion);

    return {
      permitida: false,
      codigo: 'TIEMPO_AGOTADO',
      mensaje: 'El tiempo máximo de participación ha finalizado.'
    };
  };

  const servicio = crearServicioParticipacion(
    repositorio,
    validarSesionParaResponder
  );

  await assert.rejects(
    servicio.registrar(datos, 7),
    {
      codigo: 'TIEMPO_AGOTADO',
      message: 'El tiempo máximo de participación ha finalizado.'
    }
  );

  assert.deepEqual(llamadas, ['inicio', 'commit']);
  assert.deepEqual(inserciones, []);
});

test('El repositorio confirma la transacción antes de devolver el resultado', async () => {
  const llamadas = [];

  const conexion = {
    beginTransaction: async () => llamadas.push('inicio'),
    commit: async () => llamadas.push('commit'),
    rollback: async () => llamadas.push('rollback'),
    release: () => llamadas.push('release')
  };

  const repo = crearRepositorioParticipacion({
    getConnection: async () => conexion
  });

  assert.equal(
    await repo.enTransaccion(async () => 10),
    10
  );

  assert.deepEqual(
    llamadas,
    ['inicio', 'commit', 'release']
  );

  llamadas.length = 0;

  const error = new Error('Fallo de commit');

  conexion.commit = async () => {
    llamadas.push('commit');
    throw error;
  };

  await assert.rejects(
    repo.enTransaccion(async () => 10),
    (actual) => actual === error
  );

  assert.deepEqual(
    llamadas,
    ['inicio', 'commit', 'rollback', 'release']
  );

  llamadas.length = 0;

  await assert.rejects(
    repo.enTransaccion(async () => {
      throw error;
    }),
    (actual) => actual === error
  );

  assert.deepEqual(
    llamadas,
    ['inicio', 'rollback', 'release']
  );
});
