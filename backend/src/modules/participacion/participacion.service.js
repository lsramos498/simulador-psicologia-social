import { registrarRespuesta } from './registrarRespuesta.js';
import { puedeModificarRespuesta } from './puedeModificarRespuesta.js';
import { calcularProgreso } from './calcularProgreso.js';
import { EventosParticipacion } from './eventosParticipacion.js';
import { crearNotificacionInterna } from './notificacionInterna.js';
import { ESTADOS_SESION } from '../sesiones/sesion.state.js';
import { validarSesionParaResponder } from '../sesiones/validarSesionParaResponder.js';

function errorParticipacion(codigo, mensaje, statusCode = 409) {
  return Object.assign(new Error(mensaje), { codigo, statusCode });
}

function validarId(valor) {
  if (!Number.isSafeInteger(valor) || valor <= 0 || valor > 2147483647) {
    throw new TypeError('El identificador debe ser un entero positivo válido para INT de MySQL.');
  }
}

function comprobarPropietario(sesion, estudianteId) {
  if (!sesion) {
    throw errorParticipacion('SESION_NO_EXISTE', 'La sesión no existe.', 404);
  }
  if (Number(sesion.estudianteId) !== Number(estudianteId)) {
    throw errorParticipacion('SESION_AJENA', 'La sesión no pertenece al estudiante indicado.', 403);
  }
}

export function crearServicioParticipacion(repositorio, eventos = new EventosParticipacion()) {
  eventos.suscribir((evento) => {
    crearNotificacionInterna(evento);
  });

  function notificarRespuesta(estudianteId, respuesta) {
    eventos.notificar({
      tipo: 'respuestaRegistrada',
      estudianteId,
      sesionId: respuesta.sesionId,
      decisionId: respuesta.decisionId,
      opcionId: respuesta.opcionId
    });
  }

  return {
    async registrar(datos, estudianteId) {
      const respuesta = registrarRespuesta(datos);
      [estudianteId, ...Object.values(respuesta)].forEach(validarId);
      try {
        return await repositorio.enTransaccion(async (transaccion) => {
          const contexto = await transaccion.obtenerSesion(respuesta.sesionId, true, estudianteId);
          let sesion;
          try {
            sesion = validarSesionParaResponder(contexto, estudianteId);
          } catch (error) {
            throw errorParticipacion(error.codigo || 'ESTADO_NO_PERMITIDO', error.message, error.statusCode);
          }
          if (!await transaccion.opcionValida(sesion.casoId, respuesta.decisionId, respuesta.opcionId)) {
            throw errorParticipacion('OPCION_INVALIDA', 'La decisión debe pertenecer al caso y la opción a la decisión.', 422);
          }
          const existente = await transaccion.obtenerRespuesta(respuesta.sesionId, respuesta.decisionId);
          if (existente) {
            if (!puedeModificarRespuesta(sesion.estado === ESTADOS_SESION.FINALIZADO)) {
              throw errorParticipacion(
                'RESPUESTA_NO_MODIFICABLE',
                'La respuesta ya no se puede cambiar.'
              );
            }
            await transaccion.actualizarRespuesta(existente.id, respuesta.opcionId);
            const actualizada = { id: existente.id, ...respuesta };
            notificarRespuesta(estudianteId, actualizada);
            return actualizada;
          }
          const id = await transaccion.insertarRespuesta(respuesta);
          const creada = { id, ...respuesta };
          notificarRespuesta(estudianteId, creada);
          return creada;
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
    },
    async progreso(sesionId, estudianteId) {
      [sesionId, estudianteId].forEach(validarId);
      const sesion = await repositorio.obtenerSesion(sesionId);
      comprobarPropietario(sesion, estudianteId);
      const total = Number(await repositorio.contarPreguntas(sesion.casoId));
      const respondidas = Number(await repositorio.contarRespuestas(sesionId));
      return calcularProgreso(total, respondidas);
    },
    async retroalimentacion(sesionId, estudianteId) {
      [sesionId, estudianteId].forEach(validarId);
      const sesion = await repositorio.obtenerSesion(sesionId);
      comprobarPropietario(sesion, estudianteId);
      if (sesion.estado !== ESTADOS_SESION.FINALIZADO) {
        throw errorParticipacion(
          'ESTADO_NO_PERMITIDO',
          'La retroalimentación solo está disponible al finalizar la sesión.'
        );
      }
      return repositorio.listarRetroalimentacion(sesionId);
    }
  };
}
