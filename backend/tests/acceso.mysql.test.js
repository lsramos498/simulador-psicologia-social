import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/**
 * Prueba de integración con MySQL REAL (Sofía Gallego — acceso y permisos).
 *
 * No se ejecuta con `npm test` normal. Para activarla (Windows, en backend):
 *   set LUMINA_MYSQL_TEST=1
 *   node --test tests/acceso.mysql.test.js
 *
 * Usa la base configurada en backend/.env, pero TODO ocurre dentro de una
 * transacción que se deshace al final (rollback): no deja datos guardados.
 * Los correos de prueba terminan en @prueba.invalid y llevan un id aleatorio.
 */

test('MySQL real: seed, administración, ingreso de docente y de estudiante', {
  skip: process.env.LUMINA_MYSQL_TEST !== '1' && 'Se activa con LUMINA_MYSQL_TEST=1'
}, async (t) => {
  await import('dotenv/config');
  const { pool } = await import('../src/config/database.js');
  const { ejecutarSeedInicial } = await import('../src/modules/acceso/seed.js');
  const { crearRepositorioAdministracion } = await import('../src/modules/acceso/administracion.repository.js');
  const { crearServicioAdministracion } = await import('../src/modules/acceso/administracion.service.js');
  const { crearRepositorioAcceso } = await import('../src/modules/acceso/acceso.repository.js');
  const { crearServicioAcceso } = await import('../src/modules/acceso/acceso.service.js');
  const { crearCodigoAutorizacion } = await import('../src/modules/acceso/codigos.js');
  const { verificarToken } = await import('../src/modules/acceso/tokens.js');

  // Una sola conexión con una transacción abierta durante toda la prueba.
  const conexion = await pool.getConnection();
  await conexion.beginTransaction();
  t.after(async () => {
    try {
      await conexion.rollback(); // deshace todo lo que hizo la prueba
    } finally {
      conexion.release();
      await pool.end();
    }
  });

  // "Pool" que envía todo a esa conexión. Las transacciones internas del código
  // se vuelven no-ops para no cerrar (commit) la transacción de la prueba.
  const ejecutar = (sql, parametros) => conexion.execute(sql, parametros);
  const conexionInterna = {
    execute: ejecutar,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {}
  };
  const poolEnTransaccion = { execute: ejecutar, getConnection: async () => conexionInterna };

  const etiqueta = randomUUID().slice(0, 8);
  const contrasenaDocente = `Prueba-${randomUUID()}`;
  let adminId;
  let docenteId;

  const administracion = crearServicioAdministracion(crearRepositorioAdministracion(poolEnTransaccion));
  const repositorioAcceso = crearRepositorioAcceso(poolEnTransaccion);
  const acceso = crearServicioAcceso(repositorioAcceso);

  await t.test('el seed crea los roles, el permiso y un administrador', async () => {
    const resultado = await ejecutarSeedInicial(conexionInterna, {
      correo: `admin-${etiqueta}@prueba.invalid`,
      nombres: 'Admin',
      apellidos: 'Prueba',
      contrasena: `Prueba-${randomUUID()}`
    });
    assert.deepEqual(resultado.roles, ['Administrador', 'Docente', 'Estudiante']);
    assert.equal(resultado.adminCreado, true);
    adminId = resultado.adminId;
  });

  await t.test('el administrador crea un docente y le da CREAR_CASOS al rol Docente', async () => {
    const docente = await administracion.crearDocente({
      nombres: 'Docente',
      apellidos: 'Prueba',
      correo: `docente-${etiqueta}@prueba.invalid`,
      contrasena: contrasenaDocente
    }, adminId);
    docenteId = docente.id;

    await administracion.asignarPermiso('Docente', 'CREAR_CASOS');
    const roles = await administracion.listarRoles();
    assert.ok(roles.find((r) => r.nombre === 'Docente').permisos.includes('CREAR_CASOS'));
  });

  await t.test('el docente ingresa con su contraseña y su token trae CREAR_CASOS', async () => {
    const { token } = await acceso.ingresarConContrasena({
      correo: `docente-${etiqueta}@prueba.invalid`,
      contrasena: contrasenaDocente
    });
    const usuario = verificarToken(token);
    assert.equal(usuario.id, docenteId);
    assert.ok(usuario.roles.includes('Docente'));
    assert.ok(usuario.permisos.includes('CREAR_CASOS'));

    await assert.rejects(
      acceso.ingresarConContrasena({ correo: `docente-${etiqueta}@prueba.invalid`, contrasena: 'incorrecta' }),
      (error) => error.statusCode === 401
    );
  });

  await t.test('el estudiante ingresa con correo y OTP de sesión', async () => {
    const correoEstudiante = `estudiante-${etiqueta}@prueba.invalid`;

    const [estudiante] = await ejecutar(
      `INSERT INTO Usuario (nombres, apellidos, correoInstitucional, contrasenaHash, activo, fechaCreacion)
       VALUES ('Estudiante', 'Prueba', ?, 'fixture-sin-contrasena', TRUE, NOW())`,
      [correoEstudiante]
    );
    await administracion.asignarRol(estudiante.insertId, 'Estudiante', adminId);

    // Flujo actual: OTP de sesión (CodigoLoginEstudiante), no código de actividad.
    const { codigo, codigoHash } = crearCodigoAutorizacion();
    const expiraEn = new Date(Date.now() + 10 * 60_000);
    await repositorioAcceso.guardarCodigoLogin(
      estudiante.insertId,
      codigoHash,
      expiraEn,
      new Date()
    );

    const { token } = await acceso.ingresarEstudiante({ correo: correoEstudiante, codigo });
    const usuario = verificarToken(token);
    assert.equal(usuario.id, estudiante.insertId);
    assert.deepEqual(usuario.roles, ['Estudiante']);
    assert.equal(usuario.actividadId, undefined);

    await assert.rejects(
      acceso.ingresarEstudiante({ correo: correoEstudiante, codigo: 'ZZZZ9999' }),
      (error) => error.statusCode === 401
    );
    await assert.rejects(
      acceso.ingresarConContrasena({ correo: correoEstudiante, contrasena: 'cualquiera' }),
      (error) => error.statusCode === 401
    );
  });
});
