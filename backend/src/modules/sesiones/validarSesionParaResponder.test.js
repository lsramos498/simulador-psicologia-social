import test from 'node:test';
import assert from 'node:assert/strict';
import { validarSesionParaResponder } from './validarSesionParaResponder.js';

const ahora = new Date('2026-11-15T16:00:00');

function contexto(extra = {}) {
  return {
    id: 1,
    actividadId: 3,
    estudianteId: 7,
    casoId: 4,
    estado: 'En curso',
    inicio: new Date('2026-11-15T15:55:00'),
    tiempoLimiteSegundos: 600,
    estadoActividad: 'Iniciada',
    fechaInicio: new Date('2026-11-15T14:00:00'),
    fechaFin: new Date('2026-11-15T18:00:00'),
    estadoAutorizacion: 'Autorizado',
    ...extra
  };
}

test('acepta una sesión en curso autorizada dentro de la ventana', () => {
  const sesion = validarSesionParaResponder(contexto(), 7, ahora);
  assert.equal(sesion.id, 1);
  assert.equal(sesion.casoId, 4);
});

test('rechaza sesión ajena', () => {
  assert.throws(
    () => validarSesionParaResponder(contexto(), 99, ahora),
    (error) => error.codigo === 'SESION_AJENA'
  );
});

test('rechaza estudiante no autorizado', () => {
  assert.throws(
    () => validarSesionParaResponder(contexto({ estadoAutorizacion: 'Retirado' }), 7, ahora),
    (error) => error.codigo === 'NO_AUTORIZADO'
  );
});

test('rechaza actividad no iniciada', () => {
  assert.throws(
    () => validarSesionParaResponder(contexto({ estadoActividad: 'Programada' }), 7, ahora),
    (error) => error.codigo === 'ACTIVIDAD_NO_INICIADA'
  );
});

test('rechaza fuera de ventana', () => {
  assert.throws(
    () => validarSesionParaResponder(contexto(), 7, new Date('2026-11-15T20:00:00')),
    (error) => error.codigo === 'FUERA_DE_VENTANA'
  );
});

test('rechaza tiempo agotado', () => {
  assert.throws(
    () => validarSesionParaResponder(
      contexto({ inicio: new Date('2026-11-15T15:00:00'), tiempoLimiteSegundos: 60 }),
      7,
      ahora
    ),
    (error) => error.codigo === 'TIEMPO_AGOTADO'
  );
});
