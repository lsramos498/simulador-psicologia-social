import { errorCaso } from './caso.errores.js';

function aBooleano(valor) {
  return valor === true || valor === 1;
}

function aNumero(valor) {
  return valor == null ? null : Number(valor);
}

function traducirMysql(error) {
  if (error?.code !== 'ER_DUP_ENTRY') {
    return error;
  }
  return errorCaso(
    'DUPLICADO',
    'Ya existe un registro con el mismo orden o el mismo nombre.',
    409
  );
}

function mapCaso(fila) {
  return {
    id: fila.id,
    creadorId: fila.creadorId,
    titulo: fila.titulo,
    desarrolloSituacional: fila.desarrolloSituacional,
    contextoHistoria: fila.contextoHistoria,
    tiempoEstimadoSegundos: Number(fila.tiempoEstimadoSegundos),
    estado: fila.estado,
    fechaCreacion: fila.fechaCreacion,
    fechaActualizacion: fila.fechaActualizacion,
    personajes: [],
    escenas: [],
    rubrica: null
  };
}

async function consultarPorIds(conexion, ids, sql) {
  if (!ids.length) {
    return [];
  }
  const marcas = ids.map(() => '?').join(', ');
  const [filas] = await conexion.execute(`${sql} (${marcas})`, ids);
  return filas;
}

export function crearRepositorioCasos(pool) {
  if (!pool || typeof pool.execute !== 'function' || typeof pool.getConnection !== 'function') {
    throw new TypeError('Se requiere un pool de MySQL.');
  }

  function consultas(conexion) {
    return {
      async obtenerUsuarioActivo(usuarioId) {
        const [filas] = await conexion.execute(
          `SELECT id, activo
           FROM Usuario
           WHERE id = ?
           LIMIT 1`,
          [usuarioId]
        );
        const fila = filas[0];
        if (!fila || !aBooleano(fila.activo)) {
          return null;
        }
        return { id: fila.id };
      },

      async listar(creadorId) {
        const [filas] = await conexion.execute(
          `SELECT id, creador_id AS creadorId, titulo, estado,
                  tiempoEstimadoSegundos, fechaCreacion
           FROM Caso
           WHERE (? IS NULL OR creador_id = ?)
           ORDER BY fechaCreacion DESC, id DESC`,
          [creadorId, creadorId]
        );
        return filas.map((fila) => ({
          id: fila.id,
          creadorId: fila.creadorId,
          titulo: fila.titulo,
          estado: fila.estado,
          tiempoEstimadoSegundos: Number(fila.tiempoEstimadoSegundos),
          fechaCreacion: fila.fechaCreacion
        }));
      },

      async obtenerPorId(casoId, bloquear = false) {
        const [filas] = await conexion.execute(
          `SELECT id, creador_id AS creadorId, titulo, desarrolloSituacional,
                  contextoHistoria, tiempoEstimadoSegundos, estado,
                  fechaCreacion, fechaActualizacion
           FROM Caso
           WHERE id = ?${bloquear ? ' FOR UPDATE' : ''}`,
          [casoId]
        );
        return filas[0] ? mapCaso(filas[0]) : null;
      },

      async obtenerEscena(escenaId) {
        const [filas] = await conexion.execute(
          `SELECT id, caso_id AS casoId
           FROM Escena
           WHERE id = ?`,
          [escenaId]
        );
        return filas[0] ?? null;
      },

      async obtenerDecision(decisionId) {
        const [filas] = await conexion.execute(
          `SELECT d.id, e.caso_id AS casoId
           FROM Decision d
           INNER JOIN Escena e ON e.id = d.escena_id
           WHERE d.id = ?`,
          [decisionId]
        );
        return filas[0] ?? null;
      },

      async obtenerPersonaje(personajeId) {
        const [filas] = await conexion.execute(
          `SELECT id, caso_id AS casoId
           FROM Personaje
           WHERE id = ?`,
          [personajeId]
        );
        return filas[0] ?? null;
      },

      async insertarCaso(caso) {
        const [resultado] = await conexion.execute(
          `INSERT INTO Caso (
             creador_id, titulo, desarrolloSituacional, contextoHistoria,
             tiempoEstimadoSegundos, estado, fechaCreacion
           ) VALUES (?, ?, ?, ?, ?, 'Borrador', ?)`,
          [
            caso.creadorId,
            caso.titulo,
            caso.desarrolloSituacional,
            caso.contextoHistoria,
            caso.tiempoEstimadoSegundos,
            new Date()
          ]
        );
        return resultado.insertId;
      },

      async actualizarCaso(casoId, datos) {
        const [resultado] = await conexion.execute(
          `UPDATE Caso
           SET titulo = ?, desarrolloSituacional = ?, contextoHistoria = ?,
               tiempoEstimadoSegundos = ?, fechaActualizacion = ?
           WHERE id = ? AND estado = 'Borrador'`,
          [
            datos.titulo,
            datos.desarrolloSituacional,
            datos.contextoHistoria,
            datos.tiempoEstimadoSegundos,
            new Date(),
            casoId
          ]
        );
        return resultado.affectedRows;
      },

      async actualizarEstado(casoId, estado, estadoActual) {
        const [resultado] = await conexion.execute(
          `UPDATE Caso
           SET estado = ?, fechaActualizacion = ?
           WHERE id = ? AND estado = ?`,
          [estado, new Date(), casoId, estadoActual]
        );
        return resultado.affectedRows;
      },

      async insertarPersonaje(casoId, personaje) {
        const [resultado] = await conexion.execute(
          `INSERT INTO Personaje (
             caso_id, nombre, rolSocial, perfil, pautasComportamiento
           ) VALUES (?, ?, ?, ?, ?)`,
          [
            casoId,
            personaje.nombre,
            personaje.rolSocial,
            personaje.perfil,
            personaje.pautasComportamiento
          ]
        );
        return resultado.insertId;
      },

      async insertarEscena(casoId, escena) {
        const [resultado] = await conexion.execute(
          `INSERT INTO Escena (caso_id, nombre, contexto, \`orden\`, esFinal)
           VALUES (?, ?, ?, ?, ?)`,
          [casoId, escena.nombre, escena.contexto, escena.orden, escena.esFinal]
        );
        return resultado.insertId;
      },

      async insertarDecision(escenaId, decision) {
        const [resultado] = await conexion.execute(
          `INSERT INTO Decision (escena_id, pregunta, \`orden\`, ayuda)
           VALUES (?, ?, ?, ?)`,
          [escenaId, decision.pregunta, decision.orden, decision.ayuda]
        );
        return resultado.insertId;
      },

      async insertarOpcion(decisionId, opcion) {
        const [resultado] = await conexion.execute(
          `INSERT INTO OpcionDecision (
             decision_id, texto, esCorrecta, consecuencia, \`orden\`
           ) VALUES (?, ?, ?, ?, ?)`,
          [decisionId, opcion.texto, opcion.esCorrecta, opcion.consecuencia, opcion.orden]
        );
        const opcionId = resultado.insertId;
        await conexion.execute(
          `INSERT INTO Retroalimentacion (
             decision_id, opcion_id, explicacion, fundamentoTeorico
           ) VALUES (NULL, ?, ?, ?)`,
          [opcionId, opcion.explicacion, opcion.fundamentoTeorico]
        );
        return opcionId;
      },

      async asociarPersonaje(escenaId, personajeId) {
        await conexion.execute(
          `INSERT INTO EscenaPersonaje (escena_id, personaje_id)
           VALUES (?, ?)`,
          [escenaId, personajeId]
        );
      },

      async guardarRubrica(casoId, rubrica) {
        const [versiones] = await conexion.execute(
          `SELECT COALESCE(MAX(version), 0) AS version
           FROM Rubrica
           WHERE caso_id = ?`,
          [casoId]
        );
        const version = Number(versiones[0]?.version ?? 0) + 1;

        await conexion.execute(
          `UPDATE Rubrica
           SET activa = FALSE
           WHERE caso_id = ?`,
          [casoId]
        );

        const [resultado] = await conexion.execute(
          `INSERT INTO Rubrica (
             caso_id, nombre, descripcion, version, activa, fechaCreacion
           ) VALUES (?, ?, ?, ?, TRUE, ?)`,
          [casoId, rubrica.nombre, rubrica.descripcion, version, new Date()]
        );
        const rubricaId = resultado.insertId;

        for (const criterio of rubrica.criterios) {
          const [existentes] = await conexion.execute(
            `SELECT id
             FROM CriterioEvaluacion
             WHERE nombre = ?
             LIMIT 1`,
            [criterio.nombre]
          );

          let criterioId = existentes[0]?.id;
          if (!criterioId) {
            const [creado] = await conexion.execute(
              `INSERT INTO CriterioEvaluacion (nombre, descripcion)
               VALUES (?, ?)`,
              [criterio.nombre, criterio.descripcion]
            );
            criterioId = creado.insertId;
          }

          await conexion.execute(
            `INSERT INTO RubricaCriterio (
               rubrica_id, criterio_id, ponderacion, puntajeMaximo
             ) VALUES (?, ?, ?, ?)`,
            [rubricaId, criterioId, criterio.ponderacion, criterio.puntajeMaximo]
          );

          for (const nivel of criterio.niveles) {
            await conexion.execute(
              `INSERT INTO NivelDesempeno (
                 rubrica_id, criterio_id, nombre, descripcion, puntaje, \`orden\`
               ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                rubricaId,
                criterioId,
                nivel.nombre,
                nivel.descripcion,
                nivel.puntaje,
                nivel.orden
              ]
            );
          }
        }

        return rubricaId;
      },

      async guardarCasoCompleto(caso) {
        const casoId = await this.insertarCaso(caso);
        const personajesPorNombre = new Map();

        for (const personaje of caso.personajes) {
          const personajeId = await this.insertarPersonaje(casoId, personaje);
          personajesPorNombre.set(personaje.nombre.toLocaleLowerCase('es'), personajeId);
        }

        for (const escena of caso.escenas) {
          const escenaId = await this.insertarEscena(casoId, escena);
          for (const nombre of escena.personajes) {
            const personajeId = personajesPorNombre.get(nombre.toLocaleLowerCase('es'));
            if (!personajeId) {
              throw errorCaso(
                'PERSONAJE_AJENO',
                `El personaje «${nombre}» no pertenece al caso.`,
                422
              );
            }
            await this.asociarPersonaje(escenaId, personajeId);
          }

          for (const decision of escena.decisiones) {
            const decisionId = await this.insertarDecision(escenaId, decision);
            for (const opcion of decision.opciones) {
              await this.insertarOpcion(decisionId, opcion);
            }
          }
        }

        if (caso.rubrica) {
          await this.guardarRubrica(casoId, caso.rubrica);
        }

        return this.obtenerCompleto(casoId);
      },

      async obtenerCompleto(casoId, bloquear = false) {
        const caso = await this.obtenerPorId(casoId, bloquear);
        if (!caso) {
          return null;
        }

        const [escenas] = await conexion.execute(
          `SELECT id, nombre, contexto, \`orden\` AS orden, esFinal
           FROM Escena
           WHERE caso_id = ?
           ORDER BY \`orden\`, id`,
          [casoId]
        );

        const escenaIds = escenas.map((escena) => escena.id);
        const decisiones = await consultarPorIds(
          conexion,
          escenaIds,
          `SELECT id, escena_id AS escenaId, pregunta, \`orden\` AS orden, ayuda
           FROM Decision
           WHERE escena_id IN`
        );
        const decisionIds = decisiones.map((decision) => decision.id);
        const opciones = await consultarPorIds(
          conexion,
          decisionIds,
          `SELECT o.id, o.decision_id AS decisionId, o.texto, o.esCorrecta,
                  o.consecuencia, o.\`orden\` AS orden,
                  r.explicacion, r.fundamentoTeorico
           FROM OpcionDecision o
           LEFT JOIN Retroalimentacion r ON r.opcion_id = o.id
           WHERE o.decision_id IN`
        );

        const [personajes] = await conexion.execute(
          `SELECT id, nombre, rolSocial, perfil, pautasComportamiento
           FROM Personaje
           WHERE caso_id = ?
           ORDER BY id`,
          [casoId]
        );
        const vinculos = await consultarPorIds(
          conexion,
          escenaIds,
          `SELECT ep.escena_id AS escenaId, p.id, p.nombre
           FROM EscenaPersonaje ep
           INNER JOIN Personaje p ON p.id = ep.personaje_id
           WHERE ep.escena_id IN`
        );

        const [rubricas] = await conexion.execute(
          `SELECT id, nombre, descripcion, version, activa, fechaCreacion
           FROM Rubrica
           WHERE caso_id = ? AND activa = TRUE
           ORDER BY version DESC
           LIMIT 1`,
          [casoId]
        );
        const rubricaFila = rubricas[0] ?? null;
        let rubrica = null;

        if (rubricaFila) {
          const [criterios] = await conexion.execute(
            `SELECT rc.criterio_id AS id, c.nombre, c.descripcion,
                    rc.ponderacion, rc.puntajeMaximo
             FROM RubricaCriterio rc
             INNER JOIN CriterioEvaluacion c ON c.id = rc.criterio_id
             WHERE rc.rubrica_id = ?
             ORDER BY c.nombre`,
            [rubricaFila.id]
          );
          const [niveles] = await conexion.execute(
            `SELECT id, criterio_id AS criterioId, nombre, descripcion, puntaje, \`orden\` AS orden
             FROM NivelDesempeno
             WHERE rubrica_id = ?
             ORDER BY \`orden\`, id`,
            [rubricaFila.id]
          );

          rubrica = {
            id: rubricaFila.id,
            nombre: rubricaFila.nombre,
            descripcion: rubricaFila.descripcion,
            version: rubricaFila.version,
            activa: aBooleano(rubricaFila.activa),
            fechaCreacion: rubricaFila.fechaCreacion,
            criterios: criterios.map((criterio) => ({
              id: criterio.id,
              nombre: criterio.nombre,
              descripcion: criterio.descripcion,
              ponderacion: aNumero(criterio.ponderacion),
              puntajeMaximo: aNumero(criterio.puntajeMaximo),
              niveles: niveles
                .filter((nivel) => nivel.criterioId === criterio.id)
                .map((nivel) => ({
                  id: nivel.id,
                  nombre: nivel.nombre,
                  descripcion: nivel.descripcion,
                  puntaje: aNumero(nivel.puntaje),
                  orden: nivel.orden
                }))
            }))
          };
        }

        const opcionesPorDecision = new Map();
        for (const opcion of opciones) {
          const lista = opcionesPorDecision.get(opcion.decisionId) ?? [];
          lista.push({
            id: opcion.id,
            texto: opcion.texto,
            esCorrecta: aBooleano(opcion.esCorrecta),
            consecuencia: opcion.consecuencia,
            orden: opcion.orden,
            explicacion: opcion.explicacion,
            fundamentoTeorico: opcion.fundamentoTeorico
          });
          opcionesPorDecision.set(opcion.decisionId, lista);
        }

        const decisionesPorEscena = new Map();
        for (const decision of decisiones) {
          const lista = decisionesPorEscena.get(decision.escenaId) ?? [];
          lista.push({
            id: decision.id,
            pregunta: decision.pregunta,
            orden: decision.orden,
            ayuda: decision.ayuda,
            opciones: (opcionesPorDecision.get(decision.id) ?? [])
              .sort((a, b) => a.orden - b.orden)
          });
          decisionesPorEscena.set(decision.escenaId, lista);
        }

        const personajesPorEscena = new Map();
        for (const vinculo of vinculos) {
          const lista = personajesPorEscena.get(vinculo.escenaId) ?? [];
          lista.push({ id: vinculo.id, nombre: vinculo.nombre });
          personajesPorEscena.set(vinculo.escenaId, lista);
        }

        caso.personajes = personajes;
        caso.escenas = escenas.map((escena) => ({
          id: escena.id,
          nombre: escena.nombre,
          contexto: escena.contexto,
          orden: escena.orden,
          esFinal: aBooleano(escena.esFinal),
          personajes: personajesPorEscena.get(escena.id) ?? [],
          decisiones: (decisionesPorEscena.get(escena.id) ?? [])
            .sort((a, b) => a.orden - b.orden)
        }));
        caso.rubrica = rubrica;
        return caso;
      }
    };
  }

  const repositorio = consultas(pool);

  return {
    ...repositorio,
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
          error.cause ??= errorRollback;
        }
        throw traducirMysql(error);
      } finally {
        conexion.release();
      }
    }
  };
}
