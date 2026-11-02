import { ROLES, tieneRol } from './autorizacion.js';
import {
  hashearCodigoAutorizacion,
  normalizarCodigo,
  normalizarCorreo,
  validarAccesoEstudiante
} from './codigos.js';
import { firmarToken } from './tokens.js';

/**
 * Servicio de acceso (Sofía Gallego — acceso y permisos).
 * Une las piezas del módulo: repositorio (MySQL) → reglas → token JWT.
 *
 * RF-01: el estudiante ingresa con correo institucional + código de autorización.
 * Acordado con el equipo: el estudiante debe existir, estar activo y tener
 * el rol Estudiante.
 */

function errorAcceso(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

export function crearServicioAcceso(repositorio, { reloj = () => new Date() } = {}) {
  if (!repositorio || typeof repositorio.buscarAccesoPorCodigoHash !== 'function') {
    throw new TypeError('Se requiere el repositorio de acceso');
  }

  return {
    async ingresarEstudiante(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const codigo = normalizarCodigo(credenciales?.codigo);

      if (!correo || !codigo) {
        throw errorAcceso('El correo institucional y el código de autorización son obligatorios', 400);
      }

      // 1. Buscar la convocatoria por el hash del código (nunca por el código en claro).
      const registro = await repositorio.buscarAccesoPorCodigoHash(hashearCodigoAutorizacion(codigo));

      // 2. Aplicar las reglas: código, correo, estado, ventana y sesión.
      const { estudianteId, actividadId } = validarAccesoEstudiante({ correo, codigo }, registro, reloj());

      // 3. Roles y permisos desde la base de datos (fuente confiable del servidor).
      const { roles, permisos } = await repositorio.obtenerRolesYPermisos(estudianteId);
      const usuario = { id: estudianteId, roles, permisos };

      if (!tieneRol(usuario, ROLES.ESTUDIANTE)) {
        throw errorAcceso('El usuario no tiene el rol Estudiante', 403);
      }

      // 4. Entregar el token de sesión.
      const token = firmarToken({ ...usuario, actividadId });

      return {
        token,
        usuario: { id: estudianteId, roles, actividadId }
      };
    }
  };
}