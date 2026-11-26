import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioAdministracion } from '../src/modules/acceso/administracion.repository.js';

/**
 * Pool falso: guarda las consultas y simula una conexión con transacción.
 */
function crearPoolFalso({ fallaEn = null, filas = [], affectedRows = 1 } = {}) {
  const consultas = [];
  const estado = { begin: false, commit: false, rollback: false, release: false };
  async function execute(sql, parametros = []) {
    consultas.push({ sql, parametros });
    if (fallaEn && sql.includes(fallaEn)) throw new Error('falla simulada');
    // \b: 'Usuario' seguido de espacio o salto de línea, pero no 'UsuarioRol'.
    if (/^INSERT INTO Usuario\b/.test(sql.trim())) return [{ insertId: 7 }];
    if (sql.trim().startsWith('DELETE')) return [{ affectedRows }];
    if (sql.trim().startsWith('INSERT')) return [{ affectedRows: 1 }];
    return [filas];
  }
  return {
    consultas,
    estado,
    execute,
    async getConnection() {
      return {
        execute,
        async beginTransaction() { estado.begin = true; },
        async commit() { estado.commit = true; },
        async rollback() { estado.rollback = true; },
        release() { estado.release = true; }
      };
    }
  };
}

const NUEVO = {
  nombres: 'Ana', apellidos: 'Prueba', correo: 'ana.prueba@unihumboldt.edu.co',
  contrasenaHash: 'scrypt$hash-ficticio', rolId: 2, asignadoPor: 1
};

test('exige un pool de MySQL con conexiones', () => {
  assert.throws(() => crearRepositorioAdministracion(null), TypeError);
  assert.throws(() => crearRepositorioAdministracion({ execute() {} }), TypeError);
});

test('crea el usuario y su rol dentro de una transacción', async () => {
  const pool = crearPoolFalso();
  const id = await crearRepositorioAdministracion(pool).crearUsuarioConRol(NUEVO);

  assert.equal(id, 7);
  assert.deepEqual(pool.estado, { begin: true, commit: true, rollback: false, release: true });
  assert.deepEqual(pool.consultas[1].parametros, [7, 2, 1]);
});

test('si falla la asignación del rol, deshace la creación del usuario', async () => {
  const pool = crearPoolFalso({ fallaEn: 'INSERT INTO UsuarioRol' });
  await assert.rejects(() => crearRepositorioAdministracion(pool).crearUsuarioConRol(NUEVO), /falla simulada/);
  assert.equal(pool.estado.rollback, true);
  assert.equal(pool.estado.commit, false);
  assert.equal(pool.estado.release, true);
});

test('quitarRol y quitarPermisoDeRol indican si había algo que quitar', async () => {
  assert.equal(await crearRepositorioAdministracion(crearPoolFalso({ affectedRows: 1 })).quitarRol(2, 2), true);
  assert.equal(await crearRepositorioAdministracion(crearPoolFalso({ affectedRows: 0 })).quitarRol(2, 2), false);
  assert.equal(await crearRepositorioAdministracion(crearPoolFalso({ affectedRows: 0 })).quitarPermisoDeRol(2, 1), false);
});

test('agrupa los permisos por rol e incluye roles sin permisos', async () => {
  const pool = crearPoolFalso({
    filas: [
      { rol: 'Administrador', permiso: null },
      { rol: 'Docente', permiso: 'CREAR_CASOS' },
      { rol: 'Estudiante', permiso: null }
    ]
  });
  assert.deepEqual(await crearRepositorioAdministracion(pool).listarRolesConPermisos(), [
    { nombre: 'Administrador', permisos: [] },
    { nombre: 'Docente', permisos: ['CREAR_CASOS'] },
    { nombre: 'Estudiante', permisos: [] }
  ]);
});

test('todas las escrituras usan parámetros (?) y nombres de tabla del esquema', async () => {
  const pool = crearPoolFalso();
  const repo = crearRepositorioAdministracion(pool);
  await repo.crearUsuarioConRol(NUEVO);
  await repo.asignarRol(2, 1, 1);
  await repo.quitarRol(2, 1);
  await repo.asignarPermisoARol(2, 1);
  await repo.quitarPermisoDeRol(2, 1);
  await repo.existeCorreo(NUEVO.correo);

  for (const { sql } of pool.consultas) {
    assert.ok(sql.includes('?'));
    assert.ok(!sql.includes(NUEVO.correo));
  }
  assert.ok(pool.consultas.some(({ sql }) => sql.includes('INSERT INTO RolPermiso')));
  assert.ok(pool.consultas.some(({ sql }) => sql.includes('DELETE FROM UsuarioRol')));
});
