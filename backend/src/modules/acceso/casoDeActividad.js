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

/**
 * Casos de las actividades a las que el estudiante está convocado (estado
 * Autorizado). Se usa con el ingreso por código de sesión (OTP), cuyo token
 * no trae una actividad concreta.
 */
export function crearBuscadorCasosDelEstudiante(conexion) {
  if (!conexion || typeof conexion.execute !== 'function') {
    throw new TypeError('crearBuscadorCasosDelEstudiante necesita una conexión con execute()');
  }

  return async function buscarCasosDelEstudiante(estudianteId) {
    const [filas] = await conexion.execute(
      `SELECT DISTINCT a.caso_id AS casoId
         FROM EstudianteAutorizado ea
         JOIN ActividadProgramada a ON a.id = ea.actividad_id
        WHERE ea.estudiante_id = ? AND ea.estado = 'Autorizado'`,
      [estudianteId]
    );
    return filas.map((fila) => fila.casoId);
  };
}

let buscadorPorDefecto;
let buscadorCasosPorDefecto;

/** Versión con el pool real de buscarCasosDelEstudiante. */
export async function buscarCasosDelEstudiantePorDefecto(estudianteId) {
  if (!buscadorCasosPorDefecto) {
    const { pool } = await import('../../config/database.js');
    buscadorCasosPorDefecto = crearBuscadorCasosDelEstudiante(pool);
  }
  return buscadorCasosPorDefecto(estudianteId);
}

/** Versión con el pool real; importa la conexión solo cuando se usa. */
export async function buscarCasoDeActividadPorDefecto(actividadId) {
  if (!buscadorPorDefecto) {
    const { pool } = await import('../../config/database.js');
    buscadorPorDefecto = crearBuscadorCasoDeActividad(pool);
  }
  return buscadorPorDefecto(actividadId);
}
