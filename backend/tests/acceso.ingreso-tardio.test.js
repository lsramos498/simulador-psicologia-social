import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRACCION_POR_DEFECTO,
  calcularLimiteIngreso,
  esIngresoTardio,
  leerFraccionIngresoTardio
} from '../src/modules/acceso/ingresoTardio.js';

/** RF-22: restringir el ingreso tardío (Sofía Gallego — acceso). */

const actividad = { fechaInicio: new Date('2026-11-22T08:00:00'), tiempoLimiteSegundos: 1800 }; // 30 min

test('por defecto el límite es la mitad del tiempo: 08:00 + 15 min', () => {
  assert.equal(FRACCION_POR_DEFECTO, 0.5);
  assert.equal(calcularLimiteIngreso(actividad, 0.5).getTime(), new Date('2026-11-22T08:15:00').getTime());
});

test('antes o justo en el límite no es tardío; después sí', () => {
  assert.equal(esIngresoTardio(actividad, new Date('2026-11-22T08:10:00'), 0.5), false);
  assert.equal(esIngresoTardio(actividad, new Date('2026-11-22T08:15:00'), 0.5), false);
  assert.equal(esIngresoTardio(actividad, new Date('2026-11-22T08:15:01'), 0.5), true);
});

test('la fracción se puede cambiar (por ejemplo, un cuarto del tiempo)', () => {
  assert.equal(esIngresoTardio(actividad, new Date('2026-11-22T08:10:00'), 0.25), true);
});

test('con fracción 0 la regla queda desactivada', () => {
  assert.equal(calcularLimiteIngreso(actividad, 0), null);
  assert.equal(esIngresoTardio(actividad, new Date('2026-11-23T08:00:00'), 0), false);
});

test('sin fecha de inicio o sin tiempo límite válido la regla no aplica', () => {
  assert.equal(esIngresoTardio({ fechaInicio: null, tiempoLimiteSegundos: 1800 }, new Date(), 0.5), false);
  assert.equal(esIngresoTardio({ fechaInicio: actividad.fechaInicio, tiempoLimiteSegundos: 0 }, new Date('2030-01-01'), 0.5), false);
});

test('lee INGRESO_TARDIO_FRACCION del .env y rechaza valores inválidos', () => {
  assert.equal(leerFraccionIngresoTardio(undefined), 0.5);
  assert.equal(leerFraccionIngresoTardio(''), 0.5);
  assert.equal(leerFraccionIngresoTardio('0.25'), 0.25);
  assert.equal(leerFraccionIngresoTardio('0'), 0);
  assert.throws(() => leerFraccionIngresoTardio('mitad'), TypeError);
  assert.throws(() => leerFraccionIngresoTardio('1.5'), TypeError);
});
