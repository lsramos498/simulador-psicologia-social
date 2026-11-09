
import { ROLES, tieneRol } from './autorizacion.js';
import {
  hashearCodigoAutorizacion,
  normalizarCodigo,
  normalizarCorreo,
  validarAccesoEstudiante
} from './codigos.js';
import { hashearContrasena, verificarContrasena } from './contrasenas.js';
import { crearErrorHttp } from './errores.js';
import { crearLimiteIntentos } from './limiteIntentos.js';
import { firmarToken } from './tokens.js';

// Hash de una contraseña que nadie conoce. Se compara cuando el correo no
// existe, para que la respuesta tarde lo mismo y no revele qué correos existen.
let hashFicticio;

async function obtenerHashFicticio() {
  hashFicticio ??= await hashearContrasena(
    'contrasena-ficticia-que-nunca-coincide'
  );

  return hashFicticio;
}

export function crearServicioAcceso(repositorio, {
  reloj = () => new Date(),
  limiteIntentos = crearLimiteIntentos()
} = {}) {
  if (
    !repositorio ||
    typeof repositorio.buscarAccesoPorCodigoHash !== 'function'
  ) {
    throw new TypeError('Se requiere el repositorio de acceso');
  }

  /**
   * Aplica el límite de intentos a un ingreso:
   * - Si el correo está bloqueado, responde 429.
   * - Si las credenciales fallan (401), suma un fallo.
   * - Si el ingreso es correcto, reinicia el contador.
   */
  async function conLimiteDeIntentos(clave, ingresar) {
    if (limiteIntentos.estaBloqueado(clave)) {
      throw crearErrorHttp(
        'Demasiados intentos fallidos. Intente de nuevo más tarde',
        429
      );
    }

    try {
      const resultado = await ingresar();
      limiteIntentos.reiniciar(clave);
      return resultado;
    } catch (error) {
      if (error.statusCode === 401) {
        limiteIntentos.registrarFallo(clave);
      }

      throw error;
    }
  }

  return {
    async ingresarEstudiante(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const codigo = normalizarCodigo(credenciales?.codigo);

      if (!correo || !codigo) {
        throw crearErrorHttp(
          'El correo institucional y el código de autorización son obligatorios',
          400
        );
      }

      return conLimiteDeIntentos(`codigo:${correo}`, async () => {
        // 1. Buscar la convocatoria mediante el hash del código.
        const registro = await repositorio.buscarAccesoPorCodigoHash(
          hashearCodigoAutorizacion(codigo)
        );

        // 2. Validar código, correo, estado, ventana y sesión.
        const { estudianteId, actividadId } = validarAccesoEstudiante(
          { correo, codigo },
          registro,
          reloj()
        );

        // 3. Consultar los roles y permisos del estudiante.
        const { roles, permisos } =
          await repositorio.obtenerRolesYPermisos(estudianteId);

        const usuario = {
          id: estudianteId,
          roles,
          permisos
        };

        if (!tieneRol(usuario, ROLES.ESTUDIANTE)) {
          throw crearErrorHttp(
            'El usuario no tiene el rol Estudiante',
            403
          );
        }

        // 4. Generar el token asociado a la actividad.
        // La creación o recuperación de la sesión corresponde al módulo
        // de sesiones, no al servicio de autenticación.
        const token = firmarToken({
          ...usuario,
          actividadId
        });

        return {
          token,
          usuario: {
            id: estudianteId,
            roles,
            actividadId
          }
        };
      });
    },

    async ingresarConContrasena(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const contrasena = credenciales?.contrasena;

      if (
        !correo ||
        typeof contrasena !== 'string' ||
        contrasena === ''
      ) {
        throw crearErrorHttp(
          'El correo institucional y la contraseña son obligatorios',
          400
        );
      }

      return conLimiteDeIntentos(`contrasena:${correo}`, async () => {
        // 1. Buscar al usuario y comprobar la contraseña contra su hash.
        const usuarioBd = await repositorio.buscarUsuarioPorCorreo(correo);

        const hashGuardado =
          usuarioBd?.contrasenaHash ?? await obtenerHashFicticio();

        const contrasenaValida = await verificarContrasena(
          contrasena,
          hashGuardado
        );

        // Mismo mensaje si el correo no existe o la contraseña es incorrecta.
        if (!usuarioBd || !contrasenaValida) {
          throw crearErrorHttp('Correo o contraseña no válidos', 401);
        }

        if (!usuarioBd.activo) {
          throw crearErrorHttp('La cuenta está inactiva', 403);
        }

        // 2. Consultar los roles y permisos del usuario.
        const { roles, permisos } =
          await repositorio.obtenerRolesYPermisos(usuarioBd.id);

        const usuario = {
          id: usuarioBd.id,
          roles,
          permisos
        };

        // Los estudiantes ingresan con código, no con contraseña.
        if (!tieneRol(usuario, ROLES.DOCENTE, ROLES.ADMINISTRADOR)) {
          throw crearErrorHttp(
            'Este ingreso es solo para docentes y administradores',
            403
          );
        }

        // 3. Generar el token de acceso.
        return {
          token: firmarToken(usuario),
          usuario
        };
      });
    }
  };
}
