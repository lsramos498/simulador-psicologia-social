/**
 * Límite de intentos de ingreso (Sofía Gallego — acceso y permisos).
 *
 * Problema: sin límite, alguien puede probar contraseñas o códigos sin parar
 * contra un mismo correo (fuerza bruta).
 *
 * Regla: después de `maxIntentos` fallos seguidos para la misma clave
 * (por ejemplo, el correo), el ingreso queda bloqueado durante `bloqueoMs`.
 * Un ingreso correcto borra el contador.
 *
 * Limitación conocida: los contadores viven en la memoria del proceso.
 * Si el servidor se reinicia se borran, y con varios servidores cada uno
 * lleva su propia cuenta.
 */

export const LIMITE_POR_DEFECTO = Object.freeze({
  maxIntentos: 5,
  bloqueoMs: 15 * 60 * 1000
});

export function crearLimiteIntentos({
  maxIntentos = LIMITE_POR_DEFECTO.maxIntentos,
  bloqueoMs = LIMITE_POR_DEFECTO.bloqueoMs,
  reloj = () => Date.now()
} = {}) {
  if (!Number.isInteger(maxIntentos) || maxIntentos < 1) {
    throw new TypeError('maxIntentos debe ser un entero mayor que 0');
  }
  if (!Number.isInteger(bloqueoMs) || bloqueoMs < 1) {
    throw new TypeError('bloqueoMs debe ser un entero mayor que 0');
  }

  const registros = new Map(); // clave → { fallos, bloqueadoHasta }

  function registroVigente(clave) {
    const registro = registros.get(clave);
    if (registro?.bloqueadoHasta && registro.bloqueadoHasta <= reloj()) {
      registros.delete(clave); // el bloqueo ya venció: empieza de cero
      return undefined;
    }
    return registro;
  }

  return {
    estaBloqueado(clave) {
      const registro = registroVigente(clave);
      return Boolean(registro?.bloqueadoHasta);
    },

    registrarFallo(clave) {
      const registro = registroVigente(clave) ?? { fallos: 0, bloqueadoHasta: null };
      registro.fallos += 1;
      if (registro.fallos >= maxIntentos) {
        registro.bloqueadoHasta = reloj() + bloqueoMs;
      }
      registros.set(clave, registro);
    },

    reiniciar(clave) {
      registros.delete(clave);
    }
  };
}
