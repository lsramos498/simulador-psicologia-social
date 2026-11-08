
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

test('Publicación sin observadores devuelve un resumen vacío', async () => {
  assert.deepEqual(await new EventosParticipacion().notificar({}), {
    total: 0, exitosos: 0, fallidos: 0, errores: []
  });
});

for (const invalido of [undefined, null, {}, [], 3, true, Promise.resolve()]) {
  test(`Rechaza observador no funcional: ${String(invalido)}`, () => {
    const eventos = new EventosParticipacion();
    assert.throws(() => eventos.suscribir(invalido), TypeError);
    assert.equal(eventos.observadores.length, 0);
  });
}

test('Suscribir la misma función dos veces produce una sola llamada', async () => {
  const eventos = new EventosParticipacion();
  let llamadas = 0;
  const observador = () => { llamadas++; };
  eventos.suscribir(observador);
  eventos.suscribir(observador);
  const resumen = await eventos.notificar({});
  assert.equal(llamadas, 1);
  assert.deepEqual(resumen, { total: 1, exitosos: 1, fallidos: 0, errores: [] });
});

test('Mantiene efectos síncronos inmediatos sin exigir await a consumidores previos', async () => {
  const eventos = new EventosParticipacion();
  const recibidos = [];
  const evento = Object.freeze({ tipo: 'respuestaRegistrada' });
  eventos.suscribir((dato) => { recibidos.push(dato); });
  const publicacion = eventos.notificar(evento);
  assert.deepEqual(recibidos, [evento]);
  assert.ok(publicacion instanceof Promise);
  await publicacion;
});

test('Espera observadores asíncronos y mantiene el orden de invocación', async () => {
  const eventos = new EventosParticipacion();
  const pasos = [];
  let terminar;
  const espera = new Promise((resolve) => { terminar = resolve; });
  eventos.suscribir(async () => { pasos.push('inicio async'); await espera; pasos.push('fin async'); });
  eventos.suscribir(() => { pasos.push('sync'); });
  const resultado = eventos.notificar({});
  assert.deepEqual(pasos, ['inicio async', 'sync']);
  terminar();
  assert.deepEqual(await resultado, { total: 2, exitosos: 2, fallidos: 0, errores: [] });
  assert.deepEqual(pasos, ['inicio async', 'sync', 'fin async']);
});

test('Varios observadores reciben exactamente el mismo evento', async () => {
  const eventos = new EventosParticipacion();
  const evento = Object.freeze({ tipo: 'respuestaRegistrada' });
  const recibidos = [];
  eventos.suscribir((dato) => { recibidos.push(dato); });
  eventos.suscribir(async (dato) => { await Promise.resolve(); recibidos.push(dato); });
  const resumen = await eventos.notificar(evento);
  assert.equal(resumen.exitosos, 2);
  assert.equal(recibidos.length, 2);
  assert.ok(recibidos.every((dato) => dato === evento));
});

test('Una excepción síncrona no interrumpe los demás ni expone datos sensibles', async () => {
  const eventos = new EventosParticipacion();
  let llamadas = 0;
  eventos.suscribir(() => { throw new Error('detalle privado simulado'); });
  eventos.suscribir(() => { llamadas++; return 'retorno privado simulado'; });
  const resultado = eventos.notificar({ dato: 'evento privado simulado' });
  assert.equal(llamadas, 1);
  const resumen = await resultado;
  assert.deepEqual(resumen, {
    total: 2, exitosos: 1, fallidos: 1, errores: [{ indice: 0, codigo: 'OBSERVADOR_FALLO' }]
  });
  assert.doesNotMatch(JSON.stringify(resumen), /privado|stack|message/);
});

test('Promesas rechazadas y valores lanzados sin Error quedan controlados', async () => {
  const eventos = new EventosParticipacion();
  let reacciono = false;
  eventos.suscribir(async () => { throw new Error('fallo async simulado'); });
  eventos.suscribir(() => Promise.reject('rechazo simulado'));
  eventos.suscribir(() => { throw null; });
  eventos.suscribir(() => { reacciono = true; });
  const resumen = await eventos.notificar({});
  assert.equal(reacciono, true);
  assert.deepEqual(resumen, {
    total: 4, exitosos: 1, fallidos: 3,
    errores: [0, 1, 2].map((indice) => ({ indice, codigo: 'OBSERVADOR_FALLO' }))
  });
});

test('Ignorar la promesa devuelta no deja rechazos de observadores sin controlar', async () => {
  const eventos = new EventosParticipacion();
  eventos.suscribir(() => Promise.reject(new Error('rechazo observado internamente')));
  eventos.notificar({});
  // node:test detectaría un unhandledRejection; se espera un turno del bucle para comprobarlo.
  await new Promise((resolve) => setImmediate(resolve));
});

test('Controla también errores de objetos con then', async () => {
  const eventos = new EventosParticipacion();
  eventos.suscribir(() => ({ get then() { throw new Error('fallo then simulado'); } }));
  eventos.suscribir(() => ({ then(resolve) { resolve(); } }));
  assert.deepEqual(await eventos.notificar({}), {
    total: 2, exitosos: 1, fallidos: 1, errores: [{ indice: 0, codigo: 'OBSERVADOR_FALLO' }]
  });
});

test('Desuscribir es repetible y permite volver a suscribir', async () => {
  const eventos = new EventosParticipacion();
  let llamadas = 0;
  const observador = async () => { llamadas++; };
  eventos.suscribir(observador);
  eventos.desuscribir(observador);
  eventos.desuscribir(observador);
  assert.equal((await eventos.notificar({})).total, 0);
  eventos.suscribir(observador);
  await eventos.notificar({});
  assert.equal(llamadas, 1);
});

test('Cambios de suscripción durante una publicación se aplican a la siguiente', async () => {
  const eventos = new EventosParticipacion();
  const llamadas = [];
  const segundo = () => { llamadas.push('segundo'); };
  const nuevo = () => { llamadas.push('nuevo'); };
  eventos.suscribir(() => {
    llamadas.push('primero');
    eventos.desuscribir(segundo);
    eventos.suscribir(nuevo);
  });
  eventos.suscribir(segundo);
  await eventos.notificar({});
  assert.deepEqual(llamadas, ['primero', 'segundo']);
  llamadas.length = 0;
  await eventos.notificar({});
  assert.deepEqual(llamadas, ['primero', 'nuevo']);
});

test('Publicaciones simultáneas tienen resúmenes independientes', async () => {
  const eventos = new EventosParticipacion();
  const bueno = {};
  const malo = {};
  eventos.suscribir(async (evento) => { if (evento === malo) throw new Error('fallo simulado'); });
  const [primero, segundo] = await Promise.all([eventos.notificar(bueno), eventos.notificar(malo)]);
  assert.deepEqual(primero, { total: 1, exitosos: 1, fallidos: 0, errores: [] });
  assert.equal(segundo.fallidos, 1);
});
