import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SesionSimulacion,
  ESTADOS_SESION,
  MOTIVOS_CIERRE
} from '../src/modules/sesiones/sesion.state.js';

function crearSesion() {
  return new SesionSimulacion({
    id: 1,
    actividadId: 10,
    estudianteId: 20,
    numeroIntento: 1
  });
}

test('Una sesión nueva comienza en Sin iniciar', () => {
  const sesion = crearSesion();

  assert.equal(sesion.estado, ESTADOS_SESION.SIN_INICIAR);
  assert.equal(sesion.inicio, null);
  assert.equal(sesion.fin, null);
});

test('Una sesión Sin iniciar puede pasar a En curso', () => {
  const sesion = crearSesion();
  const inicio = new Date('2026-10-30T09:00:00');

  sesion.iniciar(inicio);

  assert.equal(sesion.estado, ESTADOS_SESION.EN_CURSO);
  assert.equal(sesion.inicio.getTime(), inicio.getTime());
});

test('Una sesión no puede finalizar antes de comenzar', () => {
  const sesion = crearSesion();

  assert.throws(
    () => sesion.finalizar(),
    /no puede finalizarse/
  );
});

test('Una sesión En curso puede pasar a Finalizado', () => {
  const sesion = crearSesion();

  sesion.iniciar(new Date('2026-10-30T09:00:00'));

  sesion.finalizar({
    fechaFin: new Date('2026-10-30T09:02:00'),
    motivoCierre: MOTIVOS_CIERRE.FINALIZACION
  });

  assert.equal(sesion.estado, ESTADOS_SESION.FINALIZADO);
  assert.equal(sesion.segundosConsumidos, 120);
  assert.equal(sesion.motivoCierre, 'Finalizacion');
});

test('Una sesión Finalizado no puede volver a iniciarse', () => {
  const sesion = crearSesion();

  sesion.iniciar(new Date('2026-10-30T09:00:00'));
  sesion.finalizar({
    fechaFin: new Date('2026-10-30T09:01:00')
  });

  assert.throws(
    () => sesion.iniciar(),
    /no puede iniciarse/
  );
});

test('No permite una fecha de finalización anterior al inicio', () => {
  const sesion = crearSesion();

  sesion.iniciar(new Date('2026-10-30T09:00:00'));

  assert.throws(
    () => sesion.finalizar({
      fechaFin: new Date('2026-10-30T08:59:00')
    }),
    /anterior al inicio/
  );
});

test('No permite motivos de cierre que no estén definidos en el modelo', () => {
  const sesion = crearSesion();

  sesion.iniciar(new Date('2026-10-30T09:00:00'));

  assert.throws(
    () => sesion.finalizar({
      fechaFin: new Date('2026-10-30T09:01:00'),
      motivoCierre: 'Pausa'
    }),
    /Motivo de cierre no válido/
  );
});

test('Permite finalizar por tiempo agotado', () => {
  const sesion = crearSesion();

  sesion.iniciar(new Date('2026-10-30T09:00:00'));

  sesion.finalizar({
    fechaFin: new Date('2026-10-30T09:05:00'),
    segundosConsumidos: 300,
    motivoCierre: MOTIVOS_CIERRE.TIEMPO_AGOTADO
  });

  assert.equal(sesion.estado, ESTADOS_SESION.FINALIZADO);
  assert.equal(sesion.motivoCierre, 'TiempoAgotado');
  assert.equal(sesion.segundosConsumidos, 300);
});
