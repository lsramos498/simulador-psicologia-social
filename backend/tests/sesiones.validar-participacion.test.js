import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { crearServicioSesiones } from '../src/modules/sesiones/sesiones.service.js';
import {
  ESTADOS_SESION,
  MOTIVOS_CIERRE
} from '../src/modules/sesiones/sesion.state.js';

const INICIO = new Date('2026-11-13T14:00:00.000Z');
const LIMITE_SEGUNDOS = 600;

function crearContexto({
  ahora = new Date('2026-11-13T14:05:00.000Z'),
  actividad = {},
  autorizacion = {},
  sesion = {}
} = {}) {
  const datos = {
    actividad: {
      id: 1,
      casoId: 99,
      fechaInicio: new Date('2026-11-13T13:00:00.000Z'),
      fechaFin: new Date('2026-11-13T16:00:00.000Z'),
      tiempoLimiteSegundos: LIMITE_SEGUNDOS,
      estado: 'Iniciada',
      ...actividad
    },
    autorizacion: {
      id: 7,
      actividad_id: 1,
      estudiante_id: 20,
      estado: 'Autorizado',
      ...autorizacion
    },
    sesion: {
      id: 5,
      actividad_id: 1,
      estudiante_id: 20,
      numeroIntento: 1,
      estado: ESTADOS_SESION.EN_CURSO,
      inicio: INICIO,
      fin: null,
      segundosConsumidos: 0,
      motivoCierre: null,
      ...sesion
    },
    llamadas: [],
    actualizaciones: 0,
    transaccionesPropias: 0
  };

  const conexion = {
    async execute() {
      return [[], []];
    }
  };

  const repositorio = {
    async obtenerReferenciaSesion(_conexion, sesionId) {
      datos.llamadas.push('referencia');
      if (sesionId !== datos.sesion.id) return null;
      return {
        id: datos.sesion.id,
        actividad_id: datos.sesion.actividad_id,
        estudiante_id: datos.sesion.estudiante_id
      };
    },
    async obtenerActividad(_conexion, actividadId) {
      datos.llamadas.push('actividad');
      return actividadId === datos.actividad.id ? datos.actividad : null;
    },
    async obtenerAutorizacion(_conexion, actividadId, estudianteId) {
      datos.llamadas.push('autorizacion');
      if (
        actividadId !== datos.autorizacion.actividad_id ||
        estudianteId !== datos.autorizacion.estudiante_id
      ) return null;
      return datos.autorizacion;
    },
    async obtenerSesionPorId(_conexion, sesionId) {
      datos.llamadas.push('sesion');
      return sesionId === datos.sesion.id ? datos.sesion : null;
    },
    async actualizarSesion(_conexion, sesionActualizada) {
      datos.llamadas.push('actualizar');
      datos.actualizaciones += 1;
      datos.sesion = {
        id: sesionActualizada.id,
        actividad_id: sesionActualizada.actividadId,
        estudiante_id: sesionActualizada.estudianteId,
        numeroIntento: sesionActualizada.numeroIntento,
        estado: sesionActualizada.estado,
        inicio: sesionActualizada.inicio,
        fin: sesionActualizada.fin,
        segundosConsumidos: sesionActualizada.segundosConsumidos,
        motivoCierre: sesionActualizada.motivoCierre
      };
      return sesionActualizada;
    },
    async enTransaccion() {
      datos.transaccionesPropias += 1;
      throw new Error('El validador no debe abrir una transacción propia.');
    }
  };

  return {
    datos,
    conexion,
    servicio: crearServicioSesiones(repositorio, () => new Date(ahora))
  };
}

describe('validarSesionParaResponder', () => {
  test('permite responder dentro del tiempo y bloquea en el orden acordado', async () => {
    const { servicio, conexion, datos } = crearContexto();

    const resultado = await servicio.validarSesionParaResponder(5, 20, conexion);

    assert.equal(resultado.permitida, true);
    assert.equal(resultado.casoId, 99);
    assert.equal(resultado.tiempoLimiteSegundos, LIMITE_SEGUNDOS);
    assert.equal(resultado.tiempoRestanteSegundos, 300);
    assert.deepEqual(datos.llamadas, [
      'referencia',
      'actividad',
      'autorizacion',
      'sesion'
    ]);
    assert.equal(datos.actualizaciones, 0);
    assert.equal(datos.transaccionesPropias, 0);
  });

  test('finaliza la sesión al llegar exactamente al límite y devuelve rechazo sin lanzar error', async () => {
    const vence = new Date(INICIO.getTime() + LIMITE_SEGUNDOS * 1000);
    const { servicio, conexion, datos } = crearContexto({ ahora: vence });

    const resultado = await servicio.validarSesionParaResponder(5, 20, conexion);

    assert.equal(resultado.permitida, false);
    assert.equal(resultado.codigo, 'TIEMPO_AGOTADO');
    assert.equal(resultado.sesion.estado, ESTADOS_SESION.FINALIZADO);
    assert.equal(resultado.sesion.motivoCierre, MOTIVOS_CIERRE.TIEMPO_AGOTADO);
    assert.deepEqual(resultado.sesion.fin, vence);
    assert.equal(resultado.sesion.segundosConsumidos, LIMITE_SEGUNDOS);
    assert.equal(datos.actualizaciones, 1);
    assert.equal(datos.sesion.estado, ESTADOS_SESION.FINALIZADO);
  });

  test('registra como fin el instante real del vencimiento aunque la petición llegue tarde', async () => {
    const ahora = new Date(INICIO.getTime() + 900 * 1000);
    const vence = new Date(INICIO.getTime() + LIMITE_SEGUNDOS * 1000);
    const { servicio, conexion } = crearContexto({ ahora });

    const resultado = await servicio.validarSesionParaResponder(5, 20, conexion);

    assert.equal(resultado.permitida, false);
    assert.deepEqual(resultado.sesion.fin, vence);
    assert.equal(resultado.sesion.segundosConsumidos, LIMITE_SEGUNDOS);
  });

  test('mantiene el resultado de tiempo agotado si la sesión ya fue cerrada por ese motivo', async () => {
    const vence = new Date(INICIO.getTime() + LIMITE_SEGUNDOS * 1000);
    const { servicio, conexion, datos } = crearContexto({
      ahora: new Date(vence.getTime() + 30_000),
      sesion: {
        estado: ESTADOS_SESION.FINALIZADO,
        fin: vence,
        segundosConsumidos: LIMITE_SEGUNDOS,
        motivoCierre: MOTIVOS_CIERRE.TIEMPO_AGOTADO
      }
    });

    const resultado = await servicio.validarSesionParaResponder(5, 20, conexion);

    assert.equal(resultado.permitida, false);
    assert.equal(resultado.codigo, 'TIEMPO_AGOTADO');
    assert.equal(datos.actualizaciones, 0);
  });

  test('rechaza una sesión que ya fue finalizada por otra causa', async () => {
    const { servicio, conexion } = crearContexto({
      sesion: {
        estado: ESTADOS_SESION.FINALIZADO,
        fin: new Date('2026-11-13T14:04:00.000Z'),
        segundosConsumidos: 240,
        motivoCierre: MOTIVOS_CIERRE.FINALIZACION
      }
    });

    await assert.rejects(
      servicio.validarSesionParaResponder(5, 20, conexion),
      { statusCode: 409 }
    );
  });

  test('rechaza una sesión que no pertenece al estudiante', async () => {
    const { servicio, conexion, datos } = crearContexto({
      sesion: { estudiante_id: 30 }
    });

    await assert.rejects(
      servicio.validarSesionParaResponder(5, 20, conexion),
      { statusCode: 403 }
    );
    assert.deepEqual(datos.llamadas, ['referencia']);
  });

  test('rechaza estudiantes cuya autorización fue revocada', async () => {
    const { servicio, conexion, datos } = crearContexto({
      autorizacion: { estado: 'Retirado' }
    });

    await assert.rejects(
      servicio.validarSesionParaResponder(5, 20, conexion),
      { statusCode: 403 }
    );
    assert.deepEqual(datos.llamadas, [
      'referencia',
      'actividad',
      'autorizacion'
    ]);
  });

  test('rechaza actividades que ya fueron cerradas', async () => {
    const { servicio, conexion } = crearContexto({
      actividad: { estado: 'Cerrada' }
    });

    await assert.rejects(
      servicio.validarSesionParaResponder(5, 20, conexion),
      { statusCode: 409 }
    );
  });

  test('rechaza una actividad con límite de tiempo inválido', async () => {
    const { servicio, conexion } = crearContexto({
      actividad: { tiempoLimiteSegundos: 0 }
    });

    await assert.rejects(
      servicio.validarSesionParaResponder(5, 20, conexion),
      { statusCode: 500 }
    );
  });

  test('rechaza una conexión transaccional ausente o inválida', async () => {
    const { servicio } = crearContexto();

    await assert.rejects(
      servicio.validarSesionParaResponder(5, 20, null),
      { statusCode: 500 }
    );
  });

  test('rechaza identificadores inválidos antes de consultar el repositorio', async () => {
    const { servicio, conexion, datos } = crearContexto();

    await assert.rejects(
      servicio.validarSesionParaResponder(0, 20, conexion),
      { statusCode: 400 }
    );
    assert.deepEqual(datos.llamadas, []);
  });
});
