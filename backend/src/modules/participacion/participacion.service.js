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

function comprobarRespuesta(respuesta) {
  const { opcionId, fechaRespuesta, fechaModificacion } = respuesta;
  const fechaValida = (fecha) => fecha instanceof Date && Number.isFinite(fecha.getTime());
  const pendienteValida = opcionId === null && fechaRespuesta === null && fechaModificacion === null;
  const respondidaValida = Number.isSafeInteger(opcionId) && opcionId > 0 && opcionId <= 2147483647
    && fechaValida(fechaRespuesta)
    && (fechaModificacion === null || (fechaValida(fechaModificacion)
      && fechaModificacion >= fechaRespuesta));
  if (!pendienteValida && !respondidaValida) {
    throw errorParticipacion('RESPUESTA_INCONSISTENTE', 'La respuesta guardada requiere revisión de integridad.');
  }
}

// Integración con autenticación: el router entrega req.usuario.id, nunca el ID del cuerpo.
export function crearServicioParticipacion(repositorio) {
  return {
    async registrar(datos, estudianteId) {
      const respuesta = registrarRespuesta(datos);
      validarId(estudianteId);
      try {
        // El repositorio confirma el commit antes de devolver; aquí aún no se publican eventos.
        return await repositorio.enTransaccion(async (transaccion) => {
          const sesion = await transaccion.obtenerSesion(respuesta.sesionId, true);
          comprobarPropietario(sesion, estudianteId);
          // INTEGRACIÓN CON STATE: consulta los estados de Laura, sin ejecutar transiciones.
          if (sesion.estado !== ESTADOS_SESION.EN_CURSO) {
            throw errorParticipacion('ESTADO_NO_PERMITIDO', 'Solo se puede responder en una sesión En curso.');
          }
          if (!await transaccion.opcionValida(sesion.casoId, respuesta.decisionId, respuesta.opcionId)) {
            throw errorParticipacion('OPCION_INVALIDA', 'La decisión debe pertenecer al caso y la opción a la decisión.');
          }
          const existente = await transaccion.obtenerRespuesta(respuesta.sesionId, respuesta.decisionId);
          if (existente) {
            comprobarRespuesta(existente);
            if (existente.opcionId !== respuesta.opcionId) {
              const filas = await transaccion.actualizarRespuesta(
                existente.id, respuesta.opcionId, respuesta.sesionId,
                respuesta.decisionId, existente.opcionId === null
              );
              if (filas !== 1) {
                throw errorParticipacion('RESPUESTA_INCONSISTENTE', 'No se pudo actualizar la respuesta esperada.');
              }
            }
            return { id: existente.id, ...respuesta };
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
