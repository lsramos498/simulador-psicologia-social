/**
 * Repositorio MySQL de casos (Stefanía Díaz — casos académicos).
 * RF-05 a RF-09: persistencia de casos, personajes, escenas, preguntas y opciones.
 * RF-17: persistencia de la rúbrica (criterios y niveles de desempeño).
 *
 * Solo accede a datos: no decide reglas de negocio (eso es de casos.service.js).
 * Recibe el pool de mysql2 desde afuera, así las pruebas pueden usar un pool
 * simulado sin MySQL.
 *
 * Decisiones de diseño:
 *  - Todas las consultas son parametrizadas (`?`): nunca se concatenan valores
 *    del usuario, lo que evita inyección SQL.
 *  - Las mismas consultas funcionan sobre el pool (lectura suelta) o sobre una
 *    conexión con transacción (`enTransaccion`), por eso viven en `consultas()`.
 *  - Los UPDATE de estado y de datos básicos del caso incluyen el estado esperado en el WHERE,
 *    y devuelven `affectedRows` para que el servicio detecte carreras.
 */
import { errorCaso } from './caso.errores.js';

// MySQL devuelve los BOOLEAN/TINYINT como 0 o 1; el API los entrega como true/false.
function aBooleano(valor) {
  return valor === true || valor === 1;
}

// Los DECIMAL llegan como texto desde mysql2; se convierten a número (null se conserva).
function aNumero(valor) {
  return valor == null ? null : Number(valor);
}

/**
 * Traduce errores técnicos de MySQL a errores de dominio. Hoy solo cubre
 * ER_DUP_ENTRY (UNIQUE violado: mismo orden o mismo nombre) → `DUPLICADO` 409.
 * Cualquier otro error se devuelve igual y la ruta lo responderá como 500.
 * @param {Error & { code?: string }} error
 * @returns {Error} Error de dominio o el original.
 */
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

/**
 * Convierte una fila de la tabla Caso al objeto del API, con las listas de
 * personajes y escenas vacías y la rúbrica en null (las llena `obtenerCompleto`).
 */
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

/**
 * Ejecuta una consulta `... IN (?, ?, ...)` armando los marcadores según la
 * cantidad de ids. Con una lista vacía devuelve [] sin consultar (un `IN ()`
 * vacío sería un error de sintaxis en MySQL).
 * @param {object} conexion  Pool o conexión de mysql2.
 * @param {number[]} ids  Valores para el IN.
 * @param {string} sql  Consulta que termina justo antes del paréntesis del IN.
 * @returns {Promise<object[]>} Filas encontradas.
 */
async function consultarPorIds(conexion, ids, sql) {
  if (!ids.length) {
    return [];
  }
  const marcas = ids.map(() => '?').join(', ');
  const [filas] = await conexion.execute(`${sql} (${marcas})`, ids);
  return filas;
}

/**
 * Fábrica del repositorio de casos.
 *
 * El objeto devuelto expone las mismas consultas que recibe el callback de
 * `enTransaccion` (ver `consultas`), más `enTransaccion` en sí. Las lecturas
 * sueltas se hacen sobre el pool; las escrituras deben hacerse dentro de
 * `enTransaccion` para que sean atómicas.
 *
 * @param {object} pool  Pool de mysql2/promise (requiere `execute` y `getConnection`).
 * @returns {object} Repositorio de casos.
 * @throws {TypeError} Si `pool` no tiene la forma esperada.
 */
export function crearRepositorioCasos(pool) {
  if (!pool || typeof pool.execute !== 'function' || typeof pool.getConnection !== 'function') {
    throw new TypeError('Se requiere un pool de MySQL.');
  }

    /**
     * Construye el conjunto de consultas sobre una conexión dada (pool o
     * conexión transaccional). Así el mismo código sirve dentro y fuera de una
     * transacción. `this` apunta a este objeto, por eso los métodos compuestos
     * (p. ej. guardarCasoCompleto) llaman a los demás con `this.`.
     * @param {object} conexion  Pool o conexión con `execute`.
     */
  function consultas(conexion) {
    return {
      /**
       * Busca un usuario y confirma que esté activo.
       * @param {number} usuarioId
       * @returns {Promise<{ id: number }|null>} null si no existe o está inactivo.
       */
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

      /**
       * Lista casos en resumen, del más reciente al más antiguo. Ambos filtros son
       * opcionales (null = sin filtrar). Incluye `rubricaId` de la rúbrica activa
       * más reciente (o null) para que Actividades sepa qué rúbrica usar.
       * @param {{ creadorId?: number|null, estado?: string|null }} [filtros]
       * @returns {Promise<Array<{ id: number, creadorId: number, titulo: string, estado: string,
       *   tiempoEstimadoSegundos: number, fechaCreacion: Date, rubricaId: number|null }>>}
       */
      async listar({ creadorId = null, estado = null } = {}) {
        const [filas] = await conexion.execute(
          `SELECT c.id, c.creador_id AS creadorId, c.titulo, c.estado,
                  c.tiempoEstimadoSegundos, c.fechaCreacion,
                  (
                    SELECT r.id
                    FROM Rubrica r
                    WHERE r.caso_id = c.id AND r.activa = TRUE
                    ORDER BY r.version DESC, r.id DESC
                    LIMIT 1
                  ) AS rubricaId
           FROM Caso c
           WHERE (? IS NULL OR c.creador_id = ?)
             AND (? IS NULL OR c.estado = ?)
           ORDER BY c.fechaCreacion DESC, c.id DESC`,
          [creadorId, creadorId, estado, estado]
        );
        return filas.map((fila) => ({
          id: fila.id,
          creadorId: fila.creadorId,
          titulo: fila.titulo,
          estado: fila.estado,
          tiempoEstimadoSegundos: Number(fila.tiempoEstimadoSegundos),
          fechaCreacion: fila.fechaCreacion,
          rubricaId: fila.rubricaId == null ? null : Number(fila.rubricaId)
        }));
      },

      /**
       * Obtiene solo los datos básicos de un caso (sin escenas ni rúbrica).
       * @param {number} casoId
       * @param {boolean} [bloquear=false]  Si es true usa `FOR UPDATE` para bloquear
       *   la fila hasta el fin de la transacción (evita ediciones simultáneas).
       *   Solo tiene sentido dentro de `enTransaccion`.
       * @returns {Promise<object|null>} El caso o null si no existe.
       */
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

      /** Devuelve `{ id, casoId }` de la escena, para verificar a qué caso pertenece (o null). */
      async obtenerEscena(escenaId) {
        const [filas] = await conexion.execute(
          `SELECT id, caso_id AS casoId
           FROM Escena
           WHERE id = ?`,
          [escenaId]
        );
        return filas[0] ?? null;
      },

      /** Devuelve `{ id, casoId }` de la pregunta, resolviendo el caso por su escena (o null). */
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

      /** Devuelve `{ id, casoId }` del personaje, para verificar su caso (o null). */
      async obtenerPersonaje(personajeId) {
        const [filas] = await conexion.execute(
          `SELECT id, caso_id AS casoId
           FROM Personaje
           WHERE id = ?`,
          [personajeId]
        );
        return filas[0] ?? null;
      },

      /** Devuelve `{ id, decisionId, casoId }` de la opción, resolviendo el caso por pregunta y escena (o null). */
      async obtenerOpcion(opcionId) {
        const [filas] = await conexion.execute(
          `SELECT o.id, o.decision_id AS decisionId, e.caso_id AS casoId
           FROM OpcionDecision o
           INNER JOIN Decision d ON d.id = o.decision_id
           INNER JOIN Escena e ON e.id = d.escena_id
           WHERE o.id = ?`,
          [opcionId]
        );
        return filas[0] ?? null;
      },

      /**
       * Inserta un caso nuevo siempre en estado 'Borrador'.
       * @param {{ creadorId: number, titulo: string, desarrolloSituacional: string,
       *   contextoHistoria: string, tiempoEstimadoSegundos: number }} caso
       * @returns {Promise<number>} Id del caso creado.
       */
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

      /**
       * Actualiza los datos básicos de un caso, solo si sigue en 'Borrador'.
       * @returns {Promise<number>} Filas afectadas (0 si ya no era Borrador o no existe).
       */
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

      /**
       * Cambia el estado de un caso solo si está en `estadoActual` (compare-and-set).
       * Así dos publicaciones o archivados simultáneos no se pisan.
       * @param {number} casoId
       * @param {string} estado  Estado nuevo.
       * @param {string} estadoActual  Estado que debe tener el caso en este momento.
       * @returns {Promise<number>} Filas afectadas (0 si el estado ya había cambiado).
       */
      async actualizarEstado(casoId, estado, estadoActual) {
        const [resultado] = await conexion.execute(
          `UPDATE Caso
           SET estado = ?, fechaActualizacion = ?
           WHERE id = ? AND estado = ?`,
          [estado, new Date(), casoId, estadoActual]
        );
        return resultado.affectedRows;
      },

      /** Inserta un personaje en el caso. @returns {Promise<number>} Id del personaje. */
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

      /** Inserta una escena (solo la escena, no sus preguntas). @returns {Promise<number>} Id de la escena. */
      async insertarEscena(casoId, escena) {
        const [resultado] = await conexion.execute(
          `INSERT INTO Escena (caso_id, nombre, contexto, \`orden\`, esFinal)
           VALUES (?, ?, ?, ?, ?)`,
          [casoId, escena.nombre, escena.contexto, escena.orden, escena.esFinal]
        );
        return resultado.insertId;
      },

      /** Actualiza nombre, contexto, orden y marca final. @returns {Promise<number>} Filas afectadas. */
      async actualizarEscena(escenaId, escena) {
        const [resultado] = await conexion.execute(
          `UPDATE Escena
           SET nombre = ?, contexto = ?, \`orden\` = ?, esFinal = ?
           WHERE id = ?`,
          [escena.nombre, escena.contexto, escena.orden, escena.esFinal, escenaId]
        );
        return resultado.affectedRows;
      },

      /** Inserta una pregunta en la escena (sin opciones). @returns {Promise<number>} Id de la pregunta. */
      async insertarDecision(escenaId, decision) {
        const [resultado] = await conexion.execute(
          `INSERT INTO Decision (escena_id, pregunta, \`orden\`, ayuda)
           VALUES (?, ?, ?, ?)`,
          [escenaId, decision.pregunta, decision.orden, decision.ayuda]
        );
        return resultado.insertId;
      },

      /** Actualiza pregunta, orden y ayuda. @returns {Promise<number>} Filas afectadas. */
      async actualizarDecision(decisionId, decision) {
        const [resultado] = await conexion.execute(
          `UPDATE Decision
           SET pregunta = ?, \`orden\` = ?, ayuda = ?
           WHERE id = ?`,
          [decision.pregunta, decision.orden, decision.ayuda, decisionId]
        );
        return resultado.affectedRows;
      },

      /**
       * Inserta una opción y su retroalimentación (explicación y fundamento teórico)
       * en la tabla Retroalimentacion. Ambas inserciones deben ir en la misma transacción.
       * @returns {Promise<number>} Id de la opción.
       */
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

      /**
       * Actualiza la opción y su retroalimentación; si la opción no tenía
       * retroalimentación previa, la crea.
       * @returns {Promise<number>} Filas afectadas en OpcionDecision.
       */
      async actualizarOpcion(opcionId, opcion) {
        const [resultado] = await conexion.execute(
          `UPDATE OpcionDecision
           SET texto = ?, esCorrecta = ?, consecuencia = ?, \`orden\` = ?
           WHERE id = ?`,
          [opcion.texto, opcion.esCorrecta, opcion.consecuencia, opcion.orden, opcionId]
        );

        const [retro] = await conexion.execute(
          `UPDATE Retroalimentacion
           SET explicacion = ?, fundamentoTeorico = ?
           WHERE opcion_id = ?`,
          [opcion.explicacion, opcion.fundamentoTeorico, opcionId]
        );

        if (!retro.affectedRows) {
          await conexion.execute(
            `INSERT INTO Retroalimentacion (
               decision_id, opcion_id, explicacion, fundamentoTeorico
             ) VALUES (NULL, ?, ?, ?)`,
            [opcionId, opcion.explicacion, opcion.fundamentoTeorico]
          );
        }

        return resultado.affectedRows;
      },

      /** Vincula un personaje con una escena (tabla EscenaPersonaje). Falla con ER_DUP_ENTRY si ya estaba vinculado. */
      async asociarPersonaje(escenaId, personajeId) {
        await conexion.execute(
          `INSERT INTO EscenaPersonaje (escena_id, personaje_id)
           VALUES (?, ?)`,
          [escenaId, personajeId]
        );
      },

      /**
       * Guarda la rúbrica del caso como una NUEVA versión activa (RF-17):
       * calcula la versión siguiente, desactiva las anteriores y escribe criterios
       * y niveles. Los criterios se reutilizan por nombre (CriterioEvaluacion es un
       * catálogo único); si no existen se crean. Debe ejecutarse en transacción.
       * @param {number} casoId
       * @param {{ nombre: string, descripcion: string|null, criterios: object[] }} rubrica  Ya validada.
       * @returns {Promise<number>} Id de la rúbrica creada.
       */
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

      /**
       * Guarda el agregado completo en este orden: caso → personajes → escenas
       * (con sus personajes asociados, preguntas y opciones) → rúbrica. Reconstruye
       * la asociación escena-personaje a partir del nombre (sin distinguir
       * mayúsculas). Debe llamarse dentro de `enTransaccion` para que sea todo o nada.
       * @param {object} caso  Caso validado por `validarCaso` / `CasoBuilder.build()`.
       * @returns {Promise<object>} El caso completo recién guardado.
       * @throws {Error} `PERSONAJE_AJENO` (422) si una escena nombra un personaje inexistente.
       */
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

      /**
       * Arma el caso completo: datos básicos, personajes, escenas ordenadas, preguntas,
       * opciones con su explicación, personajes por escena y rúbrica activa con sus
       * criterios y niveles. Usa una consulta por tabla (con IN) y une los resultados
       * en memoria, para evitar una consulta por cada escena o pregunta (problema N+1).
       *
       * Nota: devuelve `esCorrecta` y las explicaciones; ocultarlos a estudiantes
       * es responsabilidad de la ruta (`routes/casos.routes.js`).
       * @param {number} casoId
       * @param {boolean} [bloquear=false]  Bloquea la fila del caso (FOR UPDATE).
       * @returns {Promise<object|null>} El caso completo o null si no existe.
       */
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
    /**
     * Ejecuta `operacion` dentro de una transacción MySQL: toma una conexión,
     * hace BEGIN, y al terminar COMMIT; si algo falla hace ROLLBACK y relanza el
     * error (traducido por `traducirMysql`). Siempre libera la conexión.
     * @template T
     * @param {(tx: object) => Promise<T>} operacion  Recibe las consultas ligadas a la conexión.
     * @returns {Promise<T>} Lo que devuelva `operacion`.
     * @throws {Error} El error original (o `DUPLICADO` 409) tras el rollback.
     */
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
