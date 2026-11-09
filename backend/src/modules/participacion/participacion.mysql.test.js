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
  assert.ok(!configuracion.error, 'Se requiere la configuración privada de pruebas.');
  for (const [nombre, esperado] of Object.entries({
    DB_HOST: '127.0.0.1', DB_PORT: '3307',
    DB_NAME: 'proyecto_nuclear_test', DB_USER: 'lumina_test'
  })) {
    // No incluir valores recibidos ni credenciales en errores de configuración.
    assert.ok(configuracion.parsed[nombre] === esperado, `Destino no autorizado: ${nombre}`);
    assert.ok(process.env[nombre] === esperado, `Entorno no autorizado: ${nombre}`);
  }
  assert.ok(configuracion.parsed.DB_PASSWORD?.trim(), 'Falta la contraseña privada de pruebas.');

  const { pool } = await import('../../config/database.js');
  const tablas = ['Usuario', 'EspacioAcademico', 'Caso', 'Rubrica', 'Escena',
    'Decision', 'OpcionDecision', 'ActividadProgramada', 'EstudianteAutorizado',
    'SesionSimulacion', 'RespuestaEstudiante'];
  const creados = [];
  let sesionId;
  let destinoValidado = false;
  let referencia;

  async function inventario() {
    const resultado = new Map();
    for (const tabla of tablas) {
      const [filas] = await pool.execute(`SELECT id FROM ${tabla} ORDER BY id`);
      resultado.set(tabla, filas.map((fila) => fila.id));
    }
    return resultado;
  }

  function recordar(tabla, id) {
    assert.ok(tablas.includes(tabla) && Number.isSafeInteger(id) && id > 0);
    if (!creados.some((fila) => fila.tabla === tabla && fila.id === id)) {
      creados.push({ tabla, id });
    }
  }

  function falloSeguro(error) {
    return typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
      ? error.code : 'FALLO_PRUEBA';
  }

  t.after(async () => {
    const errores = [];
    const pendientes = [];
    try {
      if (!destinoValidado) return;
      const sesiones = creados.filter((fila) => fila.tabla === 'SesionSimulacion');
      // Recupera también respuestas cuyo INSERT ocurrió antes de un fallo del servicio.
      for (const sesion of sesiones) {
        try {
          const [filas] = await pool.execute(
            'SELECT id FROM RespuestaEstudiante WHERE sesion_id = ?', [sesion.id]);
          for (const fila of filas) recordar('RespuestaEstudiante', fila.id);
        } catch (error) {
          errores.push({ tabla: 'RespuestaEstudiante', sesionId: sesion.id, codigo: falloSeguro(error) });
        }
      }
      const respuestas = creados.filter((fila) => fila.tabla === 'RespuestaEstudiante').reverse();
      const auxiliares = creados.filter((fila) => fila.tabla !== 'RespuestaEstudiante').reverse();
      // Limpieza por IDs concretos: primero respuestas, después dependencias en orden inverso.
      for (const fila of [...respuestas, ...auxiliares]) {
        try {
          await pool.execute(`DELETE FROM ${fila.tabla} WHERE id = ?`, [fila.id]);
        } catch (error) {
          errores.push({ ...fila, codigo: falloSeguro(error) });
        }
      }
      // Si falla una operación, se siguen comprobando los demás IDs sin borrados generales.
      for (const fila of creados) {
        try {
          const [filas] = await pool.execute(`SELECT id FROM ${fila.tabla} WHERE id = ?`, [fila.id]);
          if (filas.length) pendientes.push(fila);
        } catch {
          pendientes.push({ ...fila, verificacion: 'no disponible' });
        }
      }
      let diferencias = [];
      if (referencia) {
        try {
          const despues = await inventario();
          for (const tabla of tablas) {
            const antes = new Set(referencia.get(tabla));
            const ahora = new Set(despues.get(tabla));
            const agregados = [...ahora].filter((id) => !antes.has(id));
            const faltantes = [...antes].filter((id) => !ahora.has(id));
            if (agregados.length || faltantes.length) diferencias.push({ tabla, agregados, faltantes });
          }
        } catch (error) {
          errores.push({ operacion: 'inventario final', codigo: falloSeguro(error) });
        }
      }
      if (errores.length || pendientes.length || diferencias.length) {
        t.diagnostic(JSON.stringify({ limpieza: 'incompleta o no verificable', errores, pendientes,
          diferencias, idsCreados: creados }));
        assert.fail('Revisar los IDs informados antes de repetir la suite; no se hará limpieza general.');
      }
      t.diagnostic(`Limpieza confirmada: ${creados.length} IDs controlados, sin residuos ni diferencias en once tablas.`);
    } finally {
      await pool.end();
    }
  });

  try {
    const [[identidad]] = await pool.query(
      'SELECT DATABASE() AS base, CURRENT_USER() AS cuenta, @@port AS puerto');
    assert.ok(identidad.base === 'proyecto_nuclear_test', 'Base efectiva no autorizada.');
    assert.ok(identidad.cuenta === 'lumina_test@127.0.0.1', 'Cuenta efectiva no autorizada.');
    assert.ok(identidad.puerto === 3307, 'Puerto efectivo no autorizado.');
  } catch (error) {
    throw new Error(`No se pudo validar la conexión de pruebas (${falloSeguro(error)}); no se crearán fixtures.`);
  }
  destinoValidado = true;
  referencia = await inventario();

  async function insertar(tabla, columnas, valores) {
    assert.ok(tablas.includes(tabla));
    const [resultado] = await pool.execute(
      `INSERT INTO ${tabla} (${columnas}) VALUES (${valores.map(() => '?').join(', ')})`, valores);
    recordar(tabla, resultado.insertId);
    return resultado.insertId;
  }

  const etiqueta = randomUUID();
  const fecha = new Date('2026-11-02T09:00:00Z');
  const estudianteId = await insertar('Usuario',
    'nombres, apellidos, correoInstitucional, contrasenaHash, fechaCreacion',
    ['Prueba', 'Participacion', `${etiqueta}@example.invalid`, 'fixture-no-utilizable-para-login', fecha]);
  const otroEstudianteId = await insertar('Usuario',
    'nombres, apellidos, correoInstitucional, contrasenaHash, fechaCreacion',
    ['Otro', 'Participante', `${etiqueta}-otro@example.invalid`, 'fixture-no-utilizable-para-login', fecha]);
  const espacioId = await insertar('EspacioAcademico', 'nombre', ['Prueba Participación']);
  const casoId = await insertar('Caso',
    'creador_id, titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos, fechaCreacion',
    [estudianteId, 'Fixture técnico', 'Situación controlada', 'Contexto controlado', 600, fecha]);
  const rubricaId = await insertar('Rubrica', 'caso_id, nombre, fechaCreacion', [casoId, 'Fixture', fecha]);
  const escenaId = await insertar('Escena', 'caso_id, nombre, contexto, `orden`', [casoId, 'Escena', 'Contexto', 1]);
  const decisionId = await insertar('Decision', 'escena_id, pregunta, `orden`', [escenaId, 'Pregunta de prueba', 1]);
  const otraDecisionId = await insertar('Decision', 'escena_id, pregunta, `orden`', [escenaId, 'Otra pregunta', 2]);
  const opcionId = await insertar('OpcionDecision', 'decision_id, texto, esCorrecta, `orden`', [decisionId, 'Opción', true, 1]);
  const otraOpcionId = await insertar('OpcionDecision', 'decision_id, texto, esCorrecta, `orden`', [otraDecisionId, 'Otra opción', false, 1]);
  const opcionAlternativaId = await insertar('OpcionDecision', 'decision_id, texto, esCorrecta, `orden`', [decisionId, 'Alternativa', false, 2]);
  const otroCasoId = await insertar('Caso',
    'creador_id, titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos, fechaCreacion',
    [estudianteId, 'Otro caso', 'Situación', 'Contexto', 600, fecha]);
  const otraEscenaId = await insertar('Escena', 'caso_id, nombre, contexto, `orden`', [otroCasoId, 'Otra escena', 'Contexto', 1]);
  const decisionAjenaId = await insertar('Decision', 'escena_id, pregunta, `orden`', [otraEscenaId, 'Decisión ajena', 1]);
  const opcionAjenaId = await insertar('OpcionDecision', 'decision_id, texto, esCorrecta, `orden`', [decisionAjenaId, 'Opción ajena', false, 1]);
  const actividadId = await insertar('ActividadProgramada',
    'caso_id, espacioAcademico_id, docente_id, rubrica_id, fechaInicio, fechaFin, tiempoLimiteSegundos, fechaCreacion',
    [casoId, espacioId, estudianteId, rubricaId, fecha, new Date('2026-11-02T10:00:00Z'), 600, fecha]);
  await insertar('EstudianteAutorizado',
    'actividad_id, estudiante_id, codigoAutorizacion, fechaAutorizacion', [actividadId, estudianteId, etiqueta, fecha]);
  sesionId = await insertar('SesionSimulacion',
    'actividad_id, estudiante_id, estado, inicio', [actividadId, estudianteId, 'En curso', fecha]);

  const servicio = crearServicioParticipacion(crearRepositorioParticipacion(pool));
  const datos = { sesionId, decisionId, opcionId };
  async function cantidad() {
    const [[fila]] = await pool.execute('SELECT COUNT(*) AS total FROM RespuestaEstudiante WHERE sesion_id = ?', [sesionId]);
    return fila.total;
  }

  await t.test('Consulta inicial vacía y rechazo de propietario ajeno', async () => {
    assert.deepEqual(await servicio.consultar(sesionId, estudianteId), []);
    await assert.rejects(servicio.consultar(sesionId, otroEstudianteId), { codigo: 'SESION_AJENA' });
    await assert.rejects(servicio.registrar(datos, otroEstudianteId), { codigo: 'SESION_AJENA' });
    assert.equal(await cantidad(), 0);
  });
  await t.test('Sesión inexistente, IDs inválidos y relaciones inválidas no insertan', async () => {
    const [[fila]] = await pool.query('SELECT MAX(id) AS maximo FROM SesionSimulacion');
    await assert.rejects(servicio.registrar({ ...datos, sesionId: fila.maximo + 1 }, estudianteId), { codigo: 'SESION_NO_EXISTE' });
    await assert.rejects(servicio.registrar({ ...datos, opcionId: -1 }, estudianteId));
    await assert.rejects(servicio.registrar({ ...datos, opcionId: otraOpcionId }, estudianteId), { codigo: 'OPCION_INVALIDA' });
    await assert.rejects(servicio.registrar({ ...datos, decisionId: decisionAjenaId, opcionId: opcionAjenaId }, estudianteId), { codigo: 'OPCION_INVALIDA' });
    assert.equal(await cantidad(), 0);
  });
  await t.test('Sin iniciar y Finalizado impiden guardar', async () => {
    try {
      for (const estado of ['Sin iniciar', 'Finalizado']) {
        await pool.execute('UPDATE SesionSimulacion SET estado = ? WHERE id = ?', [estado, sesionId]);
        await assert.rejects(servicio.registrar(datos, estudianteId), { codigo: 'ESTADO_NO_PERMITIDO' });
      }
      assert.equal(await cantidad(), 0);
    } finally {
      await pool.execute('UPDATE SesionSimulacion SET estado = ? WHERE id = ?', ['En curso', sesionId]);
    }
  });
  await t.test('Inserción confirmada visible desde otra conexión y consulta del servicio', async () => {
    // Reservarla antes del registro garantiza una conexión física distinta.
    const conexion = await pool.getConnection();
    let guardada;
    try {
      guardada = await servicio.registrar(datos, estudianteId);
      const [[fila]] = await conexion.execute('SELECT sesion_id, decision_id, opcion_id, fechaRespuesta FROM RespuestaEstudiante WHERE id = ?', [guardada.id]);
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
  await t.test('Cambio real conserva fecha inicial; repetición no altera fechas', async () => {
    const [antes] = await servicio.consultar(sesionId, estudianteId);
    const cambiada = await servicio.registrar({ ...datos, opcionId: opcionAlternativaId }, estudianteId);
    assert.equal(cambiada.id, antes.id);
    const [despues] = await servicio.consultar(sesionId, estudianteId);
    assert.equal(despues.opcionId, opcionAlternativaId);
    assert.deepEqual(despues.fechaRespuesta, antes.fechaRespuesta);
    assert.ok(despues.fechaModificacion instanceof Date);
    assert.ok(despues.fechaModificacion >= despues.fechaRespuesta);
    await servicio.registrar({ ...datos, opcionId: opcionAlternativaId }, estudianteId);
    assert.deepEqual((await servicio.consultar(sesionId, estudianteId))[0], despues);
  });
  await t.test('Completa una fila pendiente sin duplicarla', async () => {
    const [pendiente] = await pool.execute(
      'INSERT INTO RespuestaEstudiante (sesion_id, decision_id) VALUES (?, ?)', [sesionId, otraDecisionId]);
    const respuesta = await servicio.registrar({ sesionId, decisionId: otraDecisionId, opcionId: otraOpcionId }, estudianteId);
    assert.equal(respuesta.id, pendiente.insertId);
    const fila = (await servicio.consultar(sesionId, estudianteId)).find(r => r.id === respuesta.id);
    assert.ok(fila.fechaRespuesta instanceof Date);
    assert.equal(fila.fechaModificacion, null);
    assert.equal(await cantidad(), 2);
  });
  await t.test('Cambios concurrentes conservan una fila por decisión', async () => {
    const resultados = await Promise.all([
      servicio.registrar(datos, estudianteId),
      servicio.registrar({ ...datos, opcionId: opcionAlternativaId }, estudianteId)
    ]);
    assert.equal(resultados[0].id, resultados[1].id);
    assert.equal(await cantidad(), 2);
    const fila = (await servicio.consultar(sesionId, estudianteId)).find(r => r.decisionId === decisionId);
    assert.ok([opcionId, opcionAlternativaId].includes(fila.opcionId));
  });
  await t.test('Respuesta incoherente se rechaza sin reparación silenciosa', async () => {
    const [antes] = await servicio.consultar(sesionId, estudianteId);
    try {
      await pool.execute('UPDATE RespuestaEstudiante SET fechaRespuesta = NULL WHERE id = ?', [antes.id]);
      await assert.rejects(servicio.registrar(datos, estudianteId), { codigo: 'RESPUESTA_INCONSISTENTE' });
      const [[fila]] = await pool.execute('SELECT fechaRespuesta FROM RespuestaEstudiante WHERE id = ?', [antes.id]);
      assert.equal(fila.fechaRespuesta, null);
    } finally {
      await pool.execute('UPDATE RespuestaEstudiante SET fechaRespuesta = ? WHERE id = ?', [antes.fechaRespuesta, antes.id]);
    }
  });
  await t.test('Finalización y respuesta concurrentes usan el bloqueo de sesión', async () => {
    const cierre = await pool.getConnection();
    try {
      await cierre.beginTransaction();
      await cierre.execute('SELECT id FROM SesionSimulacion WHERE id = ? FOR UPDATE', [sesionId]);
      await cierre.execute("UPDATE SesionSimulacion SET estado = 'Finalizado' WHERE id = ?", [sesionId]);
      const intento = servicio.registrar(datos, estudianteId);
      const rechazo = assert.rejects(intento, { codigo: 'ESTADO_NO_PERMITIDO' });
      await cierre.commit();
      await rechazo;
      const conservadas = await servicio.consultar(sesionId, estudianteId);
      await assert.rejects(servicio.registrar({ ...datos, opcionId: opcionAlternativaId }, estudianteId), { codigo: 'ESTADO_NO_PERMITIDO' });
      assert.deepEqual(await servicio.consultar(sesionId, estudianteId), conservadas);
    } finally {
      await cierre.rollback();
      cierre.release();
    }
  });
});
