import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioAcceso } from '../src/modules/acceso/acceso.repository.js';
import {
  hashearCodigoAutorizacion,
  validarAccesoEstudiante
} from '../src/modules/acceso/codigos.js';

process.env.CODIGO_AUTORIZACION_SECRETO = 'clave-de-prueba-solo-para-tests-0123456789';

/**
 * Pool falso: imita pool.execute() de mysql2 sin conectarse a MySQL.
 * Guarda cada consulta y responde según la tabla que aparece en el SQL.
 */
function crearPoolFalso(respuestas = {}) {
  const consultas = [];
  return {
    consultas,
    async execute(sql, parametros) {
      consultas.push({ sql, parametros });
      for (const [fragmento, filas] of Object.entries(respuestas)) {
        if (sql.includes(fragmento)) return [filas];
      }
      return [[]];
    }
  };
}

const HASH = hashearCodigoAutorizacion('ABCD2345');

const filaConvocatoria = {
  actividad_id: 5,
  estudiante_id: 10,
  codigoAutorizacion: HASH,
  estado: 'Autorizado',
  usuarioId: 10,
  correoInstitucional: 'estudiante.prueba@unihumboldt.edu.co',
  activo: 1, // MySQL devuelve BOOLEAN como 1 o 0
  actividadId: 5,
  fechaInicio: new Date('2026-11-03T14:00:00'),
  fechaFin: new Date('2026-11-03T18:00:00')
};

// ---------- buscarAccesoPorCodigoHash ----------

test('exige un pool de MySQL', () => {
  assert.throws(() => crearRepositorioAcceso(null), TypeError);
});

test('busca la convocatoria por el hash y arma el registro para validar el acceso', async () => {
  const pool = crearPoolFalso({
    'FROM EstudianteAutorizado': [filaConvocatoria],
    'FROM SesionSimulacion': [{ estado: 'En curso', numeroIntento: 1 }]
  });
  const repositorio = crearRepositorioAcceso(pool);

  const registro = await repositorio.buscarAccesoPorCodigoHash(HASH);

  assert.deepEqual(pool.consultas[0].parametros, [HASH]);
  assert.deepEqual(pool.consultas[1].parametros, [5, 10]);
  assert.equal(registro.estudiante.activo, true);
  assert.equal(registro.autorizacion.estado, 'Autorizado');
  assert.equal(registro.sesion.estado, 'En curso');
});

test('el registro del repositorio sirve directamente para validarAccesoEstudiante', async () => {
  const pool = crearPoolFalso({ 'FROM EstudianteAutorizado': [filaConvocatoria] });
  const registro = await crearRepositorioAcceso(pool).buscarAccesoPorCodigoHash(HASH);

  const resultado = validarAccesoEstudiante(
    { correo: 'estudiante.prueba@unihumboldt.edu.co', codigo: 'ABCD2345' },
    registro,
    new Date('2026-11-03T15:00:00')
  );

  assert.deepEqual(resultado, { estudianteId: 10, actividadId: 5 });
});

test('si el código no existe devuelve un registro vacío (y el acceso se rechaza con 401)', async () => {
  const pool = crearPoolFalso();
  const registro = await crearRepositorioAcceso(pool).buscarAccesoPorCodigoHash(HASH);

  assert.equal(registro.autorizacion, null);
  assert.equal(pool.consultas.length, 1);
  assert.throws(
    () => validarAccesoEstudiante({ correo: 'x@unihumboldt.edu.co', codigo: 'ABCD2345' }, registro),
    (error) => error.statusCode === 401
  );
});

test('no consulta la base de datos con un hash mal formado', async () => {
  const pool = crearPoolFalso();
  const repositorio = crearRepositorioAcceso(pool);

  for (const valor of ['ABCD2345', "' OR 1=1 --", '', null]) {
    const registro = await repositorio.buscarAccesoPorCodigoHash(valor);
    assert.equal(registro.autorizacion, null);
  }
  assert.equal(pool.consultas.length, 0);
});

test('sin sesiones previas, la sesión es null', async () => {
  const pool = crearPoolFalso({ 'FROM EstudianteAutorizado': [filaConvocatoria] });
  const registro = await crearRepositorioAcceso(pool).buscarAccesoPorCodigoHash(HASH);
  assert.equal(registro.sesion, null);
});

// ---------- obtenerRolesYPermisos ----------

test('obtiene roles y permisos del usuario desde UsuarioRol y RolPermiso', async () => {
  const pool = crearPoolFalso({
    'JOIN RolPermiso': [{ nombre: 'CREAR_CASOS' }],
    'JOIN Rol r': [{ nombre: 'Docente' }]
  });

  const resultado = await crearRepositorioAcceso(pool).obtenerRolesYPermisos(2);

  assert.deepEqual(resultado, { roles: ['Docente'], permisos: ['CREAR_CASOS'] });
  assert.ok(pool.consultas.every((consulta) => consulta.parametros[0] === 2));
});

test('un usuario sin roles queda sin roles ni permisos', async () => {
  const resultado = await crearRepositorioAcceso(crearPoolFalso()).obtenerRolesYPermisos(99);
  assert.deepEqual(resultado, { roles: [], permisos: [] });
});

test('rechaza un id de usuario inválido sin consultar', async () => {
  const pool = crearPoolFalso();
  await assert.rejects(() => crearRepositorioAcceso(pool).obtenerRolesYPermisos('2'), TypeError);
  await assert.rejects(() => crearRepositorioAcceso(pool).obtenerRolesYPermisos(0), TypeError);
  assert.equal(pool.consultas.length, 0);
});

// ---------- buscarUsuarioPorCorreo ----------

test('busca al usuario por correo normalizado', async () => {
  const pool = crearPoolFalso({
    'FROM Usuario': [{
      id: 2,
      correoInstitucional: 'docente.prueba@unihumboldt.edu.co',
      contrasenaHash: 'scrypt$16384$8$1$sal$hash',
      activo: 0
    }]
  });

  const usuario = await crearRepositorioAcceso(pool)
    .buscarUsuarioPorCorreo('  Docente.Prueba@UNIHUMBOLDT.edu.co ');

  assert.deepEqual(pool.consultas[0].parametros, ['docente.prueba@unihumboldt.edu.co']);
  assert.equal(usuario.id, 2);
  assert.equal(usuario.activo, false);
});

test('devuelve null si el correo no existe o viene vacío', async () => {
  const pool = crearPoolFalso();
  const repositorio = crearRepositorioAcceso(pool);
  assert.equal(await repositorio.buscarUsuarioPorCorreo('nadie@unihumboldt.edu.co'), null);
  assert.equal(await repositorio.buscarUsuarioPorCorreo('   '), null);
  assert.equal(pool.consultas.length, 1);
});

// ---------- Seguridad de las consultas ----------

test('todas las consultas usan parámetros (?) y no concatenan datos', async () => {
  const pool = crearPoolFalso({ 'FROM EstudianteAutorizado': [filaConvocatoria] });
  const repositorio = crearRepositorioAcceso(pool);

  await repositorio.buscarAccesoPorCodigoHash(HASH);
  await repositorio.obtenerRolesYPermisos(2);
  await repositorio.buscarUsuarioPorCorreo('docente.prueba@unihumboldt.edu.co');

  for (const { sql } of pool.consultas) {
    assert.ok(sql.includes('?'));
    assert.ok(!sql.includes(HASH));
    assert.ok(!sql.includes('unihumboldt'));
  }
});