
export function crearRepositorioSesiones(pool) {
  if (!pool) {
    throw new Error('Se requiere una conexión a la base de datos.');
  }

  async function obtenerConexion() {
    return pool.getConnection();
  }

  /**
   * Ejecuta una operación dentro de una transacción.
   * Si ocurre un error, revierte los cambios.
   */
  async function enTransaccion(operacion) {
    const conexion = await obtenerConexion();

    try {
      await conexion.beginTransaction();

      const resultado = await operacion(conexion);

      await conexion.commit();

      return resultado;
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  /**
   * Consulta la actividad y bloquea su registro
   * para evitar modificaciones simultáneas.
   */
  async function obtenerActividad(conexion, actividadId) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          docente_id,
          fechaInicio,
          fechaFin,
          tiempoLimiteSegundos,
          intentosPermitidos,
          estado
       FROM ActividadProgramada
       WHERE id = ?
       FOR UPDATE`,
      [actividadId]
    );

    return filas[0] ?? null;
  }

  /**
   * Verifica que el estudiante esté autorizado
   * para participar en la actividad.
   */
  async function obtenerAutorizacion(
    conexion,
    actividadId,
    estudianteId
  ) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          actividad_id,
          estudiante_id,
          estado
       FROM EstudianteAutorizado
       WHERE actividad_id = ?
         AND estudiante_id = ?
       FOR UPDATE`,
      [actividadId, estudianteId]
    );

    return filas[0] ?? null;
  }

  /**
   * Recupera la última sesión del estudiante
   * dentro de una actividad.
   */
  async function obtenerUltimaSesion(
    conexion,
    actividadId,
    estudianteId
  ) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          actividad_id,
          estudiante_id,
          numeroIntento,
          estado,
          inicio,
          fin,
          segundosConsumidos,
          motivoCierre
       FROM SesionSimulacion
       WHERE actividad_id = ?
         AND estudiante_id = ?
       ORDER BY numeroIntento DESC
       LIMIT 1
       FOR UPDATE`,
      [actividadId, estudianteId]
    );

    return filas[0] ?? null;
  }

  async function obtenerSesionPorId(conexion, sesionId) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          actividad_id,
          estudiante_id,
          numeroIntento,
          estado,
          inicio,
          fin,
          segundosConsumidos,
          motivoCierre
       FROM SesionSimulacion
       WHERE id = ?
       FOR UPDATE`,
      [sesionId]
    );

    return filas[0] ?? null;
  }

  /**
   * Inserta una sesión individual.
   */
  async function insertarSesion(conexion, sesion) {
    const [resultado] = await conexion.execute(
      `INSERT INTO SesionSimulacion (
          actividad_id,
          estudiante_id,
          numeroIntento,
          estado,
          inicio,
          fin,
          segundosConsumidos,
          motivoCierre
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sesion.actividadId,
        sesion.estudianteId,
        sesion.numeroIntento,
        sesion.estado,
        sesion.inicio,
        sesion.fin,
        sesion.segundosConsumidos,
        sesion.motivoCierre
      ]
    );

    return {
      ...sesion,
      id: resultado.insertId
    };
  }

  /**
   * Actualiza el estado y los datos de una sesión.
   */
  async function actualizarSesion(conexion, sesion) {
    const [resultado] = await conexion.execute(
      `UPDATE SesionSimulacion
       SET estado = ?,
           inicio = ?,
           fin = ?,
           segundosConsumidos = ?,
           motivoCierre = ?
       WHERE id = ?`,
      [
        sesion.estado,
        sesion.inicio,
        sesion.fin,
        sesion.segundosConsumidos,
        sesion.motivoCierre,
        sesion.id
      ]
    );

    if (resultado.affectedRows !== 1) {
      throw new Error('No fue posible actualizar la sesión.');
    }

    return sesion;
  }

return {
  enTransaccion,
  obtenerActividad,
  obtenerAutorizacion,
  obtenerUltimaSesion,
  obtenerSesionPorId,
  insertarSesion,
  actualizarSesion
};
  
}
