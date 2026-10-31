import { registrarRespuesta } from './registrarRespuesta.js';
import { ESTADOS_SESION } from '../sesiones/sesion.state.js';

function errorParticipacion(codigo, mensaje) {
  return Object.assign(new Error(mensaje), { codigo });
}

function validarId(valor) {
  if (!Number.isSafeInteger(valor) || valor <= 0 || valor > 2147483647) {
    throw new TypeError('El identificador debe ser un entero positivo válido para INT de MySQL.');
  }
}

function comprobarPropietario(sesion, estudianteId) {
  if (!sesion) {
    throw errorParticipacion('SESION_NO_EXISTE', 'La sesión no existe.');
  }
  if (sesion.estudianteId !== estudianteId) {
    throw errorParticipacion('SESION_AJENA', 'La sesión no pertenece al estudiante indicado.');
  }
}

// estudianteId es provisional: el llamador deberá obtenerlo de autenticación.
export function crearServicioParticipacion(repositorio) {
  return {
    async registrar(datos, estudianteId) {
      const respuesta = registrarRespuesta(datos);
      [estudianteId, ...Object.values(respuesta)].forEach(validarId);
      try {
        return await repositorio.enTransaccion(async (transaccion) => {
          const sesion = await transaccion.obtenerSesion(respuesta.sesionId, true);
          comprobarPropietario(sesion, estudianteId);
          if (sesion.estado !== ESTADOS_SESION.EN_CURSO) {
            throw errorParticipacion('ESTADO_NO_PERMITIDO', 'Solo se puede responder en una sesión En curso.');
          }
          if (!await transaccion.opcionValida(sesion.casoId, respuesta.decisionId, respuesta.opcionId)) {
            throw errorParticipacion('OPCION_INVALIDA', 'La decisión debe pertenecer al caso y la opción a la decisión.');
          }
          if (await transaccion.existeRespuesta(respuesta.sesionId, respuesta.decisionId)) {
            throw errorParticipacion('RESPUESTA_DUPLICADA', 'Ya existe una respuesta para esta sesión y decisión.');
          }
          const id = await transaccion.insertarRespuesta(respuesta);
          return { id, ...respuesta };
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw errorParticipacion('RESPUESTA_DUPLICADA', 'Ya existe una respuesta para esta sesión y decisión.');
        }
        throw error;
      }
    },
    async consultar(sesionId, estudianteId) {
      [sesionId, estudianteId].forEach(validarId);
      const sesion = await repositorio.obtenerSesion(sesionId);
      comprobarPropietario(sesion, estudianteId);
      // La consulta está permitida también después de finalizar, sin revelar soluciones.
      return repositorio.consultarRespuestas(sesionId);
    }
  };
}
