import test from 'node:test';
import assert from 'node:assert/strict';

import {
  crearServicioNotificaciones
} from './notificaciones.service.js';

import {
  TIPOS_NOTIFICACION
} from './notificaciones.factory.js';

import {
  ACCIONES_CAMBIO_ESTUDIANTE
} from './notificaciones.strategy.js';
test('Rechaza un transporte no válido', () => {
  assert.throws(
    () => crearServicioNotificaciones(),
    TypeError
  );
});

test('Envía una notificación de cambio de estudiante', async () => {
  const enviados = [];

  const servicio = crearServicioNotificaciones({
    async enviar(mensaje) {
      enviados.push(mensaje);
    }
  });

  const resultado = await servicio.enviar(
    TIPOS_NOTIFICACION.CAMBIO_ESTUDIANTE,
    {
      destinatario: 'estudiante@lumina.test',
      casoTitulo: 'Caso de prueba',
      accion: ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO
    }
  );

  assert.equal(enviados.length, 1);
  assert.equal(
    resultado.destinatario,
    'estudiante@lumina.test'
  );
  assert.equal(resultado.estado, 'ENVIADO');
  assert.equal(
    enviados[0].to,
    'estudiante@lumina.test'
  );
});
test('Rechaza un tipo de notificación desconocido', async () => {
  let llamadas = 0;

  const servicio = crearServicioNotificaciones({
    async enviar() {
      llamadas++;
    }
  });

  await assert.rejects(
    () => servicio.enviar('TIPO_INEXISTENTE', {}),
    TypeError
  );

  assert.equal(llamadas, 0);
});

test('Propaga los errores del transporte de correo', async () => {
  const error = new Error('Error de conexión');

  const servicio = crearServicioNotificaciones({
    async enviar() {
      throw error;
    }
  });

  await assert.rejects(
    () => servicio.enviar(
      TIPOS_NOTIFICACION.CAMBIO_ESTUDIANTE,
      {
        destinatario: 'estudiante@lumina.test',
        casoTitulo: 'Caso de prueba',
        accion: ACCIONES_CAMBIO_ESTUDIANTE.AGREGADO
      }
    ),
    error
  );
});