import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { crearServicioSesiones } from '../src/modules/sesiones/sesiones.service.js';
import {
  ESTADOS_SESION,
  MOTIVOS_CIERRE
} from '../src/modules/sesiones/sesion.state.js';

const AHORA = new Date('2026-11-07T15:00:00.000Z');

function crearContexto({
  actividad = {},
  autorizacion = {},
  ultimaSesion = null,
  repeticionAprobada = null
} = {}) {
  const datos = {
    actividad: {
      id: 1,
      docente_id: 10,
      fechaInicio: new Date('2026-11-07T14:00:00.000Z'),
      fechaFin: new Date('2026-11-07T18:00:00.000Z'),
      tiempoLimiteSegundos: 3600,
      intentosPermitidos: 1,
      estado: 'Iniciada',
      ...actividad
    },
    autorizacion: {
      id: 1,
      actividad_id: 1,
      estudiante_id: 20,
      estado: 'Autorizado',
      ...autorizacion
    },
    ultimaSesion,
    repeticionAprobada,
    sesiones: [],
    transacciones: 0
  };

  const repositorio = {
    async enTransaccion(operacion) {
      datos.transacciones++;
      // Misma API que el repositorio real (tx = consultas + métodos de cierre).
      return operacion(repositorio);
    },

    async obtenerActividad() {
      return datos.actividad;
    },

    async obtenerAutorizacion() {
      return datos.autorizacion;
    },

    async obtenerUltimaSesion() {
      return datos.ultimaSesion;
    },

    async obtenerRepeticionAprobada() {
      return datos.repeticionAprobada;
    },

    async consumirAutorizacionRepeticion(_conexion, autorizacionId, consumidaEn) {
      const repeticion = datos.repeticionAprobada;
      if (
        !repeticion ||
        Number(repeticion.id) !== Number(autorizacionId) ||
        repeticion.estado !== 'Aprobada'
      ) {
        return false;
      }

      datos.repeticionAprobada = {
        ...repeticion,
        estado: 'Consumida',
        consumidaEn
      };
      return true;
    },

    async insertarSesion(_conexion, sesion) {
      const nueva = { ...sesion, id: datos.sesiones.length + 1 };
      datos.sesiones.push(nueva);
      return nueva;
    },

    async obtenerSesionPorId(_conexion, id) {
      return datos.sesiones.find((s) => s.id === id) ?? null;
    },

    async actualizarSesion(_conexion, sesion) {
      const indice = datos.sesiones.findIndex((s) => s.id === sesion.id);
      datos.sesiones[indice] = sesion;
      return sesion;
    },

    async obtenerPorId(sesionId) {
      const s = datos.sesiones.find((x) => Number(x.id) === Number(sesionId));
      if (!s) return null;
      return {
        id: s.id,
        actividadId: s.actividad_id ?? s.actividadId,
        estudianteId: s.estudiante_id ?? s.estudianteId,
        numeroIntento: s.numeroIntento,
        estado: s.estado,
        inicio: s.inicio,
        fin: s.fin,
        segundosConsumidos: s.segundosConsumidos,
        motivoCierre: s.motivoCierre,
        docenteId: datos.actividad.docente_id,
        estadoActividad: datos.actividad.estado,
        fechaInicio: datos.actividad.fechaInicio,
        fechaFin: datos.actividad.fechaFin,
        tiempoLimiteSegundos: datos.actividad.tiempoLimiteSegundos,
        rubricaId: datos.actividad.rubrica_id ?? 1,
        casoId: datos.actividad.caso_id ?? 1
      };
    },

    async guardar(sesion) {
      const indice = datos.sesiones.findIndex((s) => Number(s.id) === Number(sesion.id));
      if (indice < 0) return 0;
      datos.sesiones[indice] = {
        ...datos.sesiones[indice],
        ...sesion,
        actividad_id: sesion.actividadId ?? datos.sesiones[indice].actividad_id,
        estudiante_id: sesion.estudianteId ?? datos.sesiones[indice].estudiante_id
      };
      return 1;
    },

    async marcarRespuestas() {},
    async datosParaEvaluar() {
      return {
        preguntas: [],
        respuestas: [],
        criterios: []
      };
    },
    async insertarEvaluacion() {
      return 99;
    },
    async insertarCriterios() {},
    async insertarNotificacion() {},
    async actualizarAsistencia() {},
    async obtenerEvaluacion() {
      return null;
    }
  };

  return {
    datos,
    servicio: crearServicioSesiones(repositorio, () => new Date(AHORA))
  };
}

describe('Servicio de sesiones', () => {
  test('inicia una sesión para un estudiante autorizado', async () => {
    const { servicio, datos } = crearContexto();

    const resultado = await servicio.iniciarSesion({
      actividadId: 1,
      estudianteId: 20
    });

    assert.equal(resultado.estado, ESTADOS_SESION.EN_CURSO);
    assert.equal(resultado.numeroIntento, 1);
    assert.deepEqual(resultado.inicio, AHORA);
    assert.equal(datos.sesiones.length, 1);
    assert.equal(datos.transacciones, 1);
  });

  test('recupera una sesión que ya está en curso', async () => {
    const sesionExistente = {
      id: 5,
      actividad_id: 1,
      estudiante_id: 20,
      numeroIntento: 1,
      estado: ESTADOS_SESION.EN_CURSO,
      inicio: new Date('2026-11-07T14:30:00.000Z'),
      fin: null,
      segundosConsumidos: 0,
      motivoCierre: null
    };

    const { servicio, datos } = crearContexto({
      ultimaSesion: sesionExistente
    });

    const resultado = await servicio.iniciarSesion({
      actividadId: 1,
      estudianteId: 20
    });

    assert.equal(resultado.id, 5);
    assert.equal(resultado.estado, ESTADOS_SESION.EN_CURSO);
    assert.equal(datos.sesiones.length, 0);
  });

  test('rechaza una actividad que no está iniciada', async () => {
    const { servicio } = crearContexto({
      actividad: { estado: 'Programada' }
    });

    await assert.rejects(
      servicio.iniciarSesion({ actividadId: 1, estudianteId: 20 }),
      { statusCode: 409 }
    );
  });

  test('rechaza un estudiante no autorizado', async () => {
    const { servicio } = crearContexto({
      autorizacion: { estado: 'Retirado' }
    });

    await assert.rejects(
      servicio.iniciarSesion({ actividadId: 1, estudianteId: 20 }),
      { statusCode: 403 }
    );
  });

  test('rechaza el inicio fuera del horario de la actividad', async () => {
    const { servicio } = crearContexto({
      actividad: {
        fechaFin: new Date('2026-11-07T14:30:00.000Z')
      }
    });

    await assert.rejects(
      servicio.iniciarSesion({ actividadId: 1, estudianteId: 20 }),
      { statusCode: 403 }
    );
  });

  test('rechaza un nuevo intento cuando el estudiante agotó el límite permitido', async () => {
    const { servicio } = crearContexto({
      ultimaSesion: {
        id: 5,
        actividad_id: 1,
        estudiante_id: 20,
        numeroIntento: 1,
        estado: ESTADOS_SESION.FINALIZADO,
        inicio: new Date('2026-11-07T14:00:00.000Z'),
        fin: new Date('2026-11-07T14:30:00.000Z'),
        segundosConsumidos: 1800,
        motivoCierre: MOTIVOS_CIERRE.FINALIZACION
      }
    });

    await assert.rejects(
      servicio.iniciarSesion({ actividadId: 1, estudianteId: 20 }),
      { statusCode: 409 }
    );
  });


  test('crea un nuevo intento cuando todavía hay intentos disponibles', async () => {
    const { servicio, datos } = crearContexto({
      actividad: { intentosPermitidos: 3 },
      ultimaSesion: {
        id: 5,
        actividad_id: 1,
        estudiante_id: 20,
        numeroIntento: 1,
        estado: ESTADOS_SESION.FINALIZADO,
        inicio: new Date('2026-11-07T14:00:00.000Z'),
        fin: new Date('2026-11-07T14:30:00.000Z'),
        segundosConsumidos: 1800,
        motivoCierre: MOTIVOS_CIERRE.FINALIZACION
      }
    });

    const resultado = await servicio.iniciarSesion({
      actividadId: 1,
      estudianteId: 20
    });

    assert.equal(resultado.numeroIntento, 2);
    assert.equal(resultado.estado, ESTADOS_SESION.EN_CURSO);
    assert.equal(datos.sesiones.length, 1);
    assert.equal(datos.sesiones[0].numeroIntento, 2);
  });

  test('rechaza un nuevo intento cuando se alcanzó el límite de tres', async () => {
    const { servicio, datos } = crearContexto({
      actividad: { intentosPermitidos: 3 },
      ultimaSesion: {
        id: 7,
        actividad_id: 1,
        estudiante_id: 20,
        numeroIntento: 3,
        estado: ESTADOS_SESION.FINALIZADO,
        inicio: new Date('2026-11-07T14:00:00.000Z'),
        fin: new Date('2026-11-07T14:30:00.000Z'),
        segundosConsumidos: 1800,
        motivoCierre: MOTIVOS_CIERRE.FINALIZACION
      }
    });

    await assert.rejects(
      servicio.iniciarSesion({
        actividadId: 1,
        estudianteId: 20
      }),
      {
        statusCode: 409,
        message: 'El estudiante ha agotado los intentos permitidos para esta actividad.'
      }
    );

    assert.equal(datos.sesiones.length, 0);
  });

  test('permite un nuevo intento con autorización de repetición aprobada (RF-25)', async () => {
    const { servicio, datos } = crearContexto({
      ultimaSesion: {
        id: 9,
        actividad_id: 1,
        estudiante_id: 20,
        numeroIntento: 1,
        estado: ESTADOS_SESION.FINALIZADO,
        inicio: new Date('2026-11-07T14:00:00.000Z'),
        fin: new Date('2026-11-07T14:30:00.000Z'),
        segundosConsumidos: 1800,
        motivoCierre: MOTIVOS_CIERRE.FINALIZACION
      },
      repeticionAprobada: { id: 77, estado: 'Aprobada' }
    });

    const resultado = await servicio.iniciarSesion({
      actividadId: 1,
      estudianteId: 20
    });

    assert.equal(resultado.numeroIntento, 2);
    assert.equal(resultado.estado, ESTADOS_SESION.EN_CURSO);
    assert.equal(datos.repeticionAprobada.estado, 'Consumida');
    assert.deepEqual(datos.repeticionAprobada.consumidaEn, AHORA);
  });

  test('finaliza una sesión con evaluación (mismo camino que finalizarPropia)', async () => {
    const { servicio, datos } = crearContexto();

    datos.sesiones.push({
      id: 1,
      actividad_id: 1,
      estudiante_id: 20,
      numeroIntento: 1,
      estado: ESTADOS_SESION.EN_CURSO,
      inicio: new Date('2026-11-07T14:30:00.000Z'),
      fin: null,
      segundosConsumidos: 0,
      motivoCierre: null
    });

    const resultado = await servicio.finalizarSesion({
      sesionId: 1,
      estudianteId: 20
    });

    assert.equal(resultado.sesion.estado, ESTADOS_SESION.FINALIZADO);
    assert.equal(resultado.sesion.motivoCierre, MOTIVOS_CIERRE.FINALIZACION);
    assert.ok(resultado.evaluacion);
    assert.equal(resultado.evaluacion.id, 99);
  });

  test('impide que un estudiante finalice una sesión ajena', async () => {
    const { servicio, datos } = crearContexto();

    datos.sesiones.push({
      id: 1,
      actividad_id: 1,
      estudiante_id: 20,
      numeroIntento: 1,
      estado: ESTADOS_SESION.EN_CURSO,
      inicio: new Date('2026-11-07T14:30:00.000Z'),
      fin: null,
      segundosConsumidos: 0,
      motivoCierre: null
    });

    await assert.rejects(
      servicio.finalizarSesion({
        sesionId: 1,
        estudianteId: 30
      }),
      { statusCode: 403 }
    );
  });

  test('rechaza identificadores inválidos', async () => {
    const { servicio } = crearContexto();

    await assert.rejects(
      servicio.iniciarSesion({
        actividadId: 0,
        estudianteId: 20
      }),
      { statusCode: 400 }
    );
  });
});
