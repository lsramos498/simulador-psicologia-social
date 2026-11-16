import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/**
 * Integración MySQL real — módulo Casos (Stefania Díaz).
 *
 * No corre con `npm test` normal. En PowerShell (carpeta backend):
 *   $env:LUMINA_MYSQL_TEST = "1"
 *   node --test tests/casos.mysql.test.js
 *
 * Usa backend/.env. Todo ocurre en una transacción con rollback:
 * no deja datos permanentes.
 *
 * Qué demuestra (flujo de punta a punta con el servicio y el repositorio reales):
 *  1. Crea un docente activo como creador (fixture con correo único por corrida).
 *  2. `construir` guarda el agregado completo (Builder → validación → MySQL).
 *  3. `obtener` recupera escenas, opciones con explicación y rúbrica.
 *  4. `publicar` rechaza (422) un borrador incompleto y no cambia su estado.
 *  5. `publicar` acepta el caso completo y `listar` lo devuelve como Publicado.
 *
 * Por qué existe además de las pruebas unitarias: estas últimas usan un pool
 * simulado y no detectan errores de SQL ni de esquema; esta prueba sí.
 * Cómo se evita dejar datos: el pool que recibe el repositorio es un envoltorio
 * sobre UNA conexión con `beginTransaction`; sus `commit`/`rollback` internos
 * son vacíos y el único ROLLBACK real se hace en `t.after`.
 */

test('MySQL real: construir, rechazar publicación incompleta, publicar y listar', {
  skip: process.env.LUMINA_MYSQL_TEST !== '1' && 'Se activa con LUMINA_MYSQL_TEST=1'
}, async (t) => {
  await import('dotenv/config');
  const { pool } = await import('../src/config/database.js');
  const { crearRepositorioCasos } = await import('../src/modules/casos/casos.repository.js');
  const { crearServicioCasos } = await import('../src/modules/casos/casos.service.js');

  const conexion = await pool.getConnection();
  await conexion.beginTransaction();
  t.after(async () => {
    try {
      await conexion.rollback();
    } finally {
      conexion.release();
      await pool.end();
    }
  });

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
  const servicio = crearServicioCasos(crearRepositorioCasos(poolEnTransaccion));
  let docenteId;
  let casoId;
  let casoIncompletoId;

  await t.test('prepara un docente activo como creador', async () => {
    const [usuario] = await ejecutar(
      `INSERT INTO Usuario (nombres, apellidos, correoInstitucional, contrasenaHash, activo, fechaCreacion)
       VALUES ('Docente', 'Casos', ?, 'fixture-casos', TRUE, NOW())`,
      [`docente-casos-${etiqueta}@prueba.invalid`]
    );
    docenteId = usuario.insertId;
    assert.ok(docenteId > 0);
  });

  await t.test('construir persiste el agregado completo en MySQL', async () => {
    const caso = await servicio.construir({
      creadorId: docenteId,
      titulo: `Conflicto ${etiqueta}`,
      desarrolloSituacional: 'Dos grupos discuten una norma del aula.',
      contextoHistoria: 'Primer semestre de psicología social.',
      tiempoEstimadoSegundos: 600,
      personajes: [
        { nombre: 'Ana', rolSocial: 'Estudiante', perfil: null, pautasComportamiento: null }
      ],
      escenas: [
        {
          nombre: 'Aula',
          contexto: 'Inicio de clase',
          orden: 1,
          esFinal: false,
          personajes: ['Ana'],
          decisiones: [
            {
              pregunta: '¿Cómo interviene el docente?',
              orden: 1,
              ayuda: null,
              opciones: [
                {
                  texto: 'Escucha a ambos',
                  esCorrecta: true,
                  consecuencia: null,
                  orden: 1,
                  explicacion: 'Contiene el conflicto y modela escucha.',
                  fundamentoTeorico: null
                },
                {
                  texto: 'Ignora la discusión',
                  esCorrecta: false,
                  consecuencia: null,
                  orden: 2,
                  explicacion: 'Evita la situación y refuerza la tensión.',
                  fundamentoTeorico: null
                }
              ]
            }
          ]
        }
      ],
      rubrica: {
        nombre: `Rúbrica ${etiqueta}`,
        descripcion: 'Evalúa la intervención',
        criterios: [
          {
            nombre: 'Intervención',
            descripcion: null,
            ponderacion: 100,
            puntajeMaximo: 4,
            niveles: [
              { nombre: 'Básico', descripcion: 'Nombra el conflicto.', puntaje: 1, orden: 1 },
              { nombre: 'Avanzado', descripcion: 'Media y propone acuerdo.', puntaje: 4, orden: 2 }
            ]
          }
        ]
      }
    });

    casoId = caso.id;
    assert.ok(casoId > 0);
    assert.equal(caso.estado, 'Borrador');
    assert.equal(caso.titulo, `Conflicto ${etiqueta}`);
    assert.equal(caso.escenas.length, 1);
    assert.equal(caso.escenas[0].decisiones[0].opciones.length, 2);
    assert.ok(caso.rubrica);
    assert.equal(caso.rubrica.nombre, `Rúbrica ${etiqueta}`);
    assert.equal(caso.rubrica.criterios.length, 1);
  });

  await t.test('obtenerCompleto recupera escenas, opciones y rúbrica desde MySQL', async () => {
    const caso = await servicio.obtener(casoId);
    assert.equal(caso.id, casoId);
    assert.equal(caso.personajes[0].nombre, 'Ana');
    assert.equal(caso.escenas[0].decisiones[0].pregunta, '¿Cómo interviene el docente?');
    assert.equal(
      caso.escenas[0].decisiones[0].opciones.find((o) => o.esCorrecta).explicacion,
      'Contiene el conflicto y modela escucha.'
    );
    assert.equal(caso.rubrica.criterios[0].niveles.length, 2);
  });

  await t.test('no publica un borrador incompleto', async () => {
    const incompleto = await servicio.crear({
      creadorId: docenteId,
      titulo: `Incompleto ${etiqueta}`,
      desarrolloSituacional: 'Solo datos básicos.',
      contextoHistoria: 'Sin escenas ni rúbrica.',
      tiempoEstimadoSegundos: 120
    });
    casoIncompletoId = incompleto.id;

    await assert.rejects(
      () => servicio.publicar(casoIncompletoId, { id: docenteId, roles: ['Docente'] }),
      (error) => error.statusCode === 422 && Array.isArray(error.errores) && error.errores.length >= 2
    );

    const sigue = await servicio.obtener(casoIncompletoId);
    assert.equal(sigue.estado, 'Borrador');
  });

  await t.test('publica el caso completo y lo deja consultable como Publicado', async () => {
    const publicado = await servicio.publicar(casoId, { id: docenteId, roles: ['Docente'] });
    assert.equal(publicado.estado, 'Publicado');
    assert.equal(publicado.rubrica.nombre, `Rúbrica ${etiqueta}`);

    const listado = await servicio.listar({ estado: 'Publicado', creadorId: docenteId });
    assert.ok(listado.some((item) => item.id === casoId && item.estado === 'Publicado'));
    assert.ok(!listado.some((item) => item.id === casoIncompletoId));
  });
});
