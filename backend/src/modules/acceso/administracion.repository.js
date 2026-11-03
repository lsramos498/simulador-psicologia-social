/**
 * Repositorio MySQL de administración (Sofía Gallego — acceso y permisos).
 * RF-03: el administrador crea docentes y gestiona roles y permisos.
 *
 * A diferencia de acceso.repository.js (solo lectura), este archivo escribe.
 * Mismo patrón: recibe el pool desde afuera para poder probarlo sin MySQL.
 */

export function crearRepositorioAdministracion(pool) {
  if (!pool || typeof pool.execute !== 'function' || typeof pool.getConnection !== 'function') {
    throw new TypeError('Se requiere un pool de MySQL');
  }

  async function buscarPorNombre(tabla, nombre) {
    const [filas] = await pool.execute(`SELECT id, nombre FROM ${tabla} WHERE nombre = ? LIMIT 1`, [nombre]);
    return filas[0] ?? null;
  }

  return {
    obtenerRolPorNombre: (nombre) => buscarPorNombre('Rol', nombre),
    obtenerPermisoPorNombre: (nombre) => buscarPorNombre('Permiso', nombre),

    async existeCorreo(correo) {
      const [filas] = await pool.execute(
        'SELECT id FROM Usuario WHERE correoInstitucional = ? LIMIT 1',
        [correo]
      );
      return filas.length > 0;
    },

    async existeUsuario(usuarioId) {
      const [filas] = await pool.execute('SELECT id FROM Usuario WHERE id = ? LIMIT 1', [usuarioId]);
      return filas.length > 0;
    },

    /** Crea el usuario y le asigna su rol en una sola transacción. */
    async crearUsuarioConRol({ nombres, apellidos, correo, contrasenaHash, rolId, asignadoPor }) {
      const conexion = await pool.getConnection();
      try {
        await conexion.beginTransaction();
        const [resultado] = await conexion.execute(
          `INSERT INTO Usuario
             (nombres, apellidos, correoInstitucional, contrasenaHash, activo, fechaCreacion)
           VALUES (?, ?, ?, ?, TRUE, NOW())`,
          [nombres, apellidos, correo, contrasenaHash]
        );
        await conexion.execute(
          `INSERT INTO UsuarioRol (usuario_id, rol_id, asignadoPor_id, fechaAsignacion)
           VALUES (?, ?, ?, NOW())`,
          [resultado.insertId, rolId, asignadoPor]
        );
        await conexion.commit();
        return resultado.insertId;
      } catch (error) {
        await conexion.rollback();
        throw error;
      } finally {
        conexion.release();
      }
    },

    async asignarRol(usuarioId, rolId, asignadoPor) {
      // Si ya lo tenía, no cambia nada.
      await pool.execute(
        `INSERT INTO UsuarioRol (usuario_id, rol_id, asignadoPor_id, fechaAsignacion)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE usuario_id = usuario_id`,
        [usuarioId, rolId, asignadoPor]
      );
    },

    async quitarRol(usuarioId, rolId) {
      const [resultado] = await pool.execute(
        'DELETE FROM UsuarioRol WHERE usuario_id = ? AND rol_id = ?',
        [usuarioId, rolId]
      );
      return resultado.affectedRows > 0;
    },

    async asignarPermisoARol(rolId, permisoId) {
      await pool.execute(
        `INSERT INTO RolPermiso (rol_id, permiso_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE rol_id = rol_id`,
        [rolId, permisoId]
      );
    },

    async quitarPermisoDeRol(rolId, permisoId) {
      const [resultado] = await pool.execute(
        'DELETE FROM RolPermiso WHERE rol_id = ? AND permiso_id = ?',
        [rolId, permisoId]
      );
      return resultado.affectedRows > 0;
    },

    async listarRolesConPermisos() {
      const [filas] = await pool.execute(`
        SELECT r.nombre AS rol, p.nombre AS permiso
        FROM Rol r
        LEFT JOIN RolPermiso rp ON rp.rol_id = r.id
        LEFT JOIN Permiso p ON p.id = rp.permiso_id
        ORDER BY r.nombre, p.nombre
      `);
      const roles = new Map();
      for (const { rol, permiso } of filas) {
        if (!roles.has(rol)) roles.set(rol, []);
        if (permiso) roles.get(rol).push(permiso);
      }
      return [...roles].map(([nombre, permisos]) => ({ nombre, permisos }));
    },

    async listarPermisos() {
      const [filas] = await pool.execute('SELECT nombre, descripcion FROM Permiso ORDER BY nombre');
      return filas;
    }
  };
}
