export function crearRepositorioSesiones(pool) {
  if (!pool || typeof pool.getConnection !== 'function') {
    throw new TypeError('Se requiere una conexión a la base de datos (pool de MySQL).');
  }

  function consultas(conexion) {
    const sesionSelect = `
      SELECT s.id, s.actividad_id AS actividadId, s.estudiante_id AS estudianteId,
             s.numeroIntento, s.estado, s.inicio, s.fin, s.segundosConsumidos, s.motivoCierre,
             a.docente_id AS docenteId, a.estado AS estadoActividad,
             a.fechaInicio, a.fechaFin, a.tiempoLimiteSegundos,
             a.rubrica_id AS rubricaId, a.caso_id AS casoId
      FROM SesionSimulacion s
      INNER JOIN ActividadProgramada a ON a.id = s.actividad_id
    `;

    return {
      async obtenerPorId(sesionId, bloquear = false) {
        const [filas] = await conexion.execute(
          `${sesionSelect} WHERE s.id = ?${bloquear ? ' FOR UPDATE' : ''}`,
          [sesionId]
        );
        return filas[0] ?? null;
      },

      /**
       * Bloqueos RF-23 en orden: Actividad → Autorización → Sesión.
       * Devuelve el contexto que consume validarSesionParaResponder().
       */
      async obtenerContextoParaResponder(sesionId, estudianteId) {
        const [sesiones] = await conexion.execute(
          `SELECT s.id, s.actividad_id AS actividadId, s.estudiante_id AS estudianteId
           FROM SesionSimulacion s
           WHERE s.id = ?`,
          [sesionId]
        );
        const base = sesiones[0];
        if (!base) {
          return null;
        }

        const [actividades] = await conexion.execute(
          `SELECT id, estado AS estadoActividad, fechaInicio, fechaFin,
                  tiempoLimiteSegundos, caso_id AS casoId
           FROM ActividadProgramada
           WHERE id = ?
           FOR UPDATE`,
          [base.actividadId]
        );
        const actividad = actividades[0];
        if (!actividad) {
          return null;
        }

        const [autorizaciones] = await conexion.execute(
          `SELECT estado AS estadoAutorizacion
           FROM EstudianteAutorizado
           WHERE actividad_id = ? AND estudiante_id = ?
           FOR UPDATE`,
          [base.actividadId, estudianteId]
        );

        const [sesionBloqueada] = await conexion.execute(
          `${sesionSelect} WHERE s.id = ? FOR UPDATE`,
          [sesionId]
        );
        const sesion = sesionBloqueada[0];
        if (!sesion) {
          return null;
        }

        return {
          ...sesion,
          estadoActividad: actividad.estadoActividad,
          fechaInicio: actividad.fechaInicio,
          fechaFin: actividad.fechaFin,
          tiempoLimiteSegundos: actividad.tiempoLimiteSegundos,
          casoId: actividad.casoId,
          estadoAutorizacion: autorizaciones[0]?.estadoAutorizacion ?? null
        };
      },

      async obtenerPorEstudiante(actividadId, estudianteId) {
        const [filas] = await conexion.execute(
          `${sesionSelect}
           WHERE s.actividad_id = ? AND s.estudiante_id = ?
           ORDER BY s.numeroIntento DESC
           LIMIT 1`,
          [actividadId, estudianteId]
        );
        return filas[0] ?? null;
      },

      async listarVencidas(ahora) {
        const [filas] = await conexion.execute(
          `${sesionSelect}
           WHERE s.estado IN ('En curso', 'Sin iniciar')
             AND (
               (s.estado = 'En curso' AND s.inicio IS NOT NULL
                 AND TIMESTAMPADD(SECOND, a.tiempoLimiteSegundos, s.inicio) <= ?)
               OR TIMESTAMPADD(DAY, 1, a.fechaFin) <= ?
             )`,
          [ahora, ahora]
        );
        return filas;
      },

      async guardar(sesion, estadoAnterior) {
        const [resultado] = await conexion.execute(
          `UPDATE SesionSimulacion
           SET estado = ?, inicio = ?, fin = ?, segundosConsumidos = ?, motivoCierre = ?
           WHERE id = ? AND estado = ?`,
          [
            sesion.estado,
            sesion.inicio,
            sesion.fin,
            sesion.segundosConsumidos,
            sesion.motivoCierre,
            sesion.id,
            estadoAnterior
          ]
        );
        return resultado.affectedRows;
      },

      async datosParaEvaluar(casoId, sesionId, rubricaId) {
        const [preguntas] = await conexion.execute(
          `SELECT d.id AS decisionId, o.id AS opcionCorrectaId
           FROM Decision d
           INNER JOIN Escena e ON e.id = d.escena_id
           LEFT JOIN OpcionDecision o ON o.decision_id = d.id AND o.esCorrecta = 1
           WHERE e.caso_id = ?`,
          [casoId]
        );
        const [respuestas] = await conexion.execute(
          `SELECT decision_id AS decisionId, opcion_id AS opcionId
           FROM RespuestaEstudiante
           WHERE sesion_id = ? AND opcion_id IS NOT NULL`,
          [sesionId]
        );
        const [criterios] = await conexion.execute(
          `SELECT criterio_id AS criterioId, rubrica_id AS rubricaId, ponderacion, puntajeMaximo
           FROM RubricaCriterio
           WHERE rubrica_id = ?`,
          [rubricaId]
        );
        return { preguntas, respuestas, criterios };
      },

      async marcarRespuestas(sesionId) {
        await conexion.execute(
          `UPDATE RespuestaEstudiante r
           INNER JOIN OpcionDecision o ON o.id = r.opcion_id
           SET r.esCorrecta = o.esCorrecta,
               r.puntuacionObtenida = IF(o.esCorrecta = 1, 1, 0)
           WHERE r.sesion_id = ?`,
          [sesionId]
        );
      },

      async insertarEvaluacion({
        sesionId,
        actividadId,
        rubricaId,
        resultado,
        retroalimentacionGeneral,
        fecha
      }) {
        const [creada] = await conexion.execute(
          `INSERT INTO Evaluacion
             (sesion_id, actividad_id, rubrica_id, fechaEvaluacion, resultado, retroalimentacionGeneral)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [sesionId, actividadId, rubricaId, fecha, resultado, retroalimentacionGeneral]
        );
        return creada.insertId;
      },

      async insertarCriterios(evaluacionId, criterios) {
        for (const criterio of criterios) {
          await conexion.execute(
            `INSERT INTO ResultadoCriterio
               (evaluacion_id, rubrica_id, criterio_id, puntuacion, observacion)
             VALUES (?, ?, ?, ?, ?)`,
            [
              evaluacionId,
              criterio.rubricaId,
              criterio.criterioId,
              criterio.puntuacion,
              criterio.observacion
            ]
          );
        }
      },

      async insertarNotificacion({
        usuarioId,
        actividadId,
        sesionId,
        tipo,
        asunto,
        mensaje,
        fecha
      }) {
        await conexion.execute(
          `INSERT INTO Notificacion
             (usuario_id, actividad_id, sesion_id, tipo, canal, asunto, mensaje,
              estado, fechaCreacion, fechaEnvio)
           VALUES (?, ?, ?, ?, 'Sistema', ?, ?, 'Enviada', ?, ?)`,
          [usuarioId, actividadId, sesionId, tipo, asunto, mensaje, fecha, fecha]
        );
      },

      async actualizarAsistencia(actividadId, estudianteId, estado) {
        await conexion.execute(
          `UPDATE Asistencia
           SET estado = ?, fechaRegistro = NOW()
           WHERE actividad_id = ? AND estudiante_id = ?`,
          [estado, actividadId, estudianteId]
        );
      },

      async obtenerEvaluacion(sesionId) {
        const [filas] = await conexion.execute(
          `SELECT e.id, e.resultado, e.retroalimentacionGeneral, e.fechaEvaluacion,
                  rc.criterio_id AS criterioId, rc.puntuacion, rc.observacion
           FROM Evaluacion e
           LEFT JOIN ResultadoCriterio rc ON rc.evaluacion_id = e.id
           WHERE e.sesion_id = ?
           ORDER BY rc.criterio_id`,
          [sesionId]
        );
        if (filas.length === 0) return null;
        return {
          id: filas[0].id,
          resultado: Number(filas[0].resultado),
          retroalimentacionGeneral: filas[0].retroalimentacionGeneral,
          fechaEvaluacion: filas[0].fechaEvaluacion,
          criterios: filas
            .filter((fila) => fila.criterioId != null)
            .map((fila) => ({
              criterioId: fila.criterioId,
              puntuacion: Number(fila.puntuacion),
              observacion: fila.observacion
            }))
        };
      }
    };
  }

  /**
   * Consulta la actividad y bloquea su registro
   * para evitar modificaciones simultáneas.
   */
  async function obtenerActividad(conexion, actividadId) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          docente_id,
          fechaInicio,
          fechaFin,
          tiempoLimiteSegundos,
          intentosPermitidos,
          estado
       FROM ActividadProgramada
       WHERE id = ?
       FOR UPDATE`,
      [actividadId]
    );

    return filas[0] ?? null;
  }

  /**
   * Verifica que el estudiante esté autorizado
   * para participar en la actividad.
   */
  async function obtenerAutorizacion(conexion, actividadId, estudianteId) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          actividad_id,
          estudiante_id,
          estado
       FROM EstudianteAutorizado
       WHERE actividad_id = ?
         AND estudiante_id = ?
       FOR UPDATE`,
      [actividadId, estudianteId]
    );

    return filas[0] ?? null;
  }

  /**
   * Recupera la última sesión del estudiante
   * dentro de una actividad.
   */
  async function obtenerUltimaSesion(conexion, actividadId, estudianteId) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          actividad_id,
          estudiante_id,
          numeroIntento,
          estado,
          inicio,
          fin,
          segundosConsumidos,
          motivoCierre
       FROM SesionSimulacion
       WHERE actividad_id = ?
         AND estudiante_id = ?
       ORDER BY numeroIntento DESC
       LIMIT 1
       FOR UPDATE`,
      [actividadId, estudianteId]
    );

    return filas[0] ?? null;
  }

  async function obtenerSesionPorId(conexion, sesionId) {
    const [filas] = await conexion.execute(
      `SELECT
          id,
          actividad_id,
          estudiante_id,
          numeroIntento,
          estado,
          inicio,
          fin,
          segundosConsumidos,
          motivoCierre
       FROM SesionSimulacion
       WHERE id = ?
       FOR UPDATE`,
      [sesionId]
    );

    return filas[0] ?? null;
  }

  /**
   * Inserta una sesión individual.
   */
  async function insertarSesion(conexion, sesion) {
    const [resultado] = await conexion.execute(
      `INSERT INTO SesionSimulacion (
          actividad_id,
          estudiante_id,
          numeroIntento,
          estado,
          inicio,
          fin,
          segundosConsumidos,
          motivoCierre
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sesion.actividadId,
        sesion.estudianteId,
        sesion.numeroIntento,
        sesion.estado,
        sesion.inicio,
        sesion.fin,
        sesion.segundosConsumidos,
        sesion.motivoCierre
      ]
    );

    return {
      ...sesion,
      id: resultado.insertId
    };
  }

  /**
   * Actualiza el estado y los datos de una sesión.
   */
  async function actualizarSesion(conexion, sesion) {
    const [resultado] = await conexion.execute(
      `UPDATE SesionSimulacion
       SET estado = ?,
           inicio = ?,
           fin = ?,
           segundosConsumidos = ?,
           motivoCierre = ?
       WHERE id = ?`,
      [
        sesion.estado,
        sesion.inicio,
        sesion.fin,
        sesion.segundosConsumidos,
        sesion.motivoCierre,
        sesion.id
      ]
    );

    if (resultado.affectedRows !== 1) {
      throw new Error('No fue posible actualizar la sesión.');
    }

    return sesion;
  }

  return {
    ...consultas(pool),

    async preparar(actividadId) {
      const conexion = await pool.getConnection();
      try {
        await conexion.beginTransaction();
        const [sesiones] = await conexion.execute(
          `INSERT INTO SesionSimulacion
             (actividad_id, estudiante_id, numeroIntento, estado, segundosConsumidos)
           SELECT ea.actividad_id, ea.estudiante_id, 1, 'Sin iniciar', 0
           FROM EstudianteAutorizado ea
           WHERE ea.actividad_id = ?
             AND ea.estado = 'Autorizado'
             AND NOT EXISTS (
               SELECT 1 FROM SesionSimulacion s
               WHERE s.actividad_id = ea.actividad_id
                 AND s.estudiante_id = ea.estudiante_id
                 AND s.numeroIntento = 1
             )`,
          [actividadId]
        );
        const [asistencias] = await conexion.execute(
          `INSERT INTO Asistencia (actividad_id, estudiante_id, estado, fechaRegistro)
           SELECT ea.actividad_id, ea.estudiante_id, 'Convocado', NOW()
           FROM EstudianteAutorizado ea
           WHERE ea.actividad_id = ?
             AND ea.estado = 'Autorizado'
             AND NOT EXISTS (
               SELECT 1 FROM Asistencia a
               WHERE a.actividad_id = ea.actividad_id
                 AND a.estudiante_id = ea.estudiante_id
             )`,
          [actividadId]
        );
        await conexion.commit();
        return {
          sesionesCreadas: sesiones.affectedRows,
          asistenciasCreadas: asistencias.affectedRows
        };
      } catch (error) {
        try {
          await conexion.rollback();
        } catch (errorRollback) {
          error.cause ??= errorRollback;
        }
        throw error;
      } finally {
        conexion.release();
      }
    },

    // Consultas con la conexión explícita (flujo iniciarSesion/finalizarSesion).
    obtenerActividad,
    obtenerAutorizacion,
    obtenerUltimaSesion,
    obtenerSesionPorId,
    insertarSesion,
    actualizarSesion,

    /**
     * Ejecuta una operación dentro de una transacción. El argumento recibido
     * expone las consultas por método (tx.obtenerPorId, ...) y además actúa
     * como conexión (tx.execute) para las funciones que reciben `conexion`.
     */
    async enTransaccion(operacion) {
      const conexion = await pool.getConnection();
      try {
        await conexion.beginTransaction();
        const tx = {
          ...consultas(conexion),
          execute: (sql, parametros) => conexion.execute(sql, parametros)
        };
        const resultado = await operacion(tx);
        await conexion.commit();
        return resultado;
      } catch (error) {
        try {
          await conexion.rollback();
        } catch (errorRollback) {
          error.cause ??= errorRollback;
        }
        throw error;
      } finally {
        conexion.release();
      }
    }
  };
}
