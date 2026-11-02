import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CreadorNotificacion,
  CreadorConvocatoria,
  CreadorCambioEstudiante,
  TIPOS_NOTIFICACION,
  obtenerCreadorNotificacion
} from './notificaciones.factory.js';

import {
  NotificacionConvocatoriaStrategy,
  NotificacionCambioEstudianteStrategy
} from './notificaciones.strategy.js';
test('El creador base exige implementar crearEstrategia', () => {
  const creador = new CreadorNotificacion();

  assert.throws(
    () => creador.crearEstrategia(),
    /debe implementarse/
  );
});
test('Crea la estrategia de convocatoria', () => {
  const creador = new CreadorConvocatoria();
  const estrategia = creador.crearEstrategia();

  assert.ok(
    estrategia instanceof NotificacionConvocatoriaStrategy
  );
});

test('Crea la estrategia de cambios de estudiantes', () => {
  const creador = new CreadorCambioEstudiante();
  const estrategia = creador.crearEstrategia();

  assert.ok(
    estrategia instanceof NotificacionCambioEstudianteStrategy
  );
});
test('Selecciona el creador de convocatorias', () => {
  const creador = obtenerCreadorNotificacion(
    TIPOS_NOTIFICACION.CONVOCATORIA
  );

  assert.ok(creador instanceof CreadorConvocatoria);
});

test('Selecciona el creador de cambios de estudiantes', () => {
  const creador = obtenerCreadorNotificacion(
    TIPOS_NOTIFICACION.CAMBIO_ESTUDIANTE
  );

  assert.ok(creador instanceof CreadorCambioEstudiante);
});
test('Rechaza tipos de notificación desconocidos', () => {
  assert.throws(
    () => obtenerCreadorNotificacion('NOTIFICACION_INVALIDA'),
    TypeError
  );
});

test('El creador genera correctamente el mensaje de convocatoria', () => {
  const creador = obtenerCreadorNotificacion(
    TIPOS_NOTIFICACION.CONVOCATORIA
  );

  const resultado = creador.crearMensaje({
    destinatario: 'estudiante@universidad.edu.co',
    caso: {
      titulo: 'Conflicto social',
      desarrolloSituacional: 'Desarrollo del caso',
      contextoHistoria: 'Contexto de la historia'
    },
    mensajePersonalizado: 'Prepárate para participar.',
    urlAcceso: 'https://lumina.edu.co/actividad/10',
    codigoAutorizacion: 'ABC23456'
  });

  assert.equal(
    resultado.to,
    'estudiante@universidad.edu.co'
  );

  assert.match(resultado.subject, /Conflicto social/);
});
