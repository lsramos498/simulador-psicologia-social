// El pool se recibe desde config/database.js; este módulo no crea conexiones globales.
export function crearRepositorioParticipacion(pool) {
  function consultas(conexion) {
    return {
      async obtenerSesion(sesionId, bloquear = false, estudianteId = null) {
        if (!bloquear) {
          const [filas] = await conexion.execute(`
            SELECT s.id, s.actividad_id AS actividadId, s.estudiante_id AS estudianteId,
                   s.estado, s.inicio, a.caso_id AS casoId, a.tiempoLimiteSegundos,
                   a.estado AS estadoActividad, a.fechaInicio, a.fechaFin,
                   ea.estado AS estadoAutorizacion
            FROM SesionSimulacion s
            JOIN ActividadProgramada a ON a.id = s.actividad_id
            LEFT JOIN EstudianteAutorizado ea
              ON ea.actividad_id = s.actividad_id
             AND ea.estudiante_id = s.estudiante_id
            WHERE s.id = ?
          `, [sesionId]);
          return filas[0] ?? null;
        }

        // Bloqueos RF-23: Actividad → Autorización → Sesión.
        const [bases] = await conexion.execute(
          `SELECT actividad_id AS actividadId, estudiante_id AS estudianteId
           FROM SesionSimulacion
           WHERE id = ?`,
          [sesionId]
        );
        const base = bases[0];
        if (!base) {
          return null;
        }

        const estudiante = estudianteId ?? base.estudianteId;

        const [actividades] = await conexion.execute(
          `SELECT id, estado AS estadoActividad, fechaInicio, fechaFin,
                  tiempoLimiteSegundos, caso_id AS casoId
           FROM ActividadProgramada
           WHERE id = ?
           FOR UPDATE`,
          [base.actividadId]
        );
        if (!actividades[0]) {
          return null;
        }

        const [autorizaciones] = await conexion.execute(
          `SELECT estado AS estadoAutorizacion
           FROM EstudianteAutorizado
           WHERE actividad_id = ? AND estudiante_id = ?
           FOR UPDATE`,
          [base.actividadId, estudiante]
        );

        const [sesiones] = await conexion.execute(
          `SELECT s.id, s.actividad_id AS actividadId, s.estudiante_id AS estudianteId,
                  s.estado, s.inicio
           FROM SesionSimulacion s
           WHERE s.id = ?
           FOR UPDATE`,
          [sesionId]
        );
        const sesion = sesiones[0];
        if (!sesion) {
          return null;
        }

        return {
          ...sesion,
          casoId: actividades[0].casoId,
          tiempoLimiteSegundos: actividades[0].tiempoLimiteSegundos,
          estadoActividad: actividades[0].estadoActividad,
          fechaInicio: actividades[0].fechaInicio,
          fechaFin: actividades[0].fechaFin,
          estadoAutorizacion: autorizaciones[0]?.estadoAutorizacion ?? null
        };
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

      async obtenerRespuesta(sesionId, decisionId) {
        const [filas] = await conexion.execute(`
          SELECT id FROM RespuestaEstudiante
          WHERE sesion_id = ? AND decision_id = ?
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

      async actualizarRespuesta(respuestaId, opcionId) {
        const [resultado] = await conexion.execute(`
          UPDATE RespuestaEstudiante
          SET opcion_id = ?, fechaModificacion = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [opcionId, respuestaId]);
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
      },
      async contarPreguntas(casoId) {
        const [filas] = await conexion.execute(
          `SELECT COUNT(*) AS total
           FROM Decision d
           INNER JOIN Escena e ON e.id = d.escena_id
           WHERE e.caso_id = ?`,
          [casoId]
        );
        return Number(filas[0].total);
      },
      async contarRespuestas(sesionId) {
        const [filas] = await conexion.execute(
          `SELECT COUNT(*) AS total
           FROM RespuestaEstudiante
           WHERE sesion_id = ? AND opcion_id IS NOT NULL`,
          [sesionId]
        );
        return Number(filas[0].total);
      },
      async listarRetroalimentacion(sesionId) {
        const [filas] = await conexion.execute(
          `SELECT r.decision_id AS decisionId, r.opcion_id AS opcionId,
                  o.texto AS opcionTexto, rt.explicacion
           FROM RespuestaEstudiante r
           INNER JOIN OpcionDecision o ON o.id = r.opcion_id
           LEFT JOIN Retroalimentacion rt ON rt.opcion_id = o.id
           WHERE r.sesion_id = ?
           ORDER BY r.id`,
          [sesionId]
        );
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

        // Se entregan las consultas transaccionales y la conexión física.
        const resultado = await operacion(consultas(conexion), conexion);

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
