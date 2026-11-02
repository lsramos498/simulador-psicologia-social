import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { crearRepositorioParticipacion } from './participacion.repository.js';
import { crearServicioParticipacion } from './participacion.service.js';

// Nunca se activa con npm test ordinario. Requiere consentimiento para los INSERT/DELETE.
test('MySQL: registro y consulta en proyecto_nuclear_test', {
  skip: process.env.LUMINA_MYSQL_TEST !== '1'
}, async (t) => {
  const { config } = await import('dotenv');
  const configuracion = config({
    path: fileURLToPath(new URL('../../../.env.test', import.meta.url)),
    override: true,
    quiet: true
  });
  if (configuracion.error) throw new Error('Se requiere backend/.env.test local para las pruebas MySQL.');
  for (const nombre of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    assert.ok(configuracion.parsed[nombre]?.trim(), `Falta ${nombre} en la configuración de pruebas.`);
  }
  assert.equal(configuracion.parsed.DB_NAME, 'proyecto_nuclear_test', 'La base de pruebas debe ser explícita.');
  assert.equal(process.env.DB_NAME, 'proyecto_nuclear_test');
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_PORT, '3307');
  assert.notEqual(process.env.DB_USER?.toLowerCase(), 'root', 'No ejecutar con root.');

  // Reutilizar exactamente la conexión del equipo, con configuración de pruebas.
  const { pool } = await import('../../config/database.js');
  const creados = [];
  let sesionId;
  t.after(async () => {
    try {
      if (sesionId) {
        await pool.execute('DELETE FROM respuestaestudiante WHERE sesion_id = ?', [sesionId]);
      }
      // Solo IDs creados por esta ejecución; orden inverso de las claves foráneas.
      for (const { tabla, id } of [...creados].reverse()) {
        await pool.execute(`DELETE FROM ${tabla} WHERE id = ?`, [id]);
      }
    } finally {
      await pool.end();
    }
  });
  const [[base]] = await pool.query('SELECT DATABASE() AS nombre');
  assert.equal(base.nombre, 'proyecto_nuclear_test');

  // Tablas fijas del esquema aprobado; los nombres nunca vienen del usuario.
  async function insertar(tabla, columnas, valores) {
    const permitidas = ['usuario', 'espacioacademico', 'caso', 'rubrica', 'escena',
      'decision', 'opciondecision', 'actividadprogramada', 'estudianteautorizado', 'sesionsimulacion'];
    assert.ok(permitidas.includes(tabla));
    const [resultado] = await pool.execute(
      `INSERT INTO ${tabla} (${columnas}) VALUES (${valores.map(() => '?').join(', ')})`, valores
    );
    creados.push({ tabla, id: resultado.insertId });
    return resultado.insertId;
  }

  const etiqueta = randomUUID();
  const fecha = new Date('2026-11-02T09:00:00Z');
  const estudianteId = await insertar('usuario',
    'nombres, apellidos, correoInstitucional, contrasenaHash, fechaCreacion',
    ['Prueba', 'Participacion', `${etiqueta}@example.invalid`, 'fixture-no-utilizable-para-login', fecha]);
  const otroEstudianteId = await insertar('usuario',
    'nombres, apellidos, correoInstitucional, contrasenaHash, fechaCreacion',
    ['Otro', 'Participante', `${etiqueta}-otro@example.invalid`, 'fixture-no-utilizable-para-login', fecha]);
  const espacioId = await insertar('espacioacademico', 'nombre', ['Prueba Participación']);
  const casoId = await insertar('caso',
    'creador_id, titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos, fechaCreacion',
    [estudianteId, 'Fixture técnico', 'Situación controlada', 'Contexto controlado', 600, fecha]);
  const rubricaId = await insertar('rubrica', 'caso_id, nombre, fechaCreacion', [casoId, 'Fixture', fecha]);
  const escenaId = await insertar('escena', 'caso_id, nombre, contexto, `orden`', [casoId, 'Escena', 'Contexto', 1]);
  const decisionId = await insertar('decision', 'escena_id, pregunta, `orden`', [escenaId, 'Pregunta de prueba', 1]);
  const otraDecisionId = await insertar('decision', 'escena_id, pregunta, `orden`', [escenaId, 'Otra pregunta', 2]);
  const opcionId = await insertar('opciondecision', 'decision_id, texto, esCorrecta, `orden`', [decisionId, 'Opción', true, 1]);
  const otraOpcionId = await insertar('opciondecision', 'decision_id, texto, esCorrecta, `orden`', [otraDecisionId, 'Otra opción', false, 1]);
  const otroCasoId = await insertar('caso',
    'creador_id, titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos, fechaCreacion',
    [estudianteId, 'Otro caso', 'Situación', 'Contexto', 600, fecha]);
  const otraEscenaId = await insertar('escena', 'caso_id, nombre, contexto, `orden`', [otroCasoId, 'Otra escena', 'Contexto', 1]);
  const decisionAjenaId = await insertar('decision', 'escena_id, pregunta, `orden`', [otraEscenaId, 'Decisión ajena', 1]);
  const opcionAjenaId = await insertar('opciondecision', 'decision_id, texto, esCorrecta, `orden`', [decisionAjenaId, 'Opción ajena', false, 1]);
  const actividadId = await insertar('actividadprogramada',
    'caso_id, espacioAcademico_id, docente_id, rubrica_id, fechaInicio, fechaFin, tiempoLimiteSegundos, fechaCreacion',
    [casoId, espacioId, estudianteId, rubricaId, fecha, new Date('2026-11-02T10:00:00Z'), 600, fecha]);
  await insertar('estudianteautorizado',
    'actividad_id, estudiante_id, codigoAutorizacion, fechaAutorizacion', [actividadId, estudianteId, etiqueta, fecha]);
  sesionId = await insertar('sesionsimulacion',
    'actividad_id, estudiante_id, estado, inicio', [actividadId, estudianteId, 'En curso', fecha]);

  const servicio = crearServicioParticipacion(crearRepositorioParticipacion(pool));
  const datos = { sesionId, decisionId, opcionId };
  async function cantidad() {
    const [[fila]] = await pool.execute('SELECT COUNT(*) AS total FROM respuestaestudiante WHERE sesion_id = ?', [sesionId]);
    return fila.total;
  }

  await t.test('Consulta inicial vacía y rechazo de propietario ajeno', async () => {
    assert.deepEqual(await servicio.consultar(sesionId, estudianteId), []);
    await assert.rejects(servicio.consultar(sesionId, otroEstudianteId), { codigo: 'SESION_AJENA' });
    await assert.rejects(servicio.registrar(datos, otroEstudianteId), { codigo: 'SESION_AJENA' });
    assert.equal(await cantidad(), 0);
  });
  await t.test('Sesión inexistente, IDs inválidos y relaciones inválidas no insertan', async () => {
    const [[fila]] = await pool.query('SELECT MAX(id) AS maximo FROM sesionsimulacion');
    await assert.rejects(servicio.registrar({ ...datos, sesionId: fila.maximo + 1 }, estudianteId), { codigo: 'SESION_NO_EXISTE' });
    await assert.rejects(servicio.registrar({ ...datos, opcionId: -1 }, estudianteId));
    await assert.rejects(servicio.registrar({ ...datos, opcionId: otraOpcionId }, estudianteId), { codigo: 'OPCION_INVALIDA' });
    await assert.rejects(servicio.registrar({ ...datos, decisionId: decisionAjenaId, opcionId: opcionAjenaId }, estudianteId), { codigo: 'OPCION_INVALIDA' });
    assert.equal(await cantidad(), 0);
  });
  await t.test('Sin iniciar y Finalizado impiden guardar', async () => {
    try {
      for (const estado of ['Sin iniciar', 'Finalizado']) {
        await pool.execute('UPDATE sesionsimulacion SET estado = ? WHERE id = ?', [estado, sesionId]);
        await assert.rejects(servicio.registrar(datos, estudianteId), { codigo: 'ESTADO_NO_PERMITIDO' });
      }
      assert.equal(await cantidad(), 0);
    } finally {
      await pool.execute('UPDATE sesionsimulacion SET estado = ? WHERE id = ?', ['En curso', sesionId]);
    }
  });
  await t.test('Inserción confirmada visible desde otra conexión y consulta del servicio', async () => {
    // Reservarla antes del registro garantiza una conexión física distinta.
    const conexion = await pool.getConnection();
    let guardada;
    try {
      guardada = await servicio.registrar(datos, estudianteId);
      const [[fila]] = await conexion.execute('SELECT sesion_id, decision_id, opcion_id, fechaRespuesta FROM respuestaestudiante WHERE id = ?', [guardada.id]);
      assert.equal(fila.sesion_id, sesionId);
      assert.equal(fila.decision_id, decisionId);
      assert.equal(fila.opcion_id, opcionId);
      assert.ok(fila.fechaRespuesta instanceof Date);
    } finally {
      conexion.release();
    }
    const [respuesta] = await servicio.consultar(sesionId, estudianteId);
    assert.equal(respuesta.id, guardada.id);
    assert.equal(respuesta.opcionId, opcionId);
    assert.equal(Object.hasOwn(respuesta, 'esCorrecta'), false);
    assert.equal(await cantidad(), 1);
  });
  await t.test('Duplicados no sobrescriben y dos registros concurrentes producen una sola fila', async () => {
    await assert.rejects(servicio.registrar(datos, estudianteId), { codigo: 'RESPUESTA_DUPLICADA' });
    const segunda = { sesionId, decisionId: otraDecisionId, opcionId: otraOpcionId };
    const resultados = await Promise.allSettled([
      servicio.registrar(segunda, estudianteId), servicio.registrar(segunda, estudianteId)
    ]);
    assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1);
    assert.equal(resultados.find((resultado) => resultado.status === 'rejected').reason.codigo, 'RESPUESTA_DUPLICADA');
    assert.equal(await cantidad(), 2);
    assert.equal((await servicio.consultar(sesionId, estudianteId)).find((respuesta) => respuesta.decisionId === decisionId).opcionId, opcionId);
  });
});
