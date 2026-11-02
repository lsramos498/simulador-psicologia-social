import { ROLES } from './autorizacion.js';
import { hashearContrasena } from './contrasenas.js';

/**
 * Datos iniciales del sistema (Sofía Gallego — acceso y permisos).
 * Decisión del equipo: el seed crea los 3 roles, el catálogo inicial de
 * permisos y el primer administrador. Después, el administrador gestiona
 * la asignación de permisos a los roles (por eso aquí NO se llena RolPermiso).
 *
 * Se puede ejecutar varias veces sin duplicar datos: si algo ya existe,
 * se conserva tal cual (por ejemplo, no cambia la contraseña del admin).
 */

export const ROLES_INICIALES = Object.freeze([
  { nombre: ROLES.ADMINISTRADOR, descripcion: 'Crea docentes y gestiona roles y permisos (RF-03)' },
  { nombre: ROLES.DOCENTE, descripcion: 'Diseña, programa y evalúa casos' },
  { nombre: ROLES.ESTUDIANTE, descripcion: 'Participa en los casos con su código de autorización' }
]);

// Catálogo inicial: solo los permisos que ya están confirmados en los requisitos.
// Para agregar uno nuevo basta con añadir una línea cuando el equipo lo acuerde.
export const PERMISOS_INICIALES = Object.freeze([
  { nombre: 'CREAR_CASOS', descripcion: 'Crear casos de estudio (RF-02)' }
]);

function validarAdministrador(admin) {
  const faltantes = ['correo', 'nombres', 'apellidos', 'contrasena']
    .filter((campo) => typeof admin?.[campo] !== 'string' || admin[campo].trim() === '');

  if (faltantes.length > 0) {
    throw new Error(`Faltan datos del administrador inicial: ${faltantes.join(', ')}`);
  }

  if (!admin.correo.includes('@')) {
    throw new Error('El correo del administrador inicial no es válido');
  }
}

async function asegurarFila(conexion, tabla, { nombre, descripcion }) {
  // ON DUPLICATE KEY no cambia nada si el nombre ya existe (clave única).
  await conexion.execute(
    `INSERT INTO ${tabla} (nombre, descripcion) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE nombre = nombre`,
    [nombre, descripcion]
  );
  const [filas] = await conexion.execute(`SELECT id FROM ${tabla} WHERE nombre = ?`, [nombre]);
  return filas[0].id;
}

/**
 * Ejecuta el seed dentro de una transacción: o se crea todo, o nada.
 * @param conexion  Conexión de mysql2 (pool.getConnection()).
 * @param admin     { correo, nombres, apellidos, contrasena } desde el .env.
 */
export async function ejecutarSeedInicial(conexion, admin) {
  validarAdministrador(admin);
  const correo = admin.correo.trim().toLowerCase();

  await conexion.beginTransaction();
  try {
    const idsRoles = {};
    for (const rol of ROLES_INICIALES) {
      idsRoles[rol.nombre] = await asegurarFila(conexion, 'Rol', rol);
    }

    for (const permiso of PERMISOS_INICIALES) {
      await asegurarFila(conexion, 'Permiso', permiso);
    }

    const [existentes] = await conexion.execute(
      'SELECT id FROM Usuario WHERE correoInstitucional = ?',
      [correo]
    );

    let adminId;
    let adminCreado = false;

    if (existentes.length > 0) {
      adminId = existentes[0].id; // ya existía: no se toca su contraseña
    } else {
      const contrasenaHash = await hashearContrasena(admin.contrasena);
      const [resultado] = await conexion.execute(
        `INSERT INTO Usuario
           (nombres, apellidos, correoInstitucional, contrasenaHash, activo, fechaCreacion)
         VALUES (?, ?, ?, ?, TRUE, NOW())`,
        [admin.nombres.trim(), admin.apellidos.trim(), correo, contrasenaHash]
      );
      adminId = resultado.insertId;
      adminCreado = true;
    }

    await conexion.execute(
      `INSERT INTO UsuarioRol (usuario_id, rol_id, asignadoPor_id, fechaAsignacion)
       VALUES (?, ?, NULL, NOW())
       ON DUPLICATE KEY UPDATE usuario_id = usuario_id`,
      [adminId, idsRoles[ROLES.ADMINISTRADOR]]
    );

    await conexion.commit();

    return {
      roles: ROLES_INICIALES.map((rol) => rol.nombre),
      permisos: PERMISOS_INICIALES.map((permiso) => permiso.nombre),
      adminId,
      adminCreado
    };
  } catch (error) {
    await conexion.rollback();
    throw error;
  }
}