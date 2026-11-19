export function crearRepositorioActividades(pool) {
  if (
    !pool ||
    typeof pool.execute !== 'function' ||
    typeof pool.getConnection !== 'function'
  ) {
    throw new TypeError('Se requiere un pool de conexiones MySQL valido.');
  }

  function consultas(conexion) {
    return {
      async obtenerCaso(casoId) {
        const [filas] = await conexion.execute(
          `SELECT id, estado, tiempoEstimadoSegundos, titulo,
                  desarrolloSituacional, contextoHistoria
           FROM Caso
           WHERE id = ?
           FOR UPDATE`,
          [casoId]
        );

        return filas[0] ?? null;
      },

      async obtenerEspacioAcademico(espacioId) {
        const [filas] = await conexion.execute(
          `SELECT id, nombre, activo
           FROM EspacioAcademico
           WHERE id = ?
           FOR UPDATE`,
          [espacioId]
        );

        return filas[0] ?? null;
      },

      async obtenerDocente(docenteId) {
        const [filas] = await conexion.execute(
          `SELECT
             u.id,
             u.activo,
             EXISTS (
               SELECT 1
               FROM UsuarioRol ur
               INNER JOIN Rol r ON r.id = ur.rol_id
               WHERE ur.usuario_id = u.id
                 AND r.nombre IN ('Docente', 'Administrador')
             ) AS esDocente
           FROM Usuario u
           WHERE u.id = ?
           FOR UPDATE`,
          [docenteId]
        );

        return filas[0] ?? null;
      },

      async obtenerRubrica(rubricaId, casoId) {
        const [filas] = await conexion.execute(
          `SELECT id, caso_id AS casoId, activa
           FROM Rubrica
           WHERE id = ?
             AND caso_id = ?
           FOR UPDATE`,
          [rubricaId, casoId]
        );

        return filas[0] ?? null;
      },

      async obtenerEstudiantes(estudiantesIds) {
        if (!Array.isArray(estudiantesIds) || estudiantesIds.length === 0) {
          return [];
        }

        const marcadores = estudiantesIds.map(() => '?').join(', ');

        const [filas] = await conexion.execute(
          `SELECT
             u.id,
             u.correoInstitucional AS correo,
             u.activo,
             EXISTS (
               SELECT 1
               FROM UsuarioRol ur
               INNER JOIN Rol r ON r.id = ur.rol_id
               WHERE ur.usuario_id = u.id
                 AND r.nombre = 'Estudiante'
             ) AS esEstudiante
           FROM Usuario u
           WHERE u.id IN (${marcadores})
           ORDER BY u.id
           FOR UPDATE`,
          estudiantesIds
        );

        return filas;
      },

      async insertarActividad(actividad) {
        const [resultado] = await conexion.execute(
          `INSERT INTO ActividadProgramada (
             caso_id,
             espacioAcademico_id,
             docente_id,
             rubrica_id,
             fechaInicio,
             fechaFin,
             tiempoLimiteSegundos,
             lugar,
             mensajePersonalizado,
             intentosPermitidos,
             fechaCreacion,
             estado
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Programada')`,
          [
            actividad.casoId,
            actividad.espacioAcademicoId,
            actividad.docenteId,
            actividad.rubricaId,
            actividad.fechaInicio,
            actividad.fechaFin,
            actividad.tiempoLimiteSegundos,
            actividad.lugar ?? null,
            actividad.mensajePersonalizado ?? null,
            actividad.intentosPermitidos,
            actividad.fechaCreacion
          ]
        );

        return resultado.insertId;
      },

      async insertarEstudianteAutorizado({
        actividadId,
        estudianteId,
        codigoAutorizacion,
        fechaAutorizacion
      }) {
        const [resultado] = await conexion.execute(
          `INSERT INTO EstudianteAutorizado (
             actividad_id,
             estudiante_id,
             codigoAutorizacion,
             estado,
             fechaAutorizacion
           ) VALUES (?, ?, ?, 'Autorizado', ?)`,
          [
            actividadId,
            estudianteId,
            codigoAutorizacion,
            fechaAutorizacion
          ]
        );

        return resultado.insertId;
      },

      async obtenerAutorizacion(actividadId, estudianteId, bloquear = false) {
        const [filas] = await conexion.execute(
          `SELECT id, actividad_id AS actividadId, estudiante_id AS estudianteId,
                  codigoAutorizacion, estado, fechaAutorizacion
           FROM EstudianteAutorizado
           WHERE actividad_id = ? AND estudiante_id = ?${bloquear ? ' FOR UPDATE' : ''}`,
          [actividadId, estudianteId]
        );
        return filas[0] ?? null;
      },

      async reactivarAutorizacion({
        actividadId,
        estudianteId,
        codigoAutorizacion,
        fechaAutorizacion
      }) {
        const [resultado] = await conexion.execute(
          `UPDATE EstudianteAutorizado
           SET estado = 'Autorizado',
               codigoAutorizacion = ?,
               fechaAutorizacion = ?
           WHERE actividad_id = ? AND estudiante_id = ?`,
          [codigoAutorizacion, fechaAutorizacion, actividadId, estudianteId]
        );
        return resultado.affectedRows;
      },

      async actualizarEstadoAutorizacion(actividadId, estudianteId, estado) {
        const [resultado] = await conexion.execute(
          `UPDATE EstudianteAutorizado
           SET estado = ?
           WHERE actividad_id = ? AND estudiante_id = ?`,
          [estado, actividadId, estudianteId]
        );
        return resultado.affectedRows;
      },

      async upsertAsistencia(actividadId, estudianteId, estado, fecha) {
        await conexion.execute(
          `INSERT INTO Asistencia (actividad_id, estudiante_id, estado, fechaRegistro)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE estado = VALUES(estado), fechaRegistro = VALUES(fechaRegistro)`,
          [actividadId, estudianteId, estado, fecha]
        );
      }
    };
  }

  return {
    async enTransaccion(operacion) {
      if (typeof operacion !== 'function') {
        throw new TypeError('La operacion debe ser una funcion.');
      }

      const conexion = await pool.getConnection();
      let iniciada = false;

      try {
        await conexion.beginTransaction();
        iniciada = true;

        const resultado = await operacion(consultas(conexion));

        await conexion.commit();
        return resultado;
      } catch (error) {
        if (iniciada) {
          try {
            await conexion.rollback();
          } catch (errorRollback) {
            error.cause ??= errorRollback;
          }
        }

        throw error;
      } finally {
        conexion.release();
      }
    },

    async actualizarEstado(actividadId, estado, estadoAnterior) {
      const [resultado] = await pool.execute(
        `UPDATE ActividadProgramada
         SET estado = ?
         WHERE id = ? AND estado = ?`,
        [estado, actividadId, estadoAnterior]
      );

      return resultado.affectedRows;
    },

      async cerrarActividadesVencidas(fechaActual) {
      const [resultado] = await pool.execute(
        `UPDATE ActividadProgramada
         SET estado = 'Cerrada'
         WHERE estado = 'Iniciada'
           AND fechaFin <= DATE_SUB(?, INTERVAL 24 HOUR)`,
        [fechaActual]
      );

      return resultado.affectedRows;
    },

    async obtenerActividadPorId(actividadId) {
      const [filas] = await pool.execute(
        `SELECT
           a.id,
           a.caso_id AS casoId,
           a.espacioAcademico_id AS espacioAcademicoId,
           a.docente_id AS docenteId,
           a.rubrica_id AS rubricaId,
           a.fechaInicio,
           a.fechaFin,
           a.tiempoLimiteSegundos,
           a.lugar,
           a.mensajePersonalizado,
           a.intentosPermitidos,
           a.fechaCreacion,
           a.estado,
           c.titulo AS casoTitulo,
           e.nombre AS espacioAcademicoNombre,
           r.nombre AS rubricaNombre,
           u.nombres AS docenteNombres,
           u.apellidos AS docenteApellidos
         FROM ActividadProgramada a
         INNER JOIN Caso c ON c.id = a.caso_id
         INNER JOIN EspacioAcademico e ON e.id = a.espacioAcademico_id
         INNER JOIN Rubrica r ON r.id = a.rubrica_id
         INNER JOIN Usuario u ON u.id = a.docente_id
         WHERE a.id = ?`,
        [actividadId]
      );

      return filas[0] ?? null;
    },

    async listarEstudiantesAutorizados(actividadId) {
      const [filas] = await pool.execute(
        `SELECT
           ea.id,
           ea.actividad_id AS actividadId,
           ea.estudiante_id AS estudianteId,
           u.nombres,
           u.apellidos,
           ea.estado,
           ea.fechaAutorizacion
         FROM EstudianteAutorizado ea
         INNER JOIN Usuario u ON u.id = ea.estudiante_id
         WHERE ea.actividad_id = ?
         ORDER BY ea.id`,
        [actividadId]
      );

      return filas;
    },

    async listarPorDocente(docenteId) {
      const [filas] = await pool.execute(
        `${consultaListado} WHERE a.docente_id = ? ORDER BY a.fechaInicio DESC, a.id DESC`,
        [docenteId]
      );
      return filas;
    },

    async listarTodas() {
      const [filas] = await pool.execute(
        `${consultaListado} ORDER BY a.fechaInicio DESC, a.id DESC`
      );
      return filas;
    },

    async listarConvocatorias(actividadId) {
      const [filas] = await pool.execute(
        `SELECT n.id, n.usuario_id AS estudianteId, u.nombres, u.apellidos,
                n.tipo, n.canal, n.asunto, n.mensaje, n.url, n.estado,
                n.fechaCreacion, n.errorEnvio
         FROM Notificacion n
         INNER JOIN Usuario u ON u.id = n.usuario_id
         WHERE n.actividad_id = ? AND n.tipo IN ('Convocatoria', 'CambioConvocatoria')
         ORDER BY n.id`,
        [actividadId]
      );
      return filas;
    },

    async listarVencidasParaCierre(ahora) {
      const [filas] = await pool.execute(
        `SELECT id, docente_id AS docenteId, estado, fechaFin
         FROM ActividadProgramada
         WHERE estado IN ('Programada', 'Iniciada')
           AND TIMESTAMPADD(DAY, 1, fechaFin) <= ?
         ORDER BY id`,
        [ahora]
      );
      return filas;
    }
  };
}

const consultaListado = `
  SELECT
    a.id,
    a.caso_id AS casoId,
    a.espacioAcademico_id AS espacioAcademicoId,
    a.docente_id AS docenteId,
    a.rubrica_id AS rubricaId,
    a.fechaInicio,
    a.fechaFin,
    a.tiempoLimiteSegundos,
    a.estado,
    c.titulo AS casoTitulo,
    e.nombre AS espacioAcademicoNombre
  FROM ActividadProgramada a
  INNER JOIN Caso c ON c.id = a.caso_id
  INNER JOIN EspacioAcademico e ON e.id = a.espacioAcademico_id
`;
