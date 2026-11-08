import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { crearRepositorioParticipacion } from './participacion.repository.js';
import { crearServicioParticipacion } from './participacion.service.js';

// Sin activación explícita no se leen archivos privados ni se crea un pool MySQL.
test('MySQL RF-11: progreso persistido y HTTP en proyecto_nuclear_test', {
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
  const usuarioColumnas = 'nombres, apellidos, correoInstitucional, contrasenaHash, fechaCreacion';
  const estudianteId = await insertar('Usuario', usuarioColumnas,
    ['Prueba', 'Progreso', `${etiqueta}@example.invalid`, 'fixture-no-utilizable-para-login', fecha]);
  const otroEstudianteId = await insertar('Usuario', usuarioColumnas,
    ['Otro', 'Progreso', `${etiqueta}-otro@example.invalid`, 'fixture-no-utilizable-para-login', fecha]);
  const espacioId = await insertar('EspacioAcademico', 'nombre', [`RF11 ${etiqueta}`]);
  const casos = [];
  for (const nombre of ['Principal', 'Externo']) {
    const casoId = await insertar('Caso',
      'creador_id, titulo, desarrolloSituacional, contextoHistoria, tiempoEstimadoSegundos, fechaCreacion',
      [estudianteId, `${nombre} ${etiqueta}`, 'Fixture técnico', 'Contexto ficticio', 600, fecha]);
    const rubricaId = await insertar('Rubrica', 'caso_id, nombre, fechaCreacion', [casoId, 'Fixture', fecha]);
    casos.push({ casoId, rubricaId });
  }
  const [principal, externo] = casos;
  // Se crean fuera de orden para comprobar que la consulta usa orden académico, no IDs.
  const escenaSegunda = await insertar('Escena', 'caso_id, nombre, contexto, `orden`',
    [principal.casoId, 'Segunda', 'Contexto', 2]);
  const escenaPrimera = await insertar('Escena', 'caso_id, nombre, contexto, `orden`',
    [principal.casoId, 'Primera', 'Contexto', 1]);
  const escenaExterna = await insertar('Escena', 'caso_id, nombre, contexto, `orden`',
    [externo.casoId, 'Externa', 'Contexto', 1]);
  const decision3 = await insertar('Decision', 'escena_id, pregunta, `orden`', [escenaSegunda, 'Pregunta 3', 1]);
  const decision2 = await insertar('Decision', 'escena_id, pregunta, `orden`', [escenaPrimera, 'Pregunta 2', 2]);
  const decision1 = await insertar('Decision', 'escena_id, pregunta, `orden`', [escenaPrimera, 'Pregunta 1', 1]);
  const decisionExterna = await insertar('Decision', 'escena_id, pregunta, `orden`', [escenaExterna, 'Externa', 1]);
  const opciones = [];
  for (const [decision, texto, orden] of [
    [decision1, 'A', 1], [decision1, 'B', 2], [decision2, 'A', 1],
    [decision3, 'A', 1], [decisionExterna, 'A', 1]
  ]) {
    opciones.push(await insertar('OpcionDecision', 'decision_id, texto, esCorrecta, `orden`',
      [decision, texto, false, orden]));
  }
  const [opcionA, opcionB, opcion2, opcion3, opcionExterna] = opciones;
  const actividades = [];
  for (const caso of casos) {
    actividades.push(await insertar('ActividadProgramada',
      'caso_id, espacioAcademico_id, docente_id, rubrica_id, fechaInicio, fechaFin, tiempoLimiteSegundos, fechaCreacion',
      [caso.casoId, espacioId, estudianteId, caso.rubricaId, fecha, new Date('2026-11-02T10:00:00Z'), 600, fecha]));
  }
  const sesiones = [];
  for (const [actividadId, usuarioId] of [
    [actividades[0], estudianteId], [actividades[0], otroEstudianteId], [actividades[1], estudianteId]
  ]) {
    await insertar('EstudianteAutorizado',
      'actividad_id, estudiante_id, codigoAutorizacion, fechaAutorizacion',
      [actividadId, usuarioId, `${etiqueta}-${sesiones.length}`, fecha]);
    sesiones.push(await insertar('SesionSimulacion', 'actividad_id, estudiante_id, estado, inicio',
      [actividadId, usuarioId, 'En curso', fecha]));
  }
  const [sesionId, sesionAjenaId, sesionExternaId] = sesiones;
  const repositorio = crearRepositorioParticipacion(pool);
  const servicio = crearServicioParticipacion(repositorio);
  const datos = { sesionId, decisionId: decision1, opcionId: opcionA };
  const consultar = () => servicio.consultarProgreso(sesionId, estudianteId);
  async function registrar(respuesta, usuarioId = estudianteId) {
    const resultado = await servicio.registrar(respuesta, usuarioId);
    recordar('RespuestaEstudiante', resultado.id);
    return resultado;
  }

  const secretoAnterior = process.env.JWT_SECRETO;
  process.env.JWT_SECRETO = `solo-pruebas-progreso-${randomUUID()}`;
  t.after(() => {
    if (secretoAnterior === undefined) delete process.env.JWT_SECRETO;
    else process.env.JWT_SECRETO = secretoAnterior;
  });
  const { default: express } = await import('express');
  const { default: request } = await import('supertest');
  const { firmarToken } = await import('../acceso/tokens.js');
  const { crearRutasParticipacion } = await import('../../routes/participacion.routes.js');
  const token = firmarToken({ id: estudianteId, roles: ['Estudiante'], actividadId: actividades[0] });
  const app = express();
  app.use(express.json());
  app.use('/api/participacion', crearRutasParticipacion(async () => servicio));
  const get = (id) => request(app).get(`/api/participacion/sesiones/${id}/progreso`)
    .set('Authorization', `Bearer ${token}`);

  let continuar = true;
  async function escenario(nombre, ejecutar) {
    await t.test(nombre, { skip: !continuar && 'No continuar tras un fallo previo.' }, async () => {
      try { await ejecutar(); } catch (error) { continuar = false; throw error; }
    });
  }

  await escenario('Sesión sin respuestas: tres decisiones pendientes', async () => {
    assert.deepEqual(await consultar(), { estadoRecorrido: 'determinado', totalPreguntas: 3,
      preguntasRespondidas: 0, preguntasPendientes: 3,
      decisionesPendientesIds: [decision1, decision2, decision3] });
  });
  await escenario('Pendientes respetan el orden de escena y decisión', async () => {
    assert.notDeepEqual([decision1, decision2, decision3], [decision1, decision2, decision3].sort((a, b) => a - b));
    assert.deepEqual(await repositorio.obtenerDecisionesAplicables(principal.casoId), [decision1, decision2, decision3]);
    assert.deepEqual((await consultar()).decisionesPendientesIds, [decision1, decision2, decision3]);
  });
  let pendienteId;
  await escenario('Opción nula y decisión sin fila continúan pendientes', async () => {
    pendienteId = await insertar('RespuestaEstudiante', 'sesion_id, decision_id', [sesionId, decision2]);
    assert.equal((await consultar()).preguntasRespondidas, 0);
    assert.deepEqual((await consultar()).decisionesPendientesIds, [decision1, decision2, decision3]);
  });
  await escenario('Progreso parcial se guarda y devuelve después del registro', async () => {
    const resultado = await registrar(datos);
    assert.equal(resultado.progreso.preguntasRespondidas, 1);
    assert.deepEqual(resultado.progreso.decisionesPendientesIds, [decision2, decision3]);
    assert.deepEqual(await consultar(), resultado.progreso);
  });
  await escenario('Modificar A por B no aumenta el conteo ni cambia fecha inicial', async () => {
    const antes = (await servicio.consultar(sesionId, estudianteId)).find((fila) => fila.decisionId === decision1);
    const resultado = await registrar({ ...datos, opcionId: opcionB });
    const despues = (await servicio.consultar(sesionId, estudianteId)).find((fila) => fila.id === antes.id);
    assert.equal(resultado.id, antes.id);
    assert.equal(despues.opcionId, opcionB);
    assert.deepEqual(despues.fechaRespuesta, antes.fechaRespuesta);
    assert.ok(despues.fechaModificacion instanceof Date);
    assert.equal(resultado.progreso.preguntasRespondidas, 1);
    assert.equal((await consultar()).preguntasRespondidas, 1);
  });
  await escenario('Respuestas de otra sesión del mismo caso no alteran el progreso', async () => {
    const antes = await consultar();
    await registrar({ sesionId: sesionAjenaId, decisionId: decision3, opcionId: opcion3 }, otroEstudianteId);
    assert.deepEqual(await consultar(), antes);
    assert.equal((await servicio.consultarProgreso(sesionAjenaId, otroEstudianteId)).preguntasRespondidas, 1);
  });
  await escenario('Otro caso conserva sus propias decisiones y respuestas', async () => {
    const antes = await consultar();
    await registrar({ sesionId: sesionExternaId, decisionId: decisionExterna, opcionId: opcionExterna });
    assert.deepEqual(await consultar(), antes);
    assert.ok(!antes.decisionesPendientesIds.includes(decisionExterna));
    assert.equal((await servicio.consultarProgreso(sesionExternaId, estudianteId)).totalPreguntas, 1);
    // No se prepara ninguna respuesta de caso ajeno dentro de la sesión principal.
  });
  await escenario('GET autenticado devuelve el progreso propio desde MySQL', async () => {
    const respuesta = await get(sesionId);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, { data: await consultar() });
  });
  await escenario('GET de sesión ajena devuelve 403', async () => {
    const respuesta = await get(sesionAjenaId);
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.codigo, 'SESION_AJENA');
    assert.equal(Object.hasOwn(respuesta.body, 'data'), false);
  });
  await escenario('Fallo de progreso revierte un INSERT real antes de devolver éxito', async () => {
    const antes = await consultar();
    const errorControlado = new Error('Fallo de lectura controlado RF-11');
    let intentoInsertado = false;
    let falloLectura = false;
    const poolConFallo = { getConnection: async () => {
      const conexion = await pool.getConnection();
      return {
        beginTransaction: () => conexion.beginTransaction(), commit: () => conexion.commit(),
        rollback: () => conexion.rollback(), release: () => conexion.release(),
        execute: async (sql, parametros) => {
          if (sql.includes('SELECT d.id FROM Decision')) {
            falloLectura = true;
            throw errorControlado;
          }
          const resultado = await conexion.execute(sql, parametros);
          if (sql.includes('INSERT INTO RespuestaEstudiante')) {
            intentoInsertado = true;
            recordar('RespuestaEstudiante', resultado[0].insertId);
          }
          return resultado;
        }
      };
    } };
    const servicioConFallo = crearServicioParticipacion(crearRepositorioParticipacion(poolConFallo));
    // Reservada antes del registro: la comprobación utiliza otra conexión física.
    const verificacion = await pool.getConnection();
    try {
      await assert.rejects(servicioConFallo.registrar({ sesionId, decisionId: decision3, opcionId: opcion3 }, estudianteId),
        (error) => error === errorControlado);
      assert.ok(intentoInsertado && falloLectura, 'Debe fallar después del INSERT, no antes.');
      const [filas] = await verificacion.execute(
        'SELECT id FROM RespuestaEstudiante WHERE sesion_id = ? AND decision_id = ?', [sesionId, decision3]);
      assert.equal(filas.length, 0);
    } finally {
      verificacion.release();
    }
    assert.deepEqual(await consultar(), antes);
  });
  await escenario('Todas respondidas: cero pendientes y sesión todavía En curso', async () => {
    const completada = await registrar({ sesionId, decisionId: decision2, opcionId: opcion2 });
    assert.equal(completada.id, pendienteId);
    await registrar({ sesionId, decisionId: decision3, opcionId: opcion3 });
    const progreso = await consultar();
    assert.equal(progreso.totalPreguntas, 3);
    assert.equal(progreso.preguntasRespondidas, 3);
    assert.equal(progreso.preguntasPendientes, 0);
    assert.deepEqual(progreso.decisionesPendientesIds, []);
    const [[sesion]] = await pool.execute('SELECT estado FROM SesionSimulacion WHERE id = ?', [sesionId]);
    assert.equal(sesion.estado, 'En curso');
  });
  await escenario('Sesión finalizada conserva progreso y rechaza respuestas y cambios', async () => {
    const antes = await consultar();
    const respuestasAntes = await servicio.consultar(sesionId, estudianteId);
    await pool.execute('UPDATE SesionSimulacion SET estado = ? WHERE id = ?', ['Finalizado', sesionId]);
    assert.deepEqual(await consultar(), antes);
    const respuesta = await get(sesionId);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, { data: antes });
    await assert.rejects(servicio.registrar(datos, estudianteId), { codigo: 'ESTADO_NO_PERMITIDO' });
    await assert.rejects(servicio.registrar({ ...datos, opcionId: opcionB }, estudianteId), { codigo: 'ESTADO_NO_PERMITIDO' });
    assert.deepEqual(await servicio.consultar(sesionId, estudianteId), respuestasAntes);
  });
});
