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
 * Los fallos vencen: si pasa `bloqueoMs` desde el último fallo sin llegar al
 * máximo, la cuenta empieza de cero. Así 4 errores un lunes y 1 el viernes
 * no bloquean a nadie; solo los intentos seguidos cuentan.
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

  const registros = new Map(); // clave → { fallos, ultimoFallo, bloqueadoHasta }

  function vencido(registro, ahora) {
    return registro.bloqueadoHasta
      ? registro.bloqueadoHasta <= ahora // el bloqueo ya terminó
      : registro.ultimoFallo + bloqueoMs <= ahora; // fallos viejos, sin bloqueo
  }

  function registroVigente(clave) {
    const registro = registros.get(clave);
    if (registro && vencido(registro, reloj())) {
      registros.delete(clave); // empieza de cero
      return undefined;
    }
    return registro;
  }

  // Evita que la memoria crezca sin fin con correos que no vuelven a intentar.
  function limpiarVencidos() {
    const ahora = reloj();
    for (const [clave, registro] of registros) {
      if (vencido(registro, ahora)) registros.delete(clave);
    }
  }

  return {
    estaBloqueado(clave) {
      const registro = registroVigente(clave);
      return Boolean(registro?.bloqueadoHasta);
    },

    registrarFallo(clave) {
      if (registros.size >= 10000) limpiarVencidos();

      const registro = registroVigente(clave) ?? { fallos: 0, ultimoFallo: 0, bloqueadoHasta: null };
      registro.fallos += 1;
      registro.ultimoFallo = reloj();
      if (registro.fallos >= maxIntentos) {
        registro.bloqueadoHasta = registro.ultimoFallo + bloqueoMs;
      }
      registros.set(clave, registro);
    },

    reiniciar(clave) {
      registros.delete(clave);
    }
  };
}
