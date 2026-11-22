import { registrarRespuesta } from './registrarRespuesta.js';
import { puedeModificarRespuesta } from './puedeModificarRespuesta.js';
import { ESTADOS_SESION } from '../sesiones/sesion.state.js';

function errorParticipacion(codigo, mensaje) {
  return Object.assign(new Error(mensaje), { codigo });
}

function validarId(valor) {
  if (!Number.isSafeInteger(valor) || valor <= 0 || valor > 2147483647) {
    throw new TypeError(
      'El identificador debe ser un entero positivo válido para INT de MySQL.'
    );
  }
}

// estudianteId es provisional: el llamador deberá obtenerlo de autenticación.
export function crearServicioParticipacion(
  repositorio,
  validarSesionParaResponder
) {
  if (typeof validarSesionParaResponder !== 'function') {
    throw new TypeError(
      'Se requiere el validador validarSesionParaResponder del módulo Sesiones.'
    );
  }

  return {
    async registrar(datos, estudianteId) {
      const respuesta = registrarRespuesta(datos);
      [estudianteId, ...Object.values(respuesta)].forEach(validarId);

      try {
        const resultado = await repositorio.enTransaccion(
          async (transaccion, conexion) => {
            const validacion = await validarSesionParaResponder(
              respuesta.sesionId,
              estudianteId,
              conexion
            );

            // No lanzar dentro de la transacción: Sesiones pudo haber
            // finalizado la sesión por tiempo agotado y ese cierre debe
            // conservarse mediante COMMIT.
            if (!validacion.permitida) {
              return {
                rechazada: true,
                codigo: validacion.codigo,
                mensaje: validacion.mensaje
              };
            }

            if (!validacion.casoId) {
              throw errorParticipacion(
                'SESION_NO_VALIDA',
                'No fue posible determinar el caso asociado a la sesión.'
              );
            }

            if (
              !await transaccion.opcionValida(
                validacion.casoId,
                respuesta.decisionId,
                respuesta.opcionId
              )
            ) {
              throw errorParticipacion(
                'OPCION_INVALIDA',
                'La decisión debe pertenecer al caso y la opción a la decisión.'
              );
            }

            const existente = await transaccion.obtenerRespuesta(
              respuesta.sesionId,
              respuesta.decisionId
            );

            if (existente) {
              if (
                !puedeModificarRespuesta(
                  validacion.sesion.estado === ESTADOS_SESION.FINALIZADO
                )
              ) {
                throw errorParticipacion(
                  'RESPUESTA_NO_MODIFICABLE',
                  'La respuesta ya no se puede cambiar.'
                );
              }

              await transaccion.actualizarRespuesta(
                existente.id,
                respuesta.opcionId
              );

              return {
                data: { id: existente.id, ...respuesta }
              };
            }

            const id = await transaccion.insertarRespuesta(respuesta);

            return {
              data: { id, ...respuesta }
            };
          }
        );

        // La transacción ya fue confirmada. Ahora sí podemos rechazar
        // la respuesta sin revertir el cierre de la sesión.
        if (resultado.rechazada) {
          throw errorParticipacion(
            resultado.codigo,
            resultado.mensaje
          );
        }

        return resultado.data;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw errorParticipacion(
            'RESPUESTA_DUPLICADA',
            'Ya existe una respuesta para esta sesión y decisión.'
          );
        }

        throw error;
      }
    },

    async consultar(sesionId, estudianteId) {
      [sesionId, estudianteId].forEach(validarId);

      const sesion = await repositorio.obtenerSesion(sesionId);

      if (!sesion) {
        throw errorParticipacion(
          'SESION_NO_EXISTE',
          'La sesión no existe.'
        );
      }

      if (sesion.estudianteId !== estudianteId) {
        throw errorParticipacion(
          'SESION_AJENA',
          'La sesión no pertenece al estudiante indicado.'
        );
      }

      // La consulta está permitida también después de finalizar,
      // sin revelar soluciones.
      return repositorio.consultarRespuestas(sesionId);
    }
  };
}
