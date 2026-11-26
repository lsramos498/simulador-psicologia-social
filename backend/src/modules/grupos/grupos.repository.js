export function crearRepositorioGrupos(pool) {
  return {
    async crear({ nombre, codigo, docenteId, descripcion, fechaCreacion }) {
      const [resultado] = await pool.execute(
        `INSERT INTO GrupoAcademico (nombre, codigo, docente_id, descripcion, activo, fechaCreacion)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [nombre, codigo, docenteId, descripcion, fechaCreacion]
      );
      return resultado.insertId;
    },

    async listarPorDocente(docenteId, { todas = false } = {}) {
      const sql = todas
        ? `SELECT g.id, g.nombre, g.codigo, g.docente_id AS docenteId, g.descripcion, g.activo,
                  g.fechaCreacion,
                  (SELECT COUNT(*) FROM GrupoEstudiante ge WHERE ge.grupo_id = g.id) AS totalEstudiantes
           FROM GrupoAcademico g
           ORDER BY g.nombre, g.id`
        : `SELECT g.id, g.nombre, g.codigo, g.docente_id AS docenteId, g.descripcion, g.activo,
                  g.fechaCreacion,
                  (SELECT COUNT(*) FROM GrupoEstudiante ge WHERE ge.grupo_id = g.id) AS totalEstudiantes
           FROM GrupoAcademico g
           WHERE g.docente_id = ?
           ORDER BY g.nombre, g.id`;
      const [filas] = todas
        ? await pool.execute(sql)
        : await pool.execute(sql, [docenteId]);
      return filas;
    },

    async obtener(id) {
      const [filas] = await pool.execute(
        `SELECT id, nombre, codigo, docente_id AS docenteId, descripcion, activo, fechaCreacion
         FROM GrupoAcademico WHERE id = ?`,
        [id]
      );
      return filas[0] ?? null;
    },

    async listarEstudiantes(grupoId) {
      const [filas] = await pool.execute(
        `SELECT u.id, u.nombres, u.apellidos, u.correoInstitucional AS correo, u.activo,
                ge.fechaAsignacion
         FROM GrupoEstudiante ge
         INNER JOIN Usuario u ON u.id = ge.estudiante_id
         WHERE ge.grupo_id = ?
         ORDER BY u.apellidos, u.nombres`,
        [grupoId]
      );
      return filas;
    },

    async asignarEstudiante(grupoId, estudianteId, fechaAsignacion) {
      await pool.execute(
        `INSERT INTO GrupoEstudiante (grupo_id, estudiante_id, fechaAsignacion)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE fechaAsignacion = VALUES(fechaAsignacion)`,
        [grupoId, estudianteId, fechaAsignacion]
      );
    },

    async retirarEstudiante(grupoId, estudianteId) {
      const [resultado] = await pool.execute(
        `DELETE FROM GrupoEstudiante WHERE grupo_id = ? AND estudiante_id = ?`,
        [grupoId, estudianteId]
      );
      return resultado.affectedRows > 0;
    },

    async idsEstudiantes(grupoId) {
      const [filas] = await pool.execute(
        `SELECT estudiante_id AS id FROM GrupoEstudiante WHERE grupo_id = ?`,
        [grupoId]
      );
      return filas.map((f) => Number(f.id));
    },

    async esEstudiante(usuarioId) {
      const [filas] = await pool.execute(
        `SELECT 1 AS ok
         FROM UsuarioRol ur
         INNER JOIN Rol r ON r.id = ur.rol_id
         WHERE ur.usuario_id = ? AND r.nombre = 'Estudiante'
         LIMIT 1`,
        [usuarioId]
      );
      return filas.length > 0;
    }
  };
}
