/**
 * Consulta del caso asociado a una actividad (RF-10 / RF-20, Sofía Gallego).
 * La usa requiereCasoDeSuActividad para que un estudiante solo vea el caso
 * de la actividad con la que ingresó. SQL parametrizado.
 */
export function crearBuscadorCasoDeActividad(conexion) {
  if (!conexion || typeof conexion.execute !== 'function') {
    throw new TypeError('crearBuscadorCasoDeActividad necesita una conexión con execute()');
  }

  return async function buscarCasoDeActividad(actividadId) {
    const [filas] = await conexion.execute(
      'SELECT caso_id AS casoId FROM ActividadProgramada WHERE id = ?',
      [actividadId]
    );
    return filas[0]?.casoId ?? null;
  };
}

let buscadorPorDefecto;

/** Versión con el pool real; importa la conexión solo cuando se usa. */
export async function buscarCasoDeActividadPorDefecto(actividadId) {
  if (!buscadorPorDefecto) {
    const { pool } = await import('../../config/database.js');
    buscadorPorDefecto = crearBuscadorCasoDeActividad(pool);
  }
  return buscadorPorDefecto(actividadId);
}
