// El pool se recibe desde config/database.js; este módulo no crea conexiones globales.
export function crearRepositorioParticipacion(pool) {
  function consultas(conexion) {
    return {
      async obtenerSesion(sesionId, bloquear = false) {
        const [filas] = await conexion.execute(`
          SELECT s.id, s.estudiante_id AS estudianteId, s.estado,
                 a.caso_id AS casoId
          FROM sesionsimulacion s
          JOIN actividadprogramada a ON a.id = s.actividad_id
          WHERE s.id = ?${bloquear ? ' FOR UPDATE' : ''}
        `, [sesionId]);
        return filas[0] ?? null;
      },
      async opcionValida(casoId, decisionId, opcionId) {
        const [filas] = await conexion.execute(`
          SELECT o.id FROM opciondecision o
          JOIN decision d ON d.id = o.decision_id
          JOIN escena e ON e.id = d.escena_id
          WHERE e.caso_id = ? AND d.id = ? AND o.id = ?
        `, [casoId, decisionId, opcionId]);
        return filas.length > 0;
      },
      async existeRespuesta(sesionId, decisionId) {
        const [filas] = await conexion.execute(`
          SELECT id FROM respuestaestudiante
          WHERE sesion_id = ? AND decision_id = ?
        `, [sesionId, decisionId]);
        return filas.length > 0;
      },
      async insertarRespuesta({ sesionId, decisionId, opcionId }) {
        const [resultado] = await conexion.execute(`
          INSERT INTO respuestaestudiante
            (sesion_id, decision_id, opcion_id, fechaRespuesta)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [sesionId, decisionId, opcionId]);
        return resultado.insertId;
      },
      async consultarRespuestas(sesionId) {
        // No exponer corrección ni puntuación durante la participación.
        const [filas] = await conexion.execute(`
          SELECT id, sesion_id AS sesionId, decision_id AS decisionId,
                 opcion_id AS opcionId, fechaRespuesta, fechaModificacion
          FROM respuestaestudiante
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
