import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISOS_INICIALES,
  ROLES_INICIALES,
  ejecutarSeedInicial
} from '../src/modules/acceso/seed.js';
import { verificarContrasena } from '../src/modules/acceso/contrasenas.js';

// Datos ficticios solo para pruebas
const ADMIN = {
  correo: '  Admin.Prueba@unihumboldt.edu.co ',
  nombres: 'Admin',
  apellidos: 'Prueba',
  contrasena: 'Contrasena-de-prueba-123'
};

/**
 * Conexión falsa: imita una conexión de mysql2 en memoria.
 * Guarda roles, permisos, usuarios y asignaciones para poder revisarlos.
 */
function crearConexionFalsa({ usuarioExistente = null, fallaEn = null } = {}) {
  const bd = { Rol: [], Permiso: [], Usuario: [], UsuarioRol: [], RolPermiso: [] };
  if (usuarioExistente) bd.Usuario.push(usuarioExistente);
  const estado = { transaccion: false, commit: false, rollback: false, consultas: [] };

  return {
    bd,
    estado,
    async beginTransaction() { estado.transaccion = true; },
    async commit() { estado.commit = true; },
    async rollback() { estado.rollback = true; },
    async execute(sql, parametros) {
      estado.consultas.push(sql);
      if (fallaEn && sql.includes(fallaEn)) throw new Error('falla simulada');

      for (const tabla of ['Rol', 'Permiso']) {
        if (sql.includes(`INSERT INTO ${tabla} `)) {
          const [nombre, descripcion] = parametros;
          if (!bd[tabla].some((fila) => fila.nombre === nombre)) {
            bd[tabla].push({ id: bd[tabla].length + 1, nombre, descripcion });
          }
          return [{}];
        }
        if (sql.includes(`FROM ${tabla} WHERE`)) {
          return [bd[tabla].filter((fila) => fila.nombre === parametros[0])];
        }
      }
      // UsuarioRol va primero: 'INSERT INTO Usuario' también aparece en 'INSERT INTO UsuarioRol'.
      if (sql.includes('INSERT INTO UsuarioRol')) {
        const [usuario_id, rol_id] = parametros;
        if (!bd.UsuarioRol.some((f) => f.usuario_id === usuario_id && f.rol_id === rol_id)) {
          bd.UsuarioRol.push({ usuario_id, rol_id });
        }
        return [{}];
      }
      if (sql.includes('FROM Usuario WHERE')) {
        return [bd.Usuario.filter((fila) => fila.correoInstitucional === parametros[0])];
      }
      if (sql.includes('INSERT INTO Usuario')) {
        const [nombres, apellidos, correoInstitucional, contrasenaHash] = parametros;
        const id = bd.Usuario.length + 1;
        bd.Usuario.push({ id, nombres, apellidos, correoInstitucional, contrasenaHash });
        return [{ insertId: id }];
      }
      return [[]];
    }
  };
}

test('crea los 3 roles y el catálogo inicial de permisos', async () => {
  const conexion = crearConexionFalsa();
  await ejecutarSeedInicial(conexion, ADMIN);

  assert.deepEqual(conexion.bd.Rol.map((r) => r.nombre), ['Administrador', 'Docente', 'Estudiante']);
  assert.deepEqual(conexion.bd.Permiso.map((p) => p.nombre), ['CREAR_CASOS']);
  assert.equal(ROLES_INICIALES.length, 3);
  assert.equal(PERMISOS_INICIALES.length, 1);
});

test('crea el administrador con la contraseña hasheada y el rol Administrador', async () => {
  const conexion = crearConexionFalsa();
  const resultado = await ejecutarSeedInicial(conexion, ADMIN);

  const [admin] = conexion.bd.Usuario;
  assert.equal(admin.correoInstitucional, 'admin.prueba@unihumboldt.edu.co');
  assert.notEqual(admin.contrasenaHash, ADMIN.contrasena);
  assert.equal(await verificarContrasena(ADMIN.contrasena, admin.contrasenaHash), true);

  const rolAdmin = conexion.bd.Rol.find((r) => r.nombre === 'Administrador');
  assert.deepEqual(conexion.bd.UsuarioRol, [{ usuario_id: admin.id, rol_id: rolAdmin.id }]);
  assert.equal(resultado.adminCreado, true);
});

test('no asigna permisos a los roles (eso lo hace después el administrador)', async () => {
  const conexion = crearConexionFalsa();
  await ejecutarSeedInicial(conexion, ADMIN);

  assert.equal(conexion.bd.RolPermiso.length, 0);
  assert.ok(conexion.estado.consultas.every((sql) => !sql.includes('RolPermiso')));
});

test('se puede ejecutar dos veces sin duplicar nada', async () => {
  const conexion = crearConexionFalsa();
  await ejecutarSeedInicial(conexion, ADMIN);
  const segunda = await ejecutarSeedInicial(conexion, ADMIN);

  assert.equal(conexion.bd.Rol.length, 3);
  assert.equal(conexion.bd.Permiso.length, 1);
  assert.equal(conexion.bd.Usuario.length, 1);
  assert.equal(conexion.bd.UsuarioRol.length, 1);
  assert.equal(segunda.adminCreado, false);
});

test('si el administrador ya existe, no cambia su contraseña', async () => {
  const existente = {
    id: 7,
    correoInstitucional: 'admin.prueba@unihumboldt.edu.co',
    contrasenaHash: 'hash-original'
  };
  const conexion = crearConexionFalsa({ usuarioExistente: existente });
  const resultado = await ejecutarSeedInicial(conexion, ADMIN);

  assert.equal(conexion.bd.Usuario.length, 1);
  assert.equal(conexion.bd.Usuario[0].contrasenaHash, 'hash-original');
  assert.equal(resultado.adminId, 7);
  assert.ok(conexion.bd.UsuarioRol.some((f) => f.usuario_id === 7));
});

test('trabaja en una transacción y hace commit al terminar', async () => {
  const conexion = crearConexionFalsa();
  await ejecutarSeedInicial(conexion, ADMIN);
  assert.equal(conexion.estado.transaccion, true);
  assert.equal(conexion.estado.commit, true);
  assert.equal(conexion.estado.rollback, false);
});

test('si algo falla, deshace todo (rollback)', async () => {
  const conexion = crearConexionFalsa({ fallaEn: 'INSERT INTO UsuarioRol' });
  await assert.rejects(() => ejecutarSeedInicial(conexion, ADMIN), /falla simulada/);
  assert.equal(conexion.estado.rollback, true);
  assert.equal(conexion.estado.commit, false);
});

test('exige todos los datos del administrador antes de tocar la base de datos', async () => {
  const conexion = crearConexionFalsa();
  await assert.rejects(
    () => ejecutarSeedInicial(conexion, { ...ADMIN, contrasena: '' }),
    /contrasena/
  );
  await assert.rejects(
    () => ejecutarSeedInicial(conexion, { correo: 'x@y.co' }),
    /nombres, apellidos, contrasena/
  );
  await assert.rejects(
    () => ejecutarSeedInicial(conexion, { ...ADMIN, correo: 'sin-arroba' }),
    /no es válido/
  );
  assert.equal(conexion.estado.transaccion, false);
  assert.equal(conexion.estado.consultas.length, 0);
});