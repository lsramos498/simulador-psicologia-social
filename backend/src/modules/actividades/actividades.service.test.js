import test from 'node:test';
import assert from 'node:assert/strict';

import { crearServicioActividades } from './actividades.service.js';

const datos = {
  casoId: 10,
  espacioAcademicoId: 3,
  rubricaId: 7,
  fechaInicio: '2026-11-02T09:00',
  fechaFin: '2026-11-02T11:00',
  tiempoLimiteSegundos: 600,
  lugar: 'Aula 201',
  mensajePersonalizado: 'Bienvenidos a Lumina',
  intentosPermitidos: 2,
  estudiantesIds: [20, 21]
};

const relojFijo = () => '2026-11-01T08:00:00';

function preparar({
  caso = { estado: 'Publicado', tiempoEstimadoSegundos: 1200 },
  espacio = { id: 3, activo: 1 },
  docente = { id: 2, activo: 1, esDocente: 1 },
  rubrica = { id: 7, casoId: 10, activa: 1 },
  estudiantes = [
    { id: 20, activo: 1, esEstudiante: 1 },
    { id: 21, activo: 1, esEstudiante: 1 }
  ],
  codigos = ['CODIGO20', 'CODIGO21'],
  actividadEncontrada = { id: 50, casoId: 10 },
  autorizados = []
} = {}) {
  const llamadas = [];
  const eventosTransaccion = [];
  const actividadesInsertadas = [];
  const autorizacionesInsertadas = [];
  let indiceCodigo = 0;
  let indiceAutorizacion = 1;

  const transaccion = {
    async obtenerCaso(id) {
      llamadas.push('obtenerCaso');
      return caso;
    },

    async obtenerEspacioAcademico(id) {
      llamadas.push('obtenerEspacioAcademico');
      return espacio;
    },

    async obtenerDocente(id) {
      llamadas.push('obtenerDocente');
      return docente;
    },

    async obtenerRubrica(id, casoId) {
      llamadas.push('obtenerRubrica');
      return rubrica;
    },

    async obtenerEstudiantes(ids) {
      llamadas.push('obtenerEstudiantes');
      return estudiantes;
    },

    async insertarActividad(actividad) {
      llamadas.push('insertarActividad');
      actividadesInsertadas.push(actividad);
      return 50;
    },

    async insertarEstudianteAutorizado(autorizacion) {
      llamadas.push('insertarEstudianteAutorizado');
      autorizacionesInsertadas.push(autorizacion);
      return indiceAutorizacion++;
    }
  };

  const repositorio = {
    async enTransaccion(operacion) {
      eventosTransaccion.push('inicio');

      try {
        const resultado = await operacion(transaccion);
        eventosTransaccion.push('commit');
        return resultado;
      } catch (error) {
        eventosTransaccion.push('rollback');
        throw error;
      }
    },

    async obtenerActividadPorId(id) {
      llamadas.push('obtenerActividadPorId');
      return actividadEncontrada;
    },

    async listarEstudiantesAutorizados(id) {
      llamadas.push('listarEstudiantesAutorizados');
      return autorizados;
    }
  };

  const servicio = crearServicioActividades(
    repositorio,
    () => codigos[indiceCodigo++],
    relojFijo
  );

  return {
    servicio,
    llamadas,
    eventosTransaccion,
    actividadesInsertadas,
    autorizacionesInsertadas
  };
}

test('Registra una actividad válida y autoriza sus estudiantes', async () => {
  const contexto = preparar();

  const resultado = await contexto.servicio.crear(datos, 2);

  assert.equal(resultado.id, 50);
  assert.equal(resultado.docenteId, 2);
  assert.equal(resultado.fechaInicio, '2026-11-02 09:00:00');
  assert.equal(resultado.fechaFin, '2026-11-02 11:00:00');
  assert.equal(resultado.intentosPermitidos, 2);
  assert.equal(resultado.estudiantesAutorizados.length, 2);

  assert.deepEqual(
    resultado.estudiantesAutorizados.map((item) => item.codigoAutorizacion),
    ['CODIGO20', 'CODIGO21']
  );

  assert.equal(contexto.actividadesInsertadas.length, 1);
  assert.equal(contexto.autorizacionesInsertadas.length, 2);
  assert.deepEqual(contexto.eventosTransaccion, ['inicio', 'commit']);
});

test('Utiliza un intento por defecto cuando no se especifica', async () => {
  const contexto = preparar();
  const entrada = { ...datos, intentosPermitidos: undefined };

  const resultado = await contexto.servicio.crear(entrada, 2);

  assert.equal(resultado.intentosPermitidos, 1);
});

test('Rechaza la actividad cuando no se proporcionan estudiantes', async () => {
  const contexto = preparar();

  await assert.rejects(
    contexto.servicio.crear({ ...datos, estudiantesIds: [] }, 2),
    TypeError
  );

  assert.deepEqual(contexto.eventosTransaccion, []);
});

test('Rechaza estudiantes duplicados', async () => {
  const contexto = preparar();

  await assert.rejects(
    contexto.servicio.crear({ ...datos, estudiantesIds: [20, 20] }, 2),
    TypeError
  );

  assert.deepEqual(contexto.eventosTransaccion, []);
});

test('Rechaza fechas de inicio y finalización iguales', async () => {
  const contexto = preparar();

  await assert.rejects(
    contexto.servicio.crear({
      ...datos,
      fechaFin: datos.fechaInicio
    }, 2),
    { codigo: 'FECHAS_INVALIDAS' }
  );

  assert.deepEqual(contexto.eventosTransaccion, []);
});

test('Rechaza fechas inexistentes', async () => {
  const contexto = preparar();

  await assert.rejects(
    contexto.servicio.crear({
      ...datos,
      fechaInicio: '2026-02-30T09:00'
    }, 2),
    TypeError
  );

  assert.deepEqual(contexto.eventosTransaccion, []);
});

test('Rechaza identificadores inválidos', async () => {
  const contexto = preparar();

  await assert.rejects(
    contexto.servicio.crear({ ...datos, casoId: -1 }, 2),
    TypeError
  );

  await assert.rejects(
    contexto.servicio.crear(datos, 0),
    TypeError
  );

  assert.deepEqual(contexto.eventosTransaccion, []);
});

test('Rechaza un caso inexistente', async () => {
  const contexto = preparar({ caso: null });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'CASO_NO_EXISTE' }
  );

  assert.deepEqual(contexto.eventosTransaccion, ['inicio', 'rollback']);
});

test('Rechaza casos que no estén publicados', async () => {
  const contexto = preparar({
    caso: { estado: 'Borrador', tiempoEstimadoSegundos: 1200 }
  });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'CASO_NO_PUBLICADO' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
  assert.equal(contexto.eventosTransaccion.at(-1), 'rollback');
});

test('Rechaza tiempos superiores al tiempo estimado del caso', async () => {
  const contexto = preparar({
    caso: { estado: 'Publicado', tiempoEstimadoSegundos: 300 }
  });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'TIEMPO_SUPERA_CASO' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
  assert.equal(contexto.eventosTransaccion.at(-1), 'rollback');
});

test('Rechaza espacios académicos inactivos', async () => {
  const contexto = preparar({
    espacio: { id: 3, activo: 0 }
  });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'ESPACIO_INACTIVO' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
});

test('Rechaza usuarios que no tienen el rol Docente', async () => {
  const contexto = preparar({
    docente: { id: 2, activo: 1, esDocente: 0 }
  });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'USUARIO_NO_ES_DOCENTE' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
});

test('Rechaza una rúbrica que no corresponde al caso', async () => {
  const contexto = preparar({ rubrica: null });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'RUBRICA_NO_CORRESPONDE' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
});

test('Rechaza estudiantes inexistentes', async () => {
  const contexto = preparar({ estudiantes: [] });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'ESTUDIANTE_NO_EXISTE' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
});

test('Rechaza usuarios que no tienen el rol Estudiante', async () => {
  const contexto = preparar({
    estudiantes: [
      { id: 20, activo: 1, esEstudiante: 0 },
      { id: 21, activo: 1, esEstudiante: 1 }
    ]
  });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'USUARIO_NO_ES_ESTUDIANTE' }
  );

  assert.equal(contexto.actividadesInsertadas.length, 0);
});

test('Rechaza códigos de autorización duplicados', async () => {
  const contexto = preparar({
    codigos: ['REPETIDO', 'REPETIDO']
  });

  await assert.rejects(
    contexto.servicio.crear(datos, 2),
    { codigo: 'CODIGO_DUPLICADO' }
  );

  assert.equal(contexto.autorizacionesInsertadas.length, 1);
  assert.equal(contexto.eventosTransaccion.at(-1), 'rollback');
});

test('Consulta una actividad con sus estudiantes autorizados', async () => {
  const estudiantes = [
    { id: 1, estudianteId: 20, estado: 'Autorizado' }
  ];

  const contexto = preparar({ autorizados: estudiantes });

  const resultado = await contexto.servicio.consultarPorId(50);

  assert.equal(resultado.id, 50);
  assert.deepEqual(resultado.estudiantesAutorizados, estudiantes);
});

test('Rechaza la consulta de una actividad inexistente', async () => {
  const contexto = preparar({ actividadEncontrada: null });

  await assert.rejects(
    contexto.servicio.consultarPorId(999),
    { codigo: 'ACTIVIDAD_NO_EXISTE' }
  );
});
