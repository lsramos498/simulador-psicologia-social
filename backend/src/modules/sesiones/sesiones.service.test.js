import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioSesiones } from './sesiones.service.js';

function crearRepositorio(cambios = {}) {
  let fila = {
    id: 1,
    actividadId: 3,
    estudianteId: 7,
    docenteId: 9,
    numeroIntento: 1,
    estado: 'Sin iniciar',
    inicio: null,
    fin: null,
    segundosConsumidos: 0,
    motivoCierre: null,
    estadoActividad: 'Iniciada',
    fechaInicio: new Date('2026-11-09T14:00:00'),
    fechaFin: new Date('2026-11-09T18:00:00'),
    tiempoLimiteSegundos: 600,
    rubricaId: 8,
    casoId: 4,
    ...cambios.fila
  };
  const llamadas = [];
  let evaluacion = null;
  const datos = cambios.datos ?? {
    preguntas: [
      { decisionId: 1, opcionCorrectaId: 10 },
      { decisionId: 2, opcionCorrectaId: 20 }
    ],
    respuestas: [{ decisionId: 1, opcionId: 10 }],
    criterios: [{ criterioId: 4, rubricaId: 8, ponderacion: 100, puntajeMaximo: 5 }]
  };

  const repo = {
    llamadas,
    async preparar(actividadId) {
      llamadas.push(['preparar', actividadId]);
      return { sesionesCreadas: 2, asistenciasCreadas: 2 };
    },
    async listarVencidas() {
      return cambios.vencidas ?? [];
    },
    async obtenerPorId() {
      return { ...fila };
    },
    async obtenerPorEstudiante(actividadId, estudianteId) {
      if (Number(fila.actividadId) === Number(actividadId)
        && Number(fila.estudianteId) === Number(estudianteId)) {
        return { ...fila };
      }
      return null;
    },
    async guardar(sesion) {
      llamadas.push(['guardar', sesion.estado, sesion.motivoCierre]);
      fila = { ...fila, ...sesion };
      return 1;
    },
    async actualizarAsistencia(_actividadId, _estudianteId, estado) {
      llamadas.push(['asistencia', estado]);
    },
    async marcarRespuestas() {
      llamadas.push(['marcar']);
    },
    async datosParaEvaluar() {
      return datos;
    },
    async insertarEvaluacion(evaluacionNueva) {
      llamadas.push(['evaluacion', evaluacionNueva.resultado]);
      evaluacion = {
        id: 3,
        resultado: evaluacionNueva.resultado,
        retroalimentacionGeneral: evaluacionNueva.retroalimentacionGeneral,
        criterios: []
      };
      return 3;
    },
    async insertarCriterios() {
      llamadas.push(['criterios']);
    },
    async insertarNotificacion(notificacion) {
      llamadas.push(['notificacion', notificacion.tipo, notificacion.mensaje]);
    },
    async obtenerEvaluacion() {
      return evaluacion;
    },
    async enTransaccion(operacion) {
      return operacion(repo);
    }
  };

  return repo;
}

const ahora = new Date('2026-11-09T15:00:00');

test('Al iniciar la actividad se preparan las sesiones de los convocados', async () => {
  const repo = crearRepositorio();
  const resultado = await crearServicioSesiones(repo).preparar(3);
  assert.deepEqual(resultado, { sesionesCreadas: 2, asistenciasCreadas: 2 });
  assert.deepEqual(repo.llamadas, [['preparar', 3]]);
});

test('El estudiante pasa su sesión a En curso dentro de la ventana', async () => {
  // Llega 2 minutos después del inicio: antes de la mitad del tiempo límite (RF-22).
  const repo = crearRepositorio({ fila: { fechaInicio: new Date('2026-11-09T14:58:00') } });
  const sesion = await crearServicioSesiones(repo).iniciarPropia(3, 7, ahora);

  assert.equal(sesion.estado, 'En curso');
  assert.equal(sesion.inicio.getTime(), ahora.getTime());
  assert.deepEqual(repo.llamadas.at(-1), ['asistencia', 'Presente']);
});

test('Rechaza iniciar fuera de la ventana y si la actividad no fue iniciada', async () => {
  const servicio = crearServicioSesiones(crearRepositorio());
  await assert.rejects(
    servicio.iniciarPropia(3, 7, new Date('2026-11-09T13:00:00')),
    { statusCode: 403 }
  );
  const sinIniciar = crearServicioSesiones(crearRepositorio({
    fila: { estadoActividad: 'Programada' }
  }));
  await assert.rejects(sinIniciar.iniciarPropia(3, 7, ahora), { statusCode: 409 });
});

test('Al finalizar calcula la nota y avisa al estudiante', async () => {
  const repo = crearRepositorio({
    fila: { estado: 'En curso', inicio: new Date('2026-11-09T14:50:00') }
  });
  const servicio = crearServicioSesiones(repo);
  const cierre = await servicio.finalizarPropia(1, 7, ahora);

  assert.equal(cierre.sesion.estado, 'Finalizado');
  assert.equal(cierre.sesion.motivoCierre, 'Finalizacion');
  assert.equal(cierre.evaluacion.resultado, 2.5);
  assert.equal(cierre.evaluacion.correctas, 1);
  assert.ok(repo.llamadas.some((llamada) => llamada[1] === 'Calificacion'));
  assert.ok(repo.llamadas.some((llamada) => llamada[1] === 'Retroalimentacion'
    && llamada[2] === 'Tu participación ha finalizado correctamente'));

  const repetido = await servicio.finalizarPropia(1, 7, ahora);
  assert.equal(repetido.evaluacion.resultado, 2.5);
  assert.equal(repo.llamadas.filter((llamada) => llamada[0] === 'evaluacion').length, 1);
});

test('Un estudiante no puede cerrar la sesión de otro', async () => {
  const repo = crearRepositorio({
    fila: { estado: 'En curso', inicio: new Date('2026-11-09T14:50:00') }
  });
  await assert.rejects(
    crearServicioSesiones(repo).finalizarPropia(1, 8, ahora),
    { statusCode: 403 }
  );
  assert.equal(repo.llamadas.length, 0);
});

test('El cierre de una sesión que nunca empezó queda en cero y como ausencia', async () => {
  const repo = crearRepositorio({
    datos: {
      preguntas: [{ decisionId: 1, opcionCorrectaId: 10 }],
      respuestas: [],
      criterios: [{ criterioId: 4, rubricaId: 8, ponderacion: 100, puntajeMaximo: 5 }]
    }
  });
  const cierre = await crearServicioSesiones(repo).cerrarPorDocente(1, 9, ahora);

  assert.equal(cierre.sesion.motivoCierre, 'CierreDocente');
  assert.equal(cierre.evaluacion.resultado, 0);
  assert.deepEqual(repo.llamadas.find((llamada) => llamada[0] === 'asistencia'), ['asistencia', 'Ausente']);
});

test('RF-22: después de la mitad del tiempo límite no se puede iniciar (403 INGRESO_TARDIO)', async () => {
  // Actividad desde las 14:00 con 10 minutos: el límite para iniciar es 14:05.
  const repo = crearRepositorio();
  const servicio = crearServicioSesiones(repo);
  await assert.rejects(
    servicio.iniciarPropia(3, 7, new Date('2026-11-09T14:06:00')),
    { statusCode: 403, codigo: 'INGRESO_TARDIO' }
  );
  assert.equal(repo.llamadas.some(([nombre]) => nombre === 'asistencia'), false);
});

test('RF-22: justo en la mitad del tiempo todavía puede iniciar', async () => {
  const repo = crearRepositorio();
  const sesion = await crearServicioSesiones(repo).iniciarPropia(3, 7, new Date('2026-11-09T14:05:00'));
  assert.equal(sesion.estado, 'En curso');
});

test('RF-22: quien ya inició puede volver a entrar aunque sea tarde', async () => {
  const repo = crearRepositorio({ fila: { estado: 'En curso', inicio: new Date('2026-11-09T14:01:00') } });
  const sesion = await crearServicioSesiones(repo).iniciarPropia(3, 7, new Date('2026-11-09T14:08:00'));
  assert.equal(sesion.estado, 'En curso');
});
