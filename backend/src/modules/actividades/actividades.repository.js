
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
          `SELECT id, estado, tiempoEstimadoSegundos
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
                 AND r.nombre = 'Docente'
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
             u.nombres,
             u.apellidos,
             u.correoInstitucional,
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
             fechaCreacion
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    }
  };
}

