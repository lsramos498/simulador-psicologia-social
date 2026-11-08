import { ROLES, tieneRol } from './autorizacion.js';
import {
  hashearCodigoAutorizacion,
  normalizarCodigo,
  normalizarCorreo,
  validarAccesoEstudiante
} from './codigos.js';
import { hashearContrasena, verificarContrasena } from './contrasenas.js';
import { firmarToken } from './tokens.js';

/**
 * Servicio de acceso (Sofía Gallego — acceso y permisos).
 * Une las piezas del módulo: repositorio (MySQL) → reglas → token JWT.
 *
 * RF-01: el estudiante ingresa con correo institucional + código de autorización.
 * Acordado con el equipo: el estudiante debe existir, estar activo y tener
 * el rol Estudiante.
 *
 * Decisión del equipo: docentes y administradores ingresan con correo
 * institucional + contraseña (solo se guarda el hash).
 */

// Hash de una contraseña que nadie conoce. Se compara cuando el correo no
// existe, para que la respuesta tarde lo mismo y no revele qué correos existen.
let hashFicticio;
async function obtenerHashFicticio() {
  hashFicticio ??= await hashearContrasena('contrasena-ficticia-que-nunca-coincide');
  return hashFicticio;
}

function errorAcceso(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

export function crearServicioAcceso(
  repositorio,
  {
    reloj = () => new Date(),
    iniciarSesion = null
  } = {}
) {
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

            // 4. Crear o recuperar la sesión individual del estudiante.
      // Esta dependencia se inyecta desde la configuración del backend.
      if (iniciarSesion !== null) {
        await iniciarSesion({ actividadId, estudianteId });
      }

      // 5. Entregar el token de sesión.
      const token = firmarToken({ ...usuario, actividadId });

      return {
        token,
        usuario: { id: estudianteId, roles, actividadId }
      };
    },

    async ingresarConContrasena(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const contrasena = credenciales?.contrasena;

      if (!correo || typeof contrasena !== 'string' || contrasena === '') {
        throw errorAcceso('El correo institucional y la contraseña son obligatorios', 400);
      }

      // 1. Buscar al usuario y comprobar la contraseña contra su hash.
      const usuarioBd = await repositorio.buscarUsuarioPorCorreo(correo);
      const hashGuardado = usuarioBd?.contrasenaHash ?? await obtenerHashFicticio();
      const contrasenaValida = await verificarContrasena(contrasena, hashGuardado);

      // Mismo mensaje si el correo no existe o la contraseña es incorrecta.
      if (!usuarioBd || !contrasenaValida) {
        throw errorAcceso('Correo o contraseña no válidos', 401);
      }

      if (!usuarioBd.activo) {
        throw errorAcceso('La cuenta está inactiva', 403);
      }

      // 2. Roles y permisos desde la base de datos.
      const { roles, permisos } = await repositorio.obtenerRolesYPermisos(usuarioBd.id);
      const usuario = { id: usuarioBd.id, roles, permisos };

      // Los estudiantes ingresan con su código, no con contraseña.
      if (!tieneRol(usuario, ROLES.DOCENTE, ROLES.ADMINISTRADOR)) {
        throw errorAcceso('Este ingreso es solo para docentes y administradores', 403);
      }

      // 3. Entregar el token de sesión.
      return {
        token: firmarToken(usuario),
        usuario
      };
    }
  };
}