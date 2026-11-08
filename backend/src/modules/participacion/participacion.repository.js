// El pool se recibe desde config/database.js; este módulo no crea conexiones globales.
export function crearRepositorioParticipacion(pool) {
  function consultas(conexion) {
    return {
      async obtenerSesion(sesionId, bloquear = false) {
        const [filas] = await conexion.execute(`
          SELECT s.id, s.estudiante_id AS estudianteId, s.estado,
                 a.caso_id AS casoId
          FROM SesionSimulacion s
          JOIN ActividadProgramada a ON a.id = s.actividad_id
          WHERE s.id = ?${bloquear ? ' FOR UPDATE' : ''}
        `, [sesionId]);
        return filas[0] ?? null;
      },
      async opcionValida(casoId, decisionId, opcionId) {
        const [filas] = await conexion.execute(`
          SELECT o.id FROM OpcionDecision o
          JOIN Decision d ON d.id = o.decision_id
          JOIN Escena e ON e.id = d.escena_id
          WHERE e.caso_id = ? AND d.id = ? AND o.id = ?
        `, [casoId, decisionId, opcionId]);
        return filas.length > 0;
      },
      async obtenerDecisionesAplicables(casoId) {
        // Casos confirma un recorrido lineal: todas sus decisiones son aplicables actualmente.
        const [filas] = await conexion.execute(`
          SELECT d.id FROM Decision d
          JOIN Escena e ON e.id = d.escena_id
          WHERE e.caso_id = ?
          ORDER BY e.\`orden\`, e.id, d.\`orden\`, d.id
        `, [casoId]);
        return filas.map((fila) => fila.id);
      },
      async consultarRespuestasParaProgreso(sesionId, casoId) {
        const [filas] = await conexion.execute(`
          SELECT r.decision_id AS decisionId, r.opcion_id AS opcionId
          FROM RespuestaEstudiante r
          JOIN Decision d ON d.id = r.decision_id
          JOIN Escena e ON e.id = d.escena_id
          LEFT JOIN OpcionDecision o ON o.id = r.opcion_id AND o.decision_id = d.id
          WHERE r.sesion_id = ? AND e.caso_id = ?
            AND (r.opcion_id IS NULL OR o.id IS NOT NULL)
          ORDER BY r.id
        `, [sesionId, casoId]);
        return filas;
      },
      async obtenerRespuesta(sesionId, decisionId) {
        const [filas] = await conexion.execute(`
          SELECT id, opcion_id AS opcionId, fechaRespuesta, fechaModificacion
          FROM RespuestaEstudiante
          WHERE sesion_id = ? AND decision_id = ?
          FOR UPDATE
        `, [sesionId, decisionId]);
        return filas[0] ?? null;
      },
      async insertarRespuesta({ sesionId, decisionId, opcionId }) {
        const [resultado] = await conexion.execute(`
          INSERT INTO RespuestaEstudiante
            (sesion_id, decision_id, opcion_id, fechaRespuesta)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [sesionId, decisionId, opcionId]);
        return resultado.insertId;
      },
      async actualizarRespuesta(respuestaId, opcionId, sesionId, decisionId, primeraRespuesta = false) {
        // La sesión permanece bloqueada hasta el commit; el cierre debe respetar ese bloqueo.
        const fechas = primeraRespuesta
          ? 'fechaRespuesta = CURRENT_TIMESTAMP, fechaModificacion = NULL'
          : 'fechaModificacion = CURRENT_TIMESTAMP';
        const [resultado] = await conexion.execute(`
          UPDATE RespuestaEstudiante
          SET opcion_id = ?, ${fechas}
          WHERE id = ? AND sesion_id = ? AND decision_id = ?
        `, [opcionId, respuestaId, sesionId, decisionId]);
        return resultado.affectedRows;
      },
      async consultarRespuestas(sesionId) {
        // No exponer corrección ni puntuación durante la participación.
        const [filas] = await conexion.execute(`
          SELECT id, sesion_id AS sesionId, decision_id AS decisionId,
                 opcion_id AS opcionId, fechaRespuesta, fechaModificacion
          FROM RespuestaEstudiante
          WHERE sesion_id = ? AND opcion_id IS NOT NULL
          ORDER BY id
        `, [sesionId]);
        return filas;
      }
    };
  }

  return {
    ...consultas(pool),
    async enTransaccion(operacion) {
      const conexion = await pool.getConnection();
      try {
        await conexion.beginTransaction();
        const resultado = await operacion(consultas(conexion));
        await conexion.commit();
        return resultado;
      } catch (error) {
        try {
          await conexion.rollback();
        } catch (errorRollback) {
          // Conservar el error original aunque se haya perdido la conexión.
          error.cause ??= errorRollback;
        }
        throw error;
      } finally {
        conexion.release();
      }
    }
  };
}
