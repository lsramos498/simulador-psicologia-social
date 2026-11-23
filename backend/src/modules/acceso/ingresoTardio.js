/**
 * RF-22: restringir el ingreso tardío (Sofía Gallego — acceso).
 *
 * "El sistema debe impedir iniciar la participación si ya pasó la mitad del
 * tiempo del caso en que el estudiante debió iniciar."
 *
 * Regla por defecto: el estudiante puede iniciar hasta
 *   fechaInicio de la actividad + INGRESO_TARDIO_FRACCION × tiempo límite.
 * Con la fracción por defecto (0.5) es "la mitad del tiempo".
 *
 * El requisito pide confirmar la base del cálculo con la profesora; por eso
 * la fracción se cambia en el .env sin tocar código:
 *   INGRESO_TARDIO_FRACCION=0.5   (por defecto)
 *   INGRESO_TARDIO_FRACCION=0     (desactiva la regla)
 */
export const FRACCION_POR_DEFECTO = 0.5;

export function leerFraccionIngresoTardio(valor = process.env.INGRESO_TARDIO_FRACCION) {
  if (valor === undefined || String(valor).trim() === '') {
    return FRACCION_POR_DEFECTO;
  }
  const fraccion = Number(valor);
  if (!Number.isFinite(fraccion) || fraccion < 0 || fraccion > 1) {
    throw new TypeError('INGRESO_TARDIO_FRACCION debe ser un número entre 0 y 1');
  }
  return fraccion;
}

/**
 * Devuelve el instante límite para iniciar, o null si la regla no aplica
 * (fracción 0, o sin fecha de inicio o tiempo límite válidos).
 */
export function calcularLimiteIngreso({ fechaInicio, tiempoLimiteSegundos }, fraccion = leerFraccionIngresoTardio()) {
  const inicio = fechaInicio == null ? NaN : new Date(fechaInicio).getTime();
  const segundos = Number(tiempoLimiteSegundos);
  if (fraccion === 0 || !Number.isFinite(inicio) || !Number.isFinite(segundos) || segundos <= 0) {
    return null;
  }
  return new Date(inicio + fraccion * segundos * 1000);
}

/** true si a la hora `ahora` ya es tarde para iniciar la participación. */
export function esIngresoTardio(actividad, ahora = new Date(), fraccion = leerFraccionIngresoTardio()) {
  const limite = calcularLimiteIngreso(actividad, fraccion);
  return limite !== null && new Date(ahora).getTime() > limite.getTime();
}
