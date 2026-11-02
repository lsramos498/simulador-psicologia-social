/**
 * Repositorio MySQL del módulo de acceso (Sofía Gallego — acceso y permisos).
 * Solo lee datos; las reglas de negocio están en codigos.js, autorizacion.js
 * y contrasenas.js.
 *
 * El pool se recibe desde config/database.js (mismo patrón que el módulo de
 * participación): este archivo no crea conexiones propias, y así se puede
 * probar con un pool falso sin necesidad de MySQL.
 *
 * Los nombres de tablas se escriben igual que en schema.sql (Usuario, Rol...)
 * para que funcionen en Windows, macOS y Linux.
 */

const HASH_CODIGO_VALIDO = /^[0-9a-f]{64}$/;

function validarId(id) {
  if (!Number.isInteger(id) || id < 1) {
    throw new TypeError('Se requiere un id de usuario válido');
  }
}

export function crearRepositorioAcceso(pool) {
  if (!pool || typeof pool.execute !== 'function') {
    throw new TypeError('Se requiere un pool de MySQL');
  }

  return {
    /**
     * RF-01 / RF-20: busca la convocatoria por el hash del código.
     * Devuelve el "registro" que espera validarAccesoEstudiante().
     */
    async buscarAccesoPorCodigoHash(codigoHash) {
      const vacio = { autorizacion: null, estudiante: null, actividad: null, sesion: null };

      if (typeof codigoHash !== 'string' || !HASH_CODIGO_VALIDO.test(codigoHash)) {
        return vacio;
      }

      const [filas] = await pool.execute(`
        SELECT ea.actividad_id, ea.estudiante_id, ea.codigoAutorizacion, ea.estado,
               u.id AS usuarioId, u.correoInstitucional, u.activo,
               ap.id AS actividadId, ap.fechaInicio, ap.fechaFin
        FROM EstudianteAutorizado ea
        JOIN Usuario u ON u.id = ea.estudiante_id
        JOIN ActividadProgramada ap ON ap.id = ea.actividad_id
        WHERE ea.codigoAutorizacion = ?
        LIMIT 1
      `, [codigoHash]);

      const fila = filas[0];
      if (!fila) {
        return vacio;
      }

      // Último intento del estudiante en esa actividad (si ya empezó alguno).
      const [sesiones] = await pool.execute(`
        SELECT estado, numeroIntento
        FROM SesionSimulacion
        WHERE actividad_id = ? AND estudiante_id = ?
        ORDER BY numeroIntento DESC
        LIMIT 1
      `, [fila.actividad_id, fila.estudiante_id]);

      return {
        autorizacion: {
          actividad_id: fila.actividad_id,
          estudiante_id: fila.estudiante_id,
          codigoAutorizacion: fila.codigoAutorizacion,
          estado: fila.estado
        },
        estudiante: {
          id: fila.usuarioId,
          correoInstitucional: fila.correoInstitucional,
          activo: Boolean(fila.activo)
        },
        actividad: {
          id: fila.actividadId,
          fechaInicio: fila.fechaInicio,
          fechaFin: fila.fechaFin
        },
        sesion: sesiones[0] ?? null
      };
    },

    /**
     * RF-02: roles del usuario (UsuarioRol) y permisos de esos roles (RolPermiso).
     * Esta es la "fuente confiable del servidor"; nunca lo que envíe el cliente.
     */
    async obtenerRolesYPermisos(usuarioId) {
      validarId(usuarioId);

      const [roles] = await pool.execute(`
        SELECT r.nombre
        FROM UsuarioRol ur
        JOIN Rol r ON r.id = ur.rol_id
        WHERE ur.usuario_id = ?
        ORDER BY r.nombre
      `, [usuarioId]);

      const [permisos] = await pool.execute(`
        SELECT DISTINCT p.nombre
        FROM UsuarioRol ur
        JOIN RolPermiso rp ON rp.rol_id = ur.rol_id
        JOIN Permiso p ON p.id = rp.permiso_id
        WHERE ur.usuario_id = ?
        ORDER BY p.nombre
      `, [usuarioId]);

      return {
        roles: roles.map((fila) => fila.nombre),
        permisos: permisos.map((fila) => fila.nombre)
      };
    },

    /**
     * Ingreso de docentes y administradores: datos mínimos para verificar
     * la contraseña. Devuelve null si el correo no existe.
     */
    async buscarUsuarioPorCorreo(correo) {
      const normalizado = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
      if (!normalizado) {
        return null;
      }

      const [filas] = await pool.execute(`
        SELECT id, correoInstitucional, contrasenaHash, activo
        FROM Usuario
        WHERE correoInstitucional = ?
        LIMIT 1
      `, [normalizado]);

      const fila = filas[0];
      if (!fila) {
        return null;
      }

      return {
        id: fila.id,
        correoInstitucional: fila.correoInstitucional,
        contrasenaHash: fila.contrasenaHash,
        activo: Boolean(fila.activo)
      };
    }
  };
}