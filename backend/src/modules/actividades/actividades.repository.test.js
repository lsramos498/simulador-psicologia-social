import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioActividades } from './actividades.repository.js';

function crearEntorno({
  responderConexion = async () => [[], []],
  responderPool = async () => [[], []]
} = {}) {
  const llamadasConexion = [];
  const llamadasPool = [];
  const eventos = [];

  const conexion = {
    async beginTransaction() {
      eventos.push('begin');
    },

    async execute(sql, parametros = []) {
      llamadasConexion.push({ sql, parametros });
      return responderConexion(sql, parametros);
    },

    async commit() {
      eventos.push('commit');
    },

    async rollback() {
      eventos.push('rollback');
    },

    release() {
      eventos.push('release');
    }
  };

  const pool = {
    async getConnection() {
      return conexion;
    },

    async execute(sql, parametros = []) {
      llamadasPool.push({ sql, parametros });
      return responderPool(sql, parametros);
    }
  };

  return {
    pool,
    llamadasConexion,
    llamadasPool,
    eventos
  };
}

test('Rechaza un pool MySQL incompleto', () => {
  assert.throws(
    () => crearRepositorioActividades(null),
    TypeError
  );

  assert.throws(
    () => crearRepositorioActividades({ execute() {} }),
    TypeError
  );

  assert.throws(
    () => crearRepositorioActividades({ getConnection() {} }),
    TypeError
  );
});

test('Rechaza una operación que no sea una función', async () => {
  const entorno = crearEntorno();
  const repositorio = crearRepositorioActividades(entorno.pool);

  await assert.rejects(
    repositorio.enTransaccion(null),
    TypeError
  );

  assert.deepEqual(entorno.eventos, []);
});

test('Confirma y libera una transacción exitosa', async () => {
  const entorno = crearEntorno();
  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.enTransaccion(
    async () => 'actividad creada'
  );

  assert.equal(resultado, 'actividad creada');

  assert.deepEqual(
    entorno.eventos,
    ['begin', 'commit', 'release']
  );
});

test('Revierte y libera una transacción cuando ocurre un error', async () => {
  const entorno = crearEntorno();
  const repositorio = crearRepositorioActividades(entorno.pool);
  const errorEsperado = new Error('Error de prueba');

  await assert.rejects(
    repositorio.enTransaccion(async () => {
      throw errorEsperado;
    }),
    error => error === errorEsperado
  );

  assert.deepEqual(
    entorno.eventos,
    ['begin', 'rollback', 'release']
  );
});

test('Consulta un caso y utiliza bloqueo FOR UPDATE', async () => {
  const caso = {
    id: 10,
    estado: 'Publicado',
    tiempoEstimadoSegundos: 1200
  };

  const entorno = crearEntorno({
    responderConexion: async () => [[caso], []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.enTransaccion(
    tx => tx.obtenerCaso(10)
  );

  assert.deepEqual(resultado, caso);
  assert.match(entorno.llamadasConexion[0].sql, /FOR UPDATE/i);
  assert.deepEqual(entorno.llamadasConexion[0].parametros, [10]);
});

test('Consulta espacio académico, docente y rúbrica', async () => {
  const respuestas = [
    [[{ id: 2, nombre: 'Ingeniería de Software', activo: 1 }], []],
    [[{ id: 4, activo: 1, esDocente: 1 }], []],
    [[{ id: 5, casoId: 10, activa: 1 }], []]
  ];

  const entorno = crearEntorno({
    responderConexion: async () => respuestas.shift()
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultados = await repositorio.enTransaccion(async tx => ({
    espacio: await tx.obtenerEspacioAcademico(2),
    docente: await tx.obtenerDocente(4),
    rubrica: await tx.obtenerRubrica(5, 10)
  }));

  assert.equal(resultados.espacio.id, 2);
  assert.equal(resultados.docente.esDocente, 1);
  assert.equal(resultados.rubrica.casoId, 10);

  assert.equal(entorno.llamadasConexion.length, 3);
  assert.match(entorno.llamadasConexion[0].sql, /EspacioAcademico/);
  assert.match(entorno.llamadasConexion[1].sql, /UsuarioRol/);
  assert.match(entorno.llamadasConexion[2].sql, /Rubrica/);
});

test('Devuelve un arreglo vacío cuando no hay estudiantes para consultar', async () => {
  const entorno = crearEntorno();
  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.enTransaccion(
    tx => tx.obtenerEstudiantes([])
  );

  assert.deepEqual(resultado, []);
  assert.equal(entorno.llamadasConexion.length, 0);
});

test('Consulta varios estudiantes mediante parámetros', async () => {
  const estudiantes = [
    { id: 10, activo: 1, esEstudiante: 1 },
    { id: 11, activo: 1, esEstudiante: 1 }
  ];

  const entorno = crearEntorno({
    responderConexion: async () => [estudiantes, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.enTransaccion(
    tx => tx.obtenerEstudiantes([10, 11])
  );

  assert.deepEqual(resultado, estudiantes);
  assert.match(entorno.llamadasConexion[0].sql, /IN \(\?, \?\)/);
  assert.deepEqual(entorno.llamadasConexion[0].parametros, [10, 11]);
  assert.match(entorno.llamadasConexion[0].sql, /FOR UPDATE/i);
});

test('Inserta una actividad y devuelve su identificador', async () => {
  const entorno = crearEntorno({
    responderConexion: async () => [{ insertId: 75 }, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const actividad = {
    casoId: 10,
    espacioAcademicoId: 2,
    docenteId: 4,
    rubricaId: 5,
    fechaInicio: '2026-11-01 08:00:00',
    fechaFin: '2026-11-01 10:00:00',
    tiempoLimiteSegundos: 1200,
    lugar: 'Aula 301',
    mensajePersonalizado: 'Bienvenidos',
    intentosPermitidos: 1,
    fechaCreacion: '2026-10-31 16:00:00'
  };

  const resultado = await repositorio.enTransaccion(
    tx => tx.insertarActividad(actividad)
  );

  assert.equal(resultado, 75);
  assert.match(entorno.llamadasConexion[0].sql, /INSERT INTO ActividadProgramada/);
  assert.equal(entorno.llamadasConexion[0].parametros[0], 10);
  assert.equal(entorno.llamadasConexion[0].parametros[3], 5);
});

test('Inserta un estudiante autorizado y devuelve su identificador', async () => {
  const entorno = crearEntorno({
    responderConexion: async () => [{ insertId: 90 }, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const autorizado = {
    actividadId: 75,
    estudianteId: 10,
    codigoAutorizacion: 'CODIGO-PRUEBA',
    fechaAutorizacion: '2026-10-31 16:00:00'
  };

  const resultado = await repositorio.enTransaccion(
    tx => tx.insertarEstudianteAutorizado(autorizado)
  );

  assert.equal(resultado, 90);
  assert.match(entorno.llamadasConexion[0].sql, /INSERT INTO EstudianteAutorizado/);
  assert.match(entorno.llamadasConexion[0].sql, /'Autorizado'/);
  assert.deepEqual(
    entorno.llamadasConexion[0].parametros,
    [75, 10, 'CODIGO-PRUEBA', '2026-10-31 16:00:00']
  );
});

test('Consulta una actividad por su identificador', async () => {
  const actividad = {
    id: 75,
    casoId: 10,
    casoTitulo: 'Caso de prueba',
    espacioAcademicoNombre: 'Ingeniería de Software'
  };

  const entorno = crearEntorno({
    responderPool: async () => [[actividad], []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.obtenerActividadPorId(75);

  assert.deepEqual(resultado, actividad);
  assert.match(entorno.llamadasPool[0].sql, /ActividadProgramada/);
  assert.match(entorno.llamadasPool[0].sql, /INNER JOIN Caso/);
  assert.deepEqual(entorno.llamadasPool[0].parametros, [75]);
});

test('Lista los estudiantes autorizados de una actividad', async () => {
  const estudiantes = [
    {
      id: 90,
      actividadId: 75,
      estudianteId: 10,
      nombres: 'Estudiante',
      apellidos: 'Prueba',
      estado: 'Autorizado'
    }
  ];

  const entorno = crearEntorno({
    responderPool: async () => [estudiantes, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.listarEstudiantesAutorizados(75);

  assert.deepEqual(resultado, estudiantes);
  assert.match(entorno.llamadasPool[0].sql, /EstudianteAutorizado/);
  assert.deepEqual(entorno.llamadasPool[0].parametros, [75]);
});

test('Cierra las actividades iniciadas que llevan 24 horas vencidas', async () => {
  const fechaActual = '2026-11-08 10:00:00';

  const entorno = crearEntorno({
    responderPool: async () => [{ affectedRows: 2 }, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.cerrarActividadesVencidas(
    fechaActual
  );

  assert.equal(resultado, 2);
  assert.equal(entorno.llamadasPool.length, 1);

  const llamada = entorno.llamadasPool[0];

  assert.match(llamada.sql, /UPDATE ActividadProgramada/i);
  assert.match(llamada.sql, /SET estado = 'Cerrada'/i);
  assert.match(llamada.sql, /estado = 'Iniciada'/i);
  assert.match(
    llamada.sql,
    /fechaFin <= DATE_SUB\(\?, INTERVAL 24 HOUR\)/i
  );

  assert.deepEqual(llamada.parametros, [fechaActual]);
});

test('Devuelve cero cuando no hay actividades para cerrar', async () => {
  const entorno = crearEntorno({
    responderPool: async () => [{ affectedRows: 0 }, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  const resultado = await repositorio.cerrarActividadesVencidas(
    '2026-11-08 10:00:00'
  );

  assert.equal(resultado, 0);
});

test('No utiliza una transacción para ejecutar el cierre automático', async () => {
  const entorno = crearEntorno({
    responderPool: async () => [{ affectedRows: 1 }, []]
  });

  const repositorio = crearRepositorioActividades(entorno.pool);

  await repositorio.cerrarActividadesVencidas(
    '2026-11-08 10:00:00'
  );

  assert.equal(entorno.llamadasPool.length, 1);
  assert.equal(entorno.llamadasConexion.length, 0);
  assert.deepEqual(entorno.eventos, []);
});

test('Actualiza el estado solo si coincide con el estado anterior esperado', async () => {
  const entorno = crearEntorno({
    responderPool: async () => [{ affectedRows: 1 }, []]
  });
  const repositorio = crearRepositorioActividades(entorno.pool);

  const filas = await repositorio.actualizarEstado(
    50,
    'Iniciada',
    'Programada'
  );

  assert.equal(filas, 1);
  assert.match(entorno.llamadasPool[0].sql, /WHERE id = \? AND estado = \?/);
  assert.deepEqual(
    entorno.llamadasPool[0].parametros,
    ['Iniciada', 50, 'Programada']
  );
});
