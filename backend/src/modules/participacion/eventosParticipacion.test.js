
import test from 'node:test';
import assert from 'node:assert/strict';

import { EventosParticipacion } from './eventosParticipacion.js';
import { crearNotificacionInterna } from './notificacionInterna.js';

test('Observer crea una notificación al finalizar una participación', () => {
  const eventos = new EventosParticipacion();
  const notificaciones = [];

  eventos.suscribir((evento) => {
    const notificacion = crearNotificacionInterna(evento);

    if (notificacion !== null) {
      notificaciones.push(notificacion);
    }
  });

  eventos.notificar({
    tipo: 'participacionFinalizada',
    estudianteId: 1
  });

  assert.deepEqual(notificaciones, [
    {
      estudianteId: 1,
      mensaje: 'Tu participación ha finalizado correctamente',
      leida: false
    }
  ]);
});

test('No crea notificaciones para otros eventos', () => {
  const eventos = new EventosParticipacion();
  const notificaciones = [];

  eventos.suscribir((evento) => {
    const notificacion = crearNotificacionInterna(evento);

    if (notificacion !== null) {
      notificaciones.push(notificacion);
    }
  });

  eventos.notificar({
    tipo: 'respuestaRegistrada',
    estudianteId: 1
  });

  assert.equal(notificaciones.length, 0);
});

test('Rechaza observadores que no son funciones', () => {
  const eventos = new EventosParticipacion();

  assert.throws(() => eventos.suscribir('observador'), TypeError);
});


test('No notifica después de desuscribir un observador', () => {
  const eventos = new EventosParticipacion();
  let notificacionesRecibidas = 0;

  const observador = () => {
    notificacionesRecibidas++;
  };

  eventos.suscribir(observador);
  eventos.notificar({ tipo: 'participacionFinalizada' });

  eventos.desuscribir(observador);
  eventos.notificar({ tipo: 'participacionFinalizada' });

  assert.equal(notificacionesRecibidas, 1);
});
