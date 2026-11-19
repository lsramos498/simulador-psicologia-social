/**
 * Servicio de casos (Stefanía Díaz — casos académicos).
 * RF-05 a RF-09: crear, editar, publicar y archivar casos situacionales.
 * RF-17: asociar la rúbrica de evaluación al caso.
 *
 * Capa de "casos de uso": orquesta validaciones (caso.validacion.js), reglas
 * de negocio y persistencia (casos.repository.js). No conoce HTTP ni SQL.
 *
 * Reglas de negocio que aplica este archivo:
 *  - Solo un caso en estado Borrador se puede modificar.
 *  - Solo el docente creador o un Administrador puede gestionarlo (CASO_AJENO).
 *  - Toda mutación corre dentro de una transacción; el caso se bloquea
 *    (FOR UPDATE) para evitar ediciones o publicaciones simultáneas.
 *  - Para publicar, el caso debe estar completo (ver validarParaPublicar).
 *
 * Los errores son de dominio (ver caso.errores.js): llevan `codigo` y
 * `statusCode` para que la ruta HTTP los traduzca sin lógica adicional.
 */
import { ROLES, tieneRol } from '../acceso/autorizacion.js';
import { construirCaso } from './caso.builder.js';
import { errorCaso } from './caso.errores.js';
import {
  ESTADOS_CASO,
  datosActualizacionDecision,
  datosActualizacionEscena,
  normalizarDecision,
  normalizarEscena,
  normalizarOpcion,
  normalizarPersonaje,
  normalizarRubrica,
  validarCaso,
  validarCreador,
  validarDatosBasicos,
  validarParaPublicar
} from './caso.validacion.js';

/**
 * Convierte un id recibido (número o texto de la URL) a entero positivo.
 * @param {number|string} valor  Id a validar.
 * @param {string} nombre  Nombre legible para el mensaje ('El caso', 'La escena'…).
 * @returns {number} El id como número.
 * @throws {Error} `ID_INVALIDO` (400) si no es un entero entre 1 y 2147483647.
 */
function exigirId(valor, nombre) {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 2147483647) {
    throw errorCaso('ID_INVALIDO', `${nombre} debe ser un entero positivo.`, 400);
  }
  return numero;
}

/**
 * Comprueba que haya un usuario autenticado que actúe sobre el caso.
 * @param {{ id: number, roles?: string[] }} actor  Usuario que deja el middleware en `req.usuario`.
 * @returns {object} El mismo actor.
 * @throws {Error} `NO_AUTORIZADO` (401) si no hay actor.
 */
function exigirActor(actor) {
  if (!actor || typeof actor !== 'object' || actor.id == null) {
    throw errorCaso(
      'NO_AUTORIZADO',
      'Se requiere un usuario autenticado para gestionar el caso.',
      401
    );
  }
  return actor;
}

/**
 * Regla de propiedad: solo el docente creador o un Administrador gestionan el caso.
 * @param {{ creadorId: number }} caso  Caso ya consultado.
 * @param {{ id: number, roles?: string[] }} actor  Usuario autenticado.
 * @throws {Error} `NO_AUTORIZADO` (401) sin actor; `CASO_AJENO` (403) si no es el creador.
 */
function exigirPropietarioOAdmin(caso, actor) {
  const usuario = exigirActor(actor);
  if (tieneRol(usuario, ROLES.ADMINISTRADOR)) {
    return;
  }
  if (Number(caso.creadorId) !== Number(usuario.id)) {
    throw errorCaso(
      'CASO_AJENO',
      'Solo el docente creador o un administrador pueden gestionar este caso.',
      403
    );
  }
}

/**
 * Verifica que el docente creador exista y esté activo antes de crear un caso.
 * @param {object} repositorio  Repositorio (o transacción) con `obtenerUsuarioActivo`.
 * @param {number} creadorId  Id del docente.
 * @throws {Error} `CREADOR_NO_EXISTE` (404) si no existe o está inactivo.
 */
async function exigirCreador(repositorio, creadorId) {
  const usuario = await repositorio.obtenerUsuarioActivo(creadorId);
  if (!usuario) {
    throw errorCaso(
      'CREADOR_NO_EXISTE',
      'El docente creador no existe o está inactivo.',
      404
    );
  }
}

/**
 * Precondición común de toda edición: bloquea el caso (FOR UPDATE), comprueba
 * propietario o admin y exige estado Borrador. Debe llamarse dentro de una transacción.
 * @param {object} tx  Consultas ligadas a la transacción en curso.
 * @param {number} casoId  Id del caso a editar.
 * @param {object} actor  Usuario autenticado.
 * @returns {Promise<object>} El caso (datos básicos) ya bloqueado.
 * @throws {Error} `CASO_NO_EXISTE` (404), `CASO_AJENO` (403) o `CASO_NO_EDITABLE` (409).
 */
async function exigirBorradorEditable(tx, casoId, actor) {
  const caso = await tx.obtenerPorId(casoId, true);
  if (!caso) {
    throw errorCaso('CASO_NO_EXISTE', 'No se encontró el caso.', 404);
  }
  exigirPropietarioOAdmin(caso, actor);
  if (caso.estado !== ESTADOS_CASO.BORRADOR) {
    throw errorCaso(
      'CASO_NO_EDITABLE',
      'Solo se puede modificar un caso en estado Borrador.',
      409
    );
  }
  return caso;
}

/**
 * Fábrica del servicio de casos. Recibe el repositorio por parámetro
 * (inyección de dependencias) para poder probar el servicio sin MySQL.
 *
 * Todos los métodos devuelven el caso completo actualizado (con escenas,
 * preguntas, opciones y rúbrica), salvo `listar`, que devuelve un resumen.
 *
 * @param {object} repositorio  Repositorio de casos (ver `crearRepositorioCasos`);
 *   debe exponer al menos `enTransaccion`.
 * @returns {object} Objeto con los casos de uso del módulo.
 * @throws {TypeError} Si el repositorio no es válido.
 */
export function crearServicioCasos(repositorio) {
  if (!repositorio || typeof repositorio.enTransaccion !== 'function') {
    throw new TypeError('Se requiere un repositorio de casos.');
  }

  return {
    /**
     * Lista casos en resumen (sin escenas), con filtros opcionales. Cada resumen
     * incluye `rubricaId` (rúbrica activa) para que Actividades pueda elegir
     * casos con `estado: 'Publicado'`.
     * @param {{ creadorId?: number|string, estado?: string }|number|string} [filtros]
     *   Objeto de filtros; por compatibilidad también se acepta solo el `creadorId`.
     * @returns {Promise<object[]>} Casos más recientes primero.
     * @throws {Error} `ID_INVALIDO` (400) o `ESTADO_INVALIDO` (400).
     */
    async listar(filtros) {
      let creadorId = null;
      let estado = null;

      if (filtros != null && typeof filtros === 'object' && !Array.isArray(filtros)) {
        creadorId = filtros.creadorId;
        estado = filtros.estado;
      } else {
        creadorId = filtros;
      }

      const filtroCreador = creadorId == null || creadorId === ''
        ? null
        : exigirId(creadorId, 'creadorId');

      let filtroEstado = null;
      if (estado != null && estado !== '') {
        const permitido = Object.values(ESTADOS_CASO);
        if (!permitido.includes(estado)) {
          throw errorCaso(
            'ESTADO_INVALIDO',
            `El estado debe ser uno de: ${permitido.join(', ')}.`,
            400
          );
        }
        filtroEstado = estado;
      }

      return repositorio.listar({ creadorId: filtroCreador, estado: filtroEstado });
    },

    /**
     * Obtiene un caso completo por id. No oculta respuestas correctas: eso lo
     * decide la ruta según el rol de quien consulta.
     * @param {number|string} casoId
     * @returns {Promise<object>} Caso con personajes, escenas, preguntas, opciones y rúbrica.
     * @throws {Error} `ID_INVALIDO` (400) o `CASO_NO_EXISTE` (404).
     */
    async obtener(casoId) {
      const id = exigirId(casoId, 'El caso');
      const caso = await repositorio.obtenerCompleto(id);
      if (!caso) {
        throw errorCaso('CASO_NO_EXISTE', 'No se encontró el caso.', 404);
      }
      return caso;
    },

    /**
     * Crea un caso en estado Borrador solo con sus datos básicos; el resto
     * (escenas, personajes, rúbrica) se agrega luego con los demás métodos.
     * @param {{ creadorId: number, titulo: string, desarrolloSituacional: string,
     *   contextoHistoria: string, tiempoEstimadoSegundos: number }} datos
     * @returns {Promise<object>} El caso creado.
     * @throws {Error} `ESTRUCTURA_INVALIDA` (422) o `CREADOR_NO_EXISTE` (404).
     */
    async crear(datos) {
      const creadorId = validarCreador(datos?.creadorId);
      const basicos = validarDatosBasicos(datos);
      await exigirCreador(repositorio, creadorId);

      return repositorio.enTransaccion(async (tx) => {
        const id = await tx.insertarCaso({ creadorId, ...basicos });
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Crea un caso completo de una sola vez usando el patrón Builder: valida toda
     * la estructura (`construirCaso`) y la guarda en una única transacción
     * (todo o nada). El caso nace en estado Borrador.
     * @param {object} datos  Caso con personajes, escenas, preguntas, opciones y rúbrica opcional.
     * @returns {Promise<object>} El caso completo guardado.
     * @throws {Error} `ESTRUCTURA_INVALIDA` (422), `CREADOR_NO_EXISTE` (404) o
     *   `DUPLICADO` (409) si MySQL rechaza un orden o nombre repetido.
     */
    async construir(datos) {
      const caso = construirCaso(datos);
      await exigirCreador(repositorio, caso.creadorId);
      return repositorio.enTransaccion(async (tx) => tx.guardarCasoCompleto(caso));
    },

    /**
     * Modifica los datos básicos de un caso en Borrador.
     * @param {number|string} casoId
     * @param {object} datos  Mismos campos básicos que `crear` (sin creadorId).
     * @param {object} actor  Usuario autenticado (creador o administrador).
     * @returns {Promise<object>} El caso actualizado.
     * @throws {Error} `CASO_NO_EXISTE`, `CASO_AJENO`, `CASO_NO_EDITABLE` o `ESTRUCTURA_INVALIDA`.
     */
    async actualizar(casoId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const basicos = validarDatosBasicos(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const filas = await tx.actualizarCaso(id, basicos);
        if (!filas) {
          throw errorCaso('CASO_NO_EDITABLE', 'No se pudo actualizar el caso.', 409);
        }
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Agrega una escena a un caso en Borrador. Las preguntas anidadas en
     * `decisiones` no se guardan aquí: se agregan con `agregarDecision`.
     * Los personajes se asocian después con `asociarPersonaje`, porque primero
     * deben existir en el caso (`PERSONAJES_EN_ESCENA`, 422, si se envían aquí).
     * @param {number|string} casoId
     * @param {{ nombre: string, contexto: string, orden: number, esFinal?: boolean,
     *   decisiones?: object[] }} datos
     * @param {object} actor  Usuario autenticado.
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} Errores de edición (ver `exigirBorradorEditable`), validación o `DUPLICADO` (409).
     */
    async agregarEscena(casoId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const escena = normalizarEscena({ ...datos, decisiones: datos?.decisiones ?? [] });
      if (escena.personajes.length > 0) {
        throw errorCaso(
          'PERSONAJES_EN_ESCENA',
          'Asocia los personajes de la escena después de crearlos.',
          422
        );
      }

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        await tx.insertarEscena(id, escena);
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Edita nombre, contexto, orden y marca final de una escena existente.
     * No reemplaza sus preguntas ni personajes.
     * @param {number|string} casoId
     * @param {number|string} escenaId  Debe pertenecer al caso.
     * @param {{ nombre: string, contexto: string, orden: number, esFinal?: boolean }} datos
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `ESCENA_NO_EXISTE` (404) si no pertenece al caso, además de los errores de edición.
     */
    async actualizarEscena(casoId, escenaId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const idEscena = exigirId(escenaId, 'La escena');
      const escena = datosActualizacionEscena(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const actual = await tx.obtenerEscena(idEscena);
        if (!actual || actual.casoId !== id) {
          throw errorCaso('ESCENA_NO_EXISTE', 'La escena no pertenece a este caso.', 404);
        }
        const filas = await tx.actualizarEscena(idEscena, escena);
        if (!filas) {
          throw errorCaso('ESCENA_NO_EXISTE', 'No se pudo actualizar la escena.', 404);
        }
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Agrega una pregunta (Decision) a una escena. Las opciones se agregan
     * después con `agregarOpcion` (aquí se ignoran).
     * @param {number|string} casoId
     * @param {number|string} escenaId  Debe pertenecer al caso.
     * @param {{ pregunta: string, orden: number, ayuda?: string }} datos
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `ESCENA_NO_EXISTE` (404) y errores de edición o validación.
     */
    async agregarDecision(casoId, escenaId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const idEscena = exigirId(escenaId, 'La escena');
      const decision = normalizarDecision({ ...datos, opciones: [] });

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const escena = await tx.obtenerEscena(idEscena);
        if (!escena || escena.casoId !== id) {
          throw errorCaso('ESCENA_NO_EXISTE', 'La escena no pertenece a este caso.', 404);
        }
        await tx.insertarDecision(idEscena, decision);
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Edita el texto, orden y ayuda de una pregunta existente (no sus opciones).
     * @param {number|string} casoId
     * @param {number|string} decisionId  Debe pertenecer al caso.
     * @param {{ pregunta: string, orden: number, ayuda?: string }} datos
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `DECISION_NO_EXISTE` (404) y errores de edición o validación.
     */
    async actualizarDecision(casoId, decisionId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const idDecision = exigirId(decisionId, 'La pregunta');
      const decision = datosActualizacionDecision(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const actual = await tx.obtenerDecision(idDecision);
        if (!actual || actual.casoId !== id) {
          throw errorCaso('DECISION_NO_EXISTE', 'La pregunta no pertenece a este caso.', 404);
        }
        const filas = await tx.actualizarDecision(idDecision, decision);
        if (!filas) {
          throw errorCaso('DECISION_NO_EXISTE', 'No se pudo actualizar la pregunta.', 404);
        }
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Agrega una opción de respuesta, con su explicación, a una pregunta.
     * @param {number|string} casoId
     * @param {number|string} decisionId  Debe pertenecer al caso.
     * @param {{ texto: string, esCorrecta: boolean, orden: number, explicacion: string,
     *   consecuencia?: string, fundamentoTeorico?: string }} datos
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `DECISION_NO_EXISTE` (404) y errores de edición o validación.
     */
    async agregarOpcion(casoId, decisionId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const idDecision = exigirId(decisionId, 'La pregunta');
      const opcion = normalizarOpcion(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const decision = await tx.obtenerDecision(idDecision);
        if (!decision || decision.casoId !== id) {
          throw errorCaso('DECISION_NO_EXISTE', 'La pregunta no pertenece a este caso.', 404);
        }
        await tx.insertarOpcion(idDecision, opcion);
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Reemplaza los datos de una opción existente (y su retroalimentación).
     * @param {number|string} casoId
     * @param {number|string} opcionId  Debe pertenecer al caso.
     * @param {object} datos  Mismos campos que `agregarOpcion`.
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `OPCION_NO_EXISTE` (404) y errores de edición o validación.
     */
    async actualizarOpcion(casoId, opcionId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const idOpcion = exigirId(opcionId, 'La opción');
      const opcion = normalizarOpcion(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const actual = await tx.obtenerOpcion(idOpcion);
        if (!actual || actual.casoId !== id) {
          throw errorCaso('OPCION_NO_EXISTE', 'La opción no pertenece a este caso.', 404);
        }
        const filas = await tx.actualizarOpcion(idOpcion, opcion);
        if (!filas) {
          throw errorCaso('OPCION_NO_EXISTE', 'No se pudo actualizar la opción.', 404);
        }
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Agrega un personaje al caso (disponible para asociarlo luego a escenas).
     * @param {number|string} casoId
     * @param {{ nombre: string, rolSocial?: string, perfil?: string,
     *   pautasComportamiento?: string }} datos
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} Errores de edición o validación; `DUPLICADO` (409) si el nombre ya existe.
     */
    async agregarPersonaje(casoId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const personaje = normalizarPersonaje(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        await tx.insertarPersonaje(id, personaje);
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Vincula un personaje del caso con una escena donde participa.
     * @param {number|string} casoId
     * @param {number|string} escenaId  Debe pertenecer al caso.
     * @param {number|string} personajeId  Debe pertenecer al mismo caso.
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `ESCENA_NO_EXISTE` (404), `PERSONAJE_AJENO` (422) o errores de edición.
     */
    async asociarPersonaje(casoId, escenaId, personajeId, actor) {
      const id = exigirId(casoId, 'El caso');
      const idEscena = exigirId(escenaId, 'La escena');
      const idPersonaje = exigirId(personajeId, 'El personaje');

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        const escena = await tx.obtenerEscena(idEscena);
        if (!escena || escena.casoId !== id) {
          throw errorCaso('ESCENA_NO_EXISTE', 'La escena no pertenece a este caso.', 404);
        }
        const personaje = await tx.obtenerPersonaje(idPersonaje);
        if (!personaje || personaje.casoId !== id) {
          throw errorCaso(
            'PERSONAJE_AJENO',
            'El personaje no pertenece a este caso.',
            422
          );
        }
        await tx.asociarPersonaje(idEscena, idPersonaje);
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Guarda la rúbrica del caso (RF-17) como una nueva versión activa; las
     * versiones anteriores quedan inactivas, así se conserva el historial.
     * @param {number|string} casoId
     * @param {object} datos  Rúbrica con criterios y niveles (ver `normalizarRubrica`).
     * @param {object} actor
     * @returns {Promise<object>} El caso completo actualizado.
     * @throws {Error} `ESTRUCTURA_INVALIDA` (422) y errores de edición.
     */
    async guardarRubrica(casoId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const rubrica = normalizarRubrica(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        await tx.guardarRubrica(id, rubrica);
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Publica un caso en Borrador, tras comprobar que esté completo
     * (escenas, preguntas, opciones, explicaciones y rúbrica). Un caso
     * Publicado ya no se puede editar.
     * @param {number|string} casoId
     * @param {object} actor  Creador o administrador.
     * @returns {Promise<object>} El caso publicado.
     * @throws {Error} `CASO_NO_EXISTE`, `CASO_AJENO`, `CASO_NO_PUBLICABLE` (409)
     *   o `ESTRUCTURA_INVALIDA` (422) con lo que falta.
     */
    async publicar(casoId, actor) {
      const id = exigirId(casoId, 'El caso');

      return repositorio.enTransaccion(async (tx) => {
        const caso = await tx.obtenerCompleto(id, true);
        if (!caso) {
          throw errorCaso('CASO_NO_EXISTE', 'No se encontró el caso.', 404);
        }
        exigirPropietarioOAdmin(caso, actor);
        if (caso.estado !== ESTADOS_CASO.BORRADOR) {
          throw errorCaso(
            'CASO_NO_PUBLICABLE',
            'Solo se puede publicar un caso en estado Borrador.',
            409
          );
        }
        validarParaPublicar(caso);
        const filas = await tx.actualizarEstado(id, ESTADOS_CASO.PUBLICADO, ESTADOS_CASO.BORRADOR);
        if (!filas) {
          throw errorCaso('CASO_NO_PUBLICABLE', 'No se pudo publicar el caso.', 409);
        }
        return tx.obtenerCompleto(id);
      });
    },

    /**
     * Archiva un caso (Borrador o Publicado). El archivado es definitivo:
     * el caso se conserva como histórico y deja de ofrecerse para programar.
     * @param {number|string} casoId
     * @param {object} actor  Creador o administrador.
     * @returns {Promise<object>} El caso archivado.
     * @throws {Error} `CASO_NO_EXISTE`, `CASO_AJENO`, `CASO_YA_ARCHIVADO` (409)
     *   o `CASO_NO_ARCHIVABLE` (409).
     */
    async archivar(casoId, actor) {
      const id = exigirId(casoId, 'El caso');

      return repositorio.enTransaccion(async (tx) => {
        const caso = await tx.obtenerPorId(id, true);
        if (!caso) {
          throw errorCaso('CASO_NO_EXISTE', 'No se encontró el caso.', 404);
        }
        exigirPropietarioOAdmin(caso, actor);
        if (caso.estado === ESTADOS_CASO.ARCHIVADO) {
          throw errorCaso('CASO_YA_ARCHIVADO', 'El caso ya está archivado.', 409);
        }
        const filas = await tx.actualizarEstado(id, ESTADOS_CASO.ARCHIVADO, caso.estado);
        if (!filas) {
          throw errorCaso('CASO_NO_ARCHIVABLE', 'No se pudo archivar el caso.', 409);
        }
        return tx.obtenerCompleto(id);
      });
    }
  };
}

// Se reexporta para que las pruebas y otros módulos validen un caso sin
// importar caso.validacion.js directamente.
export { validarCaso };
