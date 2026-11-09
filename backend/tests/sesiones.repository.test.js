
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  crearRepositorioSesiones
} from '../src/modules/sesiones/sesiones.repository.js';

function crearPoolSimulado() {
  const datos = {
    consultas: [],
    commit: 0,
    rollback: 0,
    liberaciones: 0,
    errorConsulta: null
  };

  const conexion = {
    async beginTransaction() {},

    async commit() {
      datos.commit++;
    },

    async rollback() {
      datos.rollback++;
    },

    release() {
      datos.liberaciones++;
    },

    async execute(sql, parametros) {
      datos.consultas.push({ sql, parametros });

      if (datos.errorConsulta) {
        throw datos.errorConsulta;
      }

      if (sql.includes('FROM ActividadProgramada')) {
        return [[{
          id: 1,
          docente_id: 10,
          estado: 'Iniciada'
        }]];
      }

      if (sql.includes('FROM EstudianteAutorizado')) {
        return [[{
          id: 1,
          actividad_id: 1,
          estudiante_id: 20,
          estado: 'Autorizado'
        }]];
      }

      if (sql.includes('FROM SesionSimulacion')) {
        return [[{
          id: 5,
          actividad_id: 1,
          estudiante_id: 20,
          numeroIntento: 1,
          estado: 'En curso',
          inicio: new Date('2026-11-07T14:00:00.000Z'),
          fin: null,
          segundosConsumidos: 0,
          motivoCierre: null
        }]];
      }

      if (sql.includes('INSERT INTO SesionSimulacion')) {
        return [{ insertId: 15, affectedRows: 1 }];
      }

      if (sql.includes('UPDATE SesionSimulacion')) {
        return [{ affectedRows: 1 }];
      }

      return [[], []];
    }
  };

  return {
    datos,
    pool: {
      async getConnection() {
        return conexion;
      }
    }
  };
}

describe('Repositorio de sesiones', () => {
  test('rechaza un pool incompleto', () => {
    assert.throws(
      () => crearRepositorioSesiones(null),
      /conexión a la base de datos/
    );
  });

  test('confirma y libera una transacción exitosa', async () => {
    const { pool, datos } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const resultado = await repositorio.enTransaccion(
      async () => 'correcto'
    );

    assert.equal(resultado, 'correcto');
    assert.equal(datos.commit, 1);
    assert.equal(datos.rollback, 0);
    assert.equal(datos.liberaciones, 1);
  });

  test('revierte y libera la conexión cuando ocurre un error', async () => {
    const { pool, datos } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    await assert.rejects(
      repositorio.enTransaccion(async () => {
        throw new Error('Error de prueba');
      }),
      /Error de prueba/
    );

    assert.equal(datos.rollback, 1);
    assert.equal(datos.commit, 0);
    assert.equal(datos.liberaciones, 1);
  });

  test('consulta la actividad utilizando FOR UPDATE', async () => {
    const { pool, datos } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const actividad = await repositorio.enTransaccion(
      (conexion) => repositorio.obtenerActividad(conexion, 1)
    );

    assert.equal(actividad.id, 1);
    assert.equal(actividad.estado, 'Iniciada');
    assert.match(datos.consultas[0].sql, /FOR UPDATE/);
    assert.deepEqual(datos.consultas[0].parametros, [1]);
  });

  test('consulta la autorización del estudiante', async () => {
    const { pool } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const autorizacion = await repositorio.enTransaccion(
      (conexion) => repositorio.obtenerAutorizacion(conexion, 1, 20)
    );

    assert.equal(autorizacion.estado, 'Autorizado');
    assert.equal(autorizacion.estudiante_id, 20);
  });

  test('consulta la última sesión del estudiante', async () => {
    const { pool } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const sesion = await repositorio.enTransaccion(
      (conexion) => repositorio.obtenerUltimaSesion(conexion, 1, 20)
    );

    assert.equal(sesion.id, 5);
    assert.equal(sesion.estado, 'En curso');
  });

  test('consulta una sesión individual por su identificador', async () => {
    const { pool } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const sesion = await repositorio.enTransaccion(
      (conexion) => repositorio.obtenerSesionPorId(conexion, 5)
    );

    assert.equal(sesion.id, 5);
    assert.equal(sesion.estudiante_id, 20);
  });

  test('inserta una sesión y devuelve su identificador', async () => {
    const { pool } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const sesion = {
      actividadId: 1,
      estudianteId: 20,
      numeroIntento: 1,
      estado: 'En curso',
      inicio: new Date('2026-11-07T14:00:00.000Z'),
      fin: null,
      segundosConsumidos: 0,
      motivoCierre: null
    };

    const resultado = await repositorio.enTransaccion(
      (conexion) => repositorio.insertarSesion(conexion, sesion)
    );

    assert.equal(resultado.id, 15);
    assert.equal(resultado.estado, 'En curso');
  });

  test('actualiza una sesión existente', async () => {
    const { pool } = crearPoolSimulado();
    const repositorio = crearRepositorioSesiones(pool);

    const sesion = {
      id: 5,
      estado: 'Finalizado',
      inicio: new Date('2026-11-07T14:00:00.000Z'),
      fin: new Date('2026-11-07T14:30:00.000Z'),
      segundosConsumidos: 1800,
      motivoCierre: 'Finalizacion'
    };

    const resultado = await repositorio.enTransaccion(
      (conexion) => repositorio.actualizarSesion(conexion, sesion)
    );

    assert.equal(resultado.estado, 'Finalizado');
  });

  test('rechaza una actualización que no afecta ninguna sesión', async () => {
    const { pool } = crearPoolSimulado();

    const repositorio = crearRepositorioSesiones({
      async getConnection() {
        const conexion = await pool.getConnection();

        conexion.execute = async () => [{ affectedRows: 0 }];

        return conexion;
      }
    });

    await assert.rejects(
      repositorio.enTransaccion(
        (conexion) => repositorio.actualizarSesion(conexion, {
          id: 99,
          estado: 'Finalizado',
          inicio: new Date(),
          fin: new Date(),
          segundosConsumidos: 0,
          motivoCierre: 'Finalizacion'
        })
      ),
      /No fue posible actualizar/
    );
  });
});
