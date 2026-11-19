import { ESTADOS_SESION } from './sesion.state.js';

/**
 * Contrato RF-23: reglas de sesión para registrar una respuesta. Comprueba, en
 * orden, que la sesión pueda recibir una respuesta y devuelve sus datos
 * normalizados. Es una función pura: no consulta ni escribe en la base de datos
 * ni abre transacciones ni bloqueos; eso lo hace el repositorio de sesiones en
 * orden Actividad → Autorización → Sesión, y él arma el `contexto`.
 *
 * Reglas, en el orden en que se evalúan (la primera que falla corta):
 *  1. La sesión existe                              → SESION_NO_EXISTE (404)
 *  2. Pertenece al estudiante                       → SESION_AJENA (403)
 *  3. El estudiante sigue autorizado (si se informa) → NO_AUTORIZADO (403)
 *  4. La actividad está Iniciada (si se informa)     → ACTIVIDAD_NO_INICIADA (409)
 *  5. Ahora cae dentro de la ventana de acceso       → FUERA_DE_VENTANA (403)
 *  6. La sesión está En curso                        → ESTADO_NO_PERMITIDO (409)
 *  7. No se agotó el tiempo límite de la sesión      → TIEMPO_AGOTADO (409)
 * Las reglas 3 a 5 solo se aplican si el contexto trae esos datos.
 *
 * @param {object|null} contexto  Sesión con su actividad y autorización, o null si no existe.
 * @param {number|string} contexto.id  Id de la sesión.
 * @param {number|string} contexto.estudianteId  Dueño de la sesión.
 * @param {number|string} contexto.actividadId  Actividad a la que pertenece.
 * @param {number|string} contexto.casoId  Caso que se resuelve.
 * @param {string} contexto.estado  Estado de la sesión (ver `ESTADOS_SESION`).
 * @param {string} [contexto.estadoAutorizacion]  'Autorizado' o el estado del estudiante en la actividad.
 * @param {string} [contexto.estadoActividad]  Estado de la actividad ('Iniciada', …).
 * @param {Date|string} [contexto.fechaInicio]  Inicio de la ventana de acceso.
 * @param {Date|string} [contexto.fechaFin]  Fin de la ventana de acceso.
 * @param {Date|string} [contexto.inicio]  Momento en que arrancó la sesión.
 * @param {number|string} [contexto.tiempoLimiteSegundos]  Tiempo límite desde `inicio`.
 * @param {number|string} estudianteId  Estudiante que intenta responder (el del token).
 * @param {Date} [ahora=new Date()]  Fecha de referencia; se recibe por parámetro para poder probarla.
 * @returns {{ id: number, actividadId: number, estudianteId: number, casoId: number,
 *   estado: string, inicio: Date|string|undefined, tiempoLimiteSegundos: number|null }}
 *   Sesión validada con los ids convertidos a número.
 * @throws {Error} Error de dominio con `codigo` y `statusCode` (ver lista de reglas).
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
