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

function exigirId(valor, nombre) {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 2147483647) {
    throw errorCaso('ID_INVALIDO', `${nombre} debe ser un entero positivo.`, 400);
  }
  return numero;
}

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

export function crearServicioCasos(repositorio) {
  if (!repositorio || typeof repositorio.enTransaccion !== 'function') {
    throw new TypeError('Se requiere un repositorio de casos.');
  }

  return {
    async listar(creadorId) {
      const filtro = creadorId == null || creadorId === ''
        ? null
        : exigirId(creadorId, 'creadorId');
      return repositorio.listar(filtro);
    },

    async obtener(casoId) {
      const id = exigirId(casoId, 'El caso');
      const caso = await repositorio.obtenerCompleto(id);
      if (!caso) {
        throw errorCaso('CASO_NO_EXISTE', 'No se encontró el caso.', 404);
      }
      return caso;
    },

    async crear(datos) {
      const creadorId = validarCreador(datos?.creadorId);
      const basicos = validarDatosBasicos(datos);
      await exigirCreador(repositorio, creadorId);

      return repositorio.enTransaccion(async (tx) => {
        const id = await tx.insertarCaso({ creadorId, ...basicos });
        return tx.obtenerCompleto(id);
      });
    },

    async construir(datos) {
      const caso = construirCaso(datos);
      await exigirCreador(repositorio, caso.creadorId);
      return repositorio.enTransaccion(async (tx) => tx.guardarCasoCompleto(caso));
    },

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

    async agregarPersonaje(casoId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const personaje = normalizarPersonaje(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        await tx.insertarPersonaje(id, personaje);
        return tx.obtenerCompleto(id);
      });
    },

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

    async guardarRubrica(casoId, datos, actor) {
      const id = exigirId(casoId, 'El caso');
      const rubrica = normalizarRubrica(datos);

      return repositorio.enTransaccion(async (tx) => {
        await exigirBorradorEditable(tx, id, actor);
        await tx.guardarRubrica(id, rubrica);
        return tx.obtenerCompleto(id);
      });
    },

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

export { validarCaso };
