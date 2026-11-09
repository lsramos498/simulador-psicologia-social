
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
  autorizados = [],
  notificaciones = null
} = {}) {
  const llamadas = [];
  const eventosTransaccion = [];
  const actividadesInsertadas = [];
  const autorizacionesInsertadas = [];
  const fechasCierreAutomatico = [];

  let actividadesCerradasAutomaticamente = 0;
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
    },

    async cerrarActividadesVencidas(fechaActual) {
      llamadas.push('cerrarActividadesVencidas');
      fechasCierreAutomatico.push(fechaActual);
      return actividadesCerradasAutomaticamente;
    }
  };

  const servicio = crearServicioActividades(
    repositorio,
    () => {
      const codigo = codigos[indiceCodigo++];
      return { codigo, codigoHash: `hash-${codigo}` };
    },
    relojFijo,
    notificaciones
  );

  return {
    servicio,
    llamadas,
    eventosTransaccion,
    actividadesInsertadas,
    autorizacionesInsertadas,
    fechasCierreAutomatico,

    establecerActividadesCerradas(cantidad) {
      actividadesCerradasAutomaticamente = cantidad;
    }
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

  assert.deepEqual(
    contexto.autorizacionesInsertadas.map((item) => item.codigoAutorizacion),
    ['hash-CODIGO20', 'hash-CODIGO21']
  );

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

test('Guarda el hash y convoca a cada estudiante con el código en claro', async () => {
  const enviados = [];

  const contexto = preparar({
    caso: {
      estado: 'Publicado',
      tiempoEstimadoSegundos: 1200,
      titulo: 'Conflicto en el aula',
      desarrolloSituacional: 'Dos grupos discuten.',
      contextoHistoria: 'Primer semestre.'
    },
    estudiantes: [
      { id: 20, activo: 1, esEstudiante: 1, correo: 'ana@unihumboldt.edu.co' },
      { id: 21, activo: 1, esEstudiante: 1, correo: 'luis@unihumboldt.edu.co' }
    ],
    notificaciones: {
      async enviar(tipo, aviso) {
        enviados.push({
          tipo,
          destinatario: aviso.destinatario,
          codigo: aviso.codigoAutorizacion
        });
      }
    }
  });

  await contexto.servicio.crear(datos, 2);

  assert.deepEqual(enviados, [
    { tipo: 'CONVOCATORIA', destinatario: 'ana@unihumboldt.edu.co', codigo: 'CODIGO20' },
    { tipo: 'CONVOCATORIA', destinatario: 'luis@unihumboldt.edu.co', codigo: 'CODIGO21' }
  ]);
});

test('Valida las transiciones permitidas de estado de una actividad', async () => {
  let estado = 'Programada';
  let actualizaciones = 0;

  const servicio = crearServicioActividades({
    async enTransaccion() {
      throw new Error('no debe abrir transacción');
    },

    async obtenerActividadPorId() {
      return { id: 4, docenteId: 2, estado };
    },

    async listarEstudiantesAutorizados() {
      return [];
    },

    async actualizarEstado(_id, nuevo) {
      actualizaciones++;
      estado = nuevo;
      return 1;
    }
  }, () => ({
    codigo: 'CODIGO',
    codigoHash: 'hash-CODIGO'
  }));

  // Programada -> Iniciada: permitido.
  assert.equal(
    (await servicio.iniciar(4, 2)).estado,
    'Iniciada'
  );

  // Iniciada -> Iniciada: rechazado.
  await assert.rejects(
    () => servicio.iniciar(4, 2),
    { codigo: 'TRANSICION_INVALIDA', statusCode: 409 }
  );

  // Programada -> Cerrada: rechazado.
  estado = 'Programada';

  await assert.rejects(
    () => servicio.cerrar(4, 2),
    { codigo: 'TRANSICION_INVALIDA', statusCode: 409 }
  );

  // Iniciada -> Cerrada: permitido.
  estado = 'Iniciada';

  assert.equal(
    (await servicio.cerrar(4, 2)).estado,
    'Cerrada'
  );

  // Cerrada -> Iniciada: rechazado.
  await assert.rejects(
    () => servicio.iniciar(4, 2),
    { codigo: 'TRANSICION_INVALIDA', statusCode: 409 }
  );

  // Cerrada -> Cerrada: rechazado.
  await assert.rejects(
    () => servicio.cerrar(4, 2),
    { codigo: 'TRANSICION_INVALIDA', statusCode: 409 }
  );

  // Un docente diferente no puede modificar la actividad.
  await assert.rejects(
    () => servicio.iniciar(4, 9),
    { codigo: 'ACTIVIDAD_AJENA', statusCode: 403 }
  );

  // Solo se ejecutaron las dos transiciones válidas.
  assert.equal(actualizaciones, 2);
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

// Pruebas de cierre automático de RF-19.

test('Cierra automáticamente las actividades vencidas', async () => {
  const contexto = preparar();

  contexto.establecerActividadesCerradas(2);

  const cantidad = await contexto.servicio.cerrarVencidas();

  assert.equal(cantidad, 2);

  assert.deepEqual(
    contexto.fechasCierreAutomatico,
    ['2026-11-01 08:00:00']
  );

  assert.ok(
    contexto.llamadas.includes('cerrarActividadesVencidas')
  );
});

test('Devuelve cero cuando no hay actividades vencidas', async () => {
  const contexto = preparar();

  contexto.establecerActividadesCerradas(0);

  const cantidad = await contexto.servicio.cerrarVencidas();

  assert.equal(cantidad, 0);
});

test('Rechaza el cierre automático si el repositorio no lo implementa', async () => {
  const repositorio = {
    async enTransaccion() {},

    async obtenerActividadPorId() {
      return null;
    },

    async listarEstudiantesAutorizados() {
      return [];
    }
  };

  const servicio = crearServicioActividades(
    repositorio,
    () => ({
      codigo: 'CODIGO',
      codigoHash: 'hash-CODIGO'
    })
  );

  await assert.rejects(
    servicio.cerrarVencidas(),
    TypeError
  );
});

