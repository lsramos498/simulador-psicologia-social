import { ESTADOS_SESION } from './sesion.state.js';

/**
 * Contrato RF-23: reglas de sesión para registrar una respuesta.
 * No abre transacciones ni bloqueos; eso lo hace el repositorio
 * en orden Actividad → Autorización → Sesión.
 */
export function validarSesionParaResponder(contexto, estudianteId, ahora = new Date()) {
  if (!contexto) {
    const error = new Error('La sesión no existe.');
    error.codigo = 'SESION_NO_EXISTE';
    error.statusCode = 404;
    throw error;
  }

  if (Number(contexto.estudianteId) !== Number(estudianteId)) {
    const error = new Error('La sesión no pertenece al estudiante indicado.');
    error.codigo = 'SESION_AJENA';
    error.statusCode = 403;
    throw error;
  }

  if (contexto.estadoAutorizacion && contexto.estadoAutorizacion !== 'Autorizado') {
    const error = new Error('El estudiante no está autorizado para esta actividad.');
    error.codigo = 'NO_AUTORIZADO';
    error.statusCode = 403;
    throw error;
  }

  if (contexto.estadoActividad && contexto.estadoActividad !== 'Iniciada') {
    const error = new Error('La actividad todavía no está iniciada.');
    error.codigo = 'ACTIVIDAD_NO_INICIADA';
    error.statusCode = 409;
    throw error;
  }

  if (contexto.fechaInicio && contexto.fechaFin) {
    const inicioVentana = new Date(contexto.fechaInicio).getTime();
    const finVentana = new Date(contexto.fechaFin).getTime();
    const marca = ahora.getTime();
    if (marca < inicioVentana || marca > finVentana) {
      const error = new Error('La actividad está fuera de la ventana de acceso.');
      error.codigo = 'FUERA_DE_VENTANA';
      error.statusCode = 403;
      throw error;
    }
  }

  if (contexto.estado !== ESTADOS_SESION.EN_CURSO) {
    const error = new Error('Solo se puede responder en una sesión En curso.');
    error.codigo = 'ESTADO_NO_PERMITIDO';
    error.statusCode = 409;
    throw error;
  }

  if (contexto.inicio != null && contexto.tiempoLimiteSegundos != null) {
    const limite = Number(contexto.tiempoLimiteSegundos);
    const inicio = new Date(contexto.inicio).getTime();
    if (Number.isFinite(limite) && Number.isFinite(inicio)
      && ahora.getTime() > inicio + limite * 1000) {
      const error = new Error('Se agotó el tiempo de la sesión.');
      error.codigo = 'TIEMPO_AGOTADO';
      error.statusCode = 409;
      throw error;
    }
  }

  return {
    id: Number(contexto.id),
    actividadId: Number(contexto.actividadId),
    estudianteId: Number(contexto.estudianteId),
    casoId: Number(contexto.casoId),
    estado: contexto.estado,
    inicio: contexto.inicio,
    tiempoLimiteSegundos: contexto.tiempoLimiteSegundos == null
      ? null
      : Number(contexto.tiempoLimiteSegundos)
  };
}
