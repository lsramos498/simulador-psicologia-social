export function crearRepositorioNotificaciones(pool) {
  if (!pool || typeof pool.execute !== 'function') {
    throw new TypeError('Se requiere un pool MySQL para notificaciones.');
  }

  return Object.freeze({
    async insertar({
      usuarioId,
      actividadId = null,
      sesionId = null,
      tipo,
      canal,
      asunto,
      mensaje,
      url = null,
      estado = 'Enviada',
      fechaCreacion = new Date(),
      fechaEnvio = null,
      errorEnvio = null
    }) {
      const [resultado] = await pool.execute(
        `INSERT INTO Notificacion
           (usuario_id, actividad_id, sesion_id, tipo, canal, asunto, mensaje, url,
            estado, fechaCreacion, fechaEnvio, errorEnvio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuarioId,
          actividadId,
          sesionId,
          tipo,
          canal,
          asunto,
          mensaje,
          url,
          estado,
          fechaCreacion,
          fechaEnvio,
          errorEnvio
        ]
      );
      return resultado.insertId;
    },

    async listarPorUsuario(usuarioId, limite = 50) {
      const tope = Math.min(Math.max(Number(limite) || 50, 1), 100);
      const [filas] = await pool.execute(
        `SELECT id, actividad_id AS actividadId, sesion_id AS sesionId,
                tipo, canal, asunto, mensaje, url, estado,
                fechaCreacion, fechaEnvio, fechaLectura, errorEnvio
         FROM Notificacion
         WHERE usuario_id = ?
         ORDER BY id DESC
         LIMIT ${tope}`,
        [usuarioId]
      );
      return filas;
    },

    async marcarLeida(id, usuarioId) {
      const [resultado] = await pool.execute(
        `UPDATE Notificacion
         SET estado = 'Leida', fechaLectura = NOW()
         WHERE id = ? AND usuario_id = ? AND estado <> 'Leida'`,
        [id, usuarioId]
      );
      return resultado.affectedRows || 0;
    }
  });
}
