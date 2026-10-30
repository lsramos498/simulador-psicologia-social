import { randomInt } from 'node:crypto';

/**
 * Códigos de autorización de la convocatoria (Sofía Gallego — acceso y permisos).
 * RF-01: el estudiante ingresa con correo institucional + código de autorización.
 * RF-20: cada estudiante convocado tiene un código asociado a su acceso.
 *
 * Reglas tomadas del modelo aprobado (backend/database/schema.sql):
 *  - EstudianteAutorizado.codigoAutorizacion es único.
 *  - EstudianteAutorizado.estado: 'Autorizado', 'Retirado', 'Bloqueado'.
 *  - Regla 9: código válido, estudiante convocado, dentro de la ventana
 *    permitida y sesión no finalizada.
 */

export const ESTADOS_AUTORIZACION = Object.freeze({
  AUTORIZADO: 'Autorizado',
  RETIRADO: 'Retirado',
  BLOQUEADO: 'Bloqueado'
});

// Mismo valor que ESTADOS_SESION.FINALIZADO del módulo de sesiones (Laura).
const SESION_FINALIZADA = 'Finalizado';

// Sin 0/O ni 1/I/L para evitar confusiones al copiar el código del correo.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LONGITUD_CODIGO = 8;

function errorAcceso(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

export function normalizarCorreo(correo) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

export function normalizarCodigo(codigo) {
  return typeof codigo === 'string' ? codigo.trim().toUpperCase() : '';
}

/**
 * Genera un código aleatorio con el generador criptográfico de Node.
 * La unicidad final la garantiza la clave única de la base de datos.
 */
export function generarCodigoAutorizacion() {
  let codigo = '';
  for (let i = 0; i < LONGITUD_CODIGO; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

/**
 * Decide si un estudiante puede ingresar con su correo y su código.
 *
 * @param {{ correo: string, codigo: string }} credenciales  Lo que envía el estudiante.
 * @param {object} registro  Lo que el servidor encontró buscando por el código:
 *   - autorizacion: fila de EstudianteAutorizado (o null si el código no existe)
 *   - estudiante:   fila de Usuario asociada
 *   - actividad:    fila de ActividadProgramada asociada
 *   - sesion:       SesionSimulacion del estudiante en esa actividad (o null)
 * @param {Date} ahora  Fecha actual (se recibe como parámetro para poder probarla).
 * @returns {{ estudianteId: number, actividadId: number }}
 */
export function validarAccesoEstudiante(credenciales, registro, ahora = new Date()) {
  const correo = normalizarCorreo(credenciales?.correo);
  const codigo = normalizarCodigo(credenciales?.codigo);

  if (!correo || !codigo) {
    throw errorAcceso('El correo institucional y el código de autorización son obligatorios', 400);
  }

  const { autorizacion, estudiante, actividad, sesion } = registro ?? {};

  // Mismo mensaje para "el código no existe" y "el código es de otra persona":
  // así no se revela si un código adivinado es real.
  const credencialesValidas =
    autorizacion &&
    estudiante &&
    normalizarCodigo(autorizacion.codigoAutorizacion) === codigo &&
    autorizacion.estudiante_id === estudiante.id &&
    normalizarCorreo(estudiante.correoInstitucional) === correo;

  if (!credencialesValidas) {
    throw errorAcceso('Correo o código de autorización no válidos', 401);
  }

  if (!estudiante.activo) {
    throw errorAcceso('La cuenta del estudiante está inactiva', 403);
  }

  if (autorizacion.estado !== ESTADOS_AUTORIZACION.AUTORIZADO) {
    throw errorAcceso('El estudiante no está autorizado para esta convocatoria', 403);
  }

  if (!actividad || autorizacion.actividad_id !== actividad.id) {
    throw errorAcceso('La convocatoria asociada al código no existe', 404);
  }

  if (ahora < new Date(actividad.fechaInicio)) {
    throw errorAcceso('La actividad todavía no ha comenzado', 403);
  }

  if (ahora > new Date(actividad.fechaFin)) {
    throw errorAcceso('La actividad ya terminó', 403);
  }

  if (sesion && sesion.estado === SESION_FINALIZADA) {
    throw errorAcceso('La participación en esta actividad ya fue finalizada', 403);
  }

  return {
    estudianteId: estudiante.id,
    actividadId: actividad.id
  };
}
