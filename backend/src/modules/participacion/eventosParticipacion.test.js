
import test from 'node:test';
import assert from 'node:assert/strict';

import { EventosParticipacion } from './eventosParticipacion.js';
import { crearNotificacionInterna } from './notificacionInterna.js';

test('Observer crea una notificación al finalizar una participación', () => {
  // PATRÓN OBSERVER: instancia el emisor para esta prueba aislada.
  const eventos = new EventosParticipacion();
  const notificaciones = [];

  // PATRÓN OBSERVER: suscribe una función que reacciona construyendo el aviso.
  eventos.suscribir((evento) => {
    const notificacion = crearNotificacionInterna(evento);

    if (notificacion !== null) {
      notificaciones.push(notificacion);
    }
  });

  // PATRÓN OBSERVER: publica un evento simulado; no procede de una operación MySQL.
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

  // PATRÓN OBSERVER: este observador cuenta los eventos recibidos.
  const observador = () => {
    notificacionesRecibidas++;
  };

  eventos.suscribir(observador);
  eventos.notificar({ tipo: 'participacionFinalizada' });

  // PATRÓN OBSERVER: comprueba que el observador retirado ya no reacciona.
  eventos.desuscribir(observador);
  eventos.notificar({ tipo: 'participacionFinalizada' });

  assert.equal(notificacionesRecibidas, 1);
});
