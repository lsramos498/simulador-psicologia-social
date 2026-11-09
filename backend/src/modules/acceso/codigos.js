import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ESTADOS_SESION } from '../sesiones/sesion.state.js';
import { crearErrorHttp } from './errores.js';

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
 *
 * Decisión del equipo: los códigos se guardan con hash, nunca en texto plano.
 * Se usa HMAC-SHA256 con una clave secreta del servidor
 * (CODIGO_AUTORIZACION_SECRETO en .env): el mismo código siempre produce
 * el mismo hash, así se puede buscar en la base de datos, pero sin la clave
 * nadie puede calcular ni comprobar códigos aunque vea la tabla.
 */

export const ESTADOS_AUTORIZACION = Object.freeze({
  AUTORIZADO: 'Autorizado',
  RETIRADO: 'Retirado',
  BLOQUEADO: 'Bloqueado'
});

// Sin 0/O ni 1/I/L para evitar confusiones al copiar el código del correo.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LONGITUD_CODIGO = 8;
const LONGITUD_MINIMA_SECRETO = 32;

function obtenerSecreto() {
  const secreto = process.env.CODIGO_AUTORIZACION_SECRETO;

  if (!secreto || secreto.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `CODIGO_AUTORIZACION_SECRETO debe existir en .env y tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`
    );
  }

  return secreto;
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
 * Calcula el hash que se guarda en EstudianteAutorizado.codigoAutorizacion.
 * Devuelve 64 caracteres hexadecimales (cabe en VARCHAR(100)).
 */
export function hashearCodigoAutorizacion(codigo) {
  const normalizado = normalizarCodigo(codigo);

  if (!normalizado) {
    throw new TypeError('Se requiere el código de autorización');
  }

  return createHmac('sha256', obtenerSecreto()).update(normalizado).digest('hex');
}

/**
 * Comprueba un código escrito por el estudiante contra el hash guardado.
 * Usa una comparación de tiempo constante para no dar pistas a un atacante.
 */
export function verificarCodigoAutorizacion(codigo, hashGuardado) {
  if (!normalizarCodigo(codigo) || typeof hashGuardado !== 'string') {
    return false;
  }

  const calculado = Buffer.from(hashearCodigoAutorizacion(codigo), 'hex');
  const guardado = Buffer.from(hashGuardado, 'hex');

  return calculado.length === guardado.length && timingSafeEqual(calculado, guardado);
}

/**
 * Para el módulo de actividades (Laura): genera el código que se envía
 * al estudiante por correo y el hash que se guarda en la base de datos.
 */
export function crearCodigoAutorizacion() {
  const codigo = generarCodigoAutorizacion();
  return {
    codigo,
    codigoHash: hashearCodigoAutorizacion(codigo)
  };
}

/**
 * Decide si un estudiante puede ingresar con su correo y su código.
 *
 * @param {{ correo: string, codigo: string }} credenciales  Lo que envía el estudiante.
 * @param {object} registro  Lo que el servidor encontró buscando por el hash del código:
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
    throw crearErrorHttp('El correo institucional y el código de autorización son obligatorios', 400);
  }

  const { autorizacion, estudiante, actividad, sesion } = registro ?? {};

  // Mismo mensaje para "el código no existe" y "el código es de otra persona":
  // así no se revela si un código adivinado es real.
  const credencialesValidas =
    autorizacion &&
    estudiante &&
    verificarCodigoAutorizacion(codigo, autorizacion.codigoAutorizacion) &&
    autorizacion.estudiante_id === estudiante.id &&
    normalizarCorreo(estudiante.correoInstitucional) === correo;

  if (!credencialesValidas) {
    throw crearErrorHttp('Correo o código de autorización no válidos', 401);
  }

  if (!estudiante.activo) {
    throw crearErrorHttp('La cuenta del estudiante está inactiva', 403);
  }

  if (autorizacion.estado !== ESTADOS_AUTORIZACION.AUTORIZADO) {
    throw crearErrorHttp('El estudiante no está autorizado para esta convocatoria', 403);
  }

  if (!actividad || autorizacion.actividad_id !== actividad.id) {
    throw crearErrorHttp('La convocatoria asociada al código no existe', 404);
  }

  if (ahora < new Date(actividad.fechaInicio)) {
    throw crearErrorHttp('La actividad todavía no ha comenzado', 403);
  }

  if (ahora > new Date(actividad.fechaFin)) {
    throw crearErrorHttp('La actividad ya terminó', 403);
  }

  if (sesion && sesion.estado === ESTADOS_SESION.FINALIZADO) {
    throw crearErrorHttp('La participación en esta actividad ya fue finalizada', 403);
  }

  return {
    estudianteId: estudiante.id,
    actividadId: actividad.id
  };
}