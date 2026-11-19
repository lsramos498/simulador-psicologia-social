
import { ROLES, tieneRol } from './autorizacion.js';
import {
  crearCodigoAutorizacion,
  hashearCodigoAutorizacion,
  normalizarCodigo,
  normalizarCorreo,
  validarAccesoEstudiante
} from './codigos.js';
import { hashearContrasena, verificarContrasena } from './contrasenas.js';
import { crearErrorHttp } from './errores.js';
import { crearLimiteIntentos } from './limiteIntentos.js';
import { firmarToken } from './tokens.js';
import { TIPOS_NOTIFICACION } from '../notificaciones/notificaciones.factory.js';

// Hash de una contraseña que nadie conoce. Se compara cuando el correo no
// existe, para que la respuesta tarde lo mismo y no revele qué correos existen.
let hashFicticio;

async function obtenerHashFicticio() {
  hashFicticio ??= await hashearContrasena(
    'contrasena-ficticia-que-nunca-coincide'
  );

  return hashFicticio;
}

const MENSAJE_CODIGO_ENVIADO =
  'Si tu correo está convocado a una actividad vigente, te enviamos el código. Revisa tu bandeja.';

export function crearServicioAcceso(repositorio, {
  reloj = () => new Date(),
  limiteIntentos = crearLimiteIntentos(),
  notificaciones = null,
  generarCodigo = crearCodigoAutorizacion
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
          permisos,
          nombres: usuarioBd.nombres || null,
          apellidos: usuarioBd.apellidos || null,
          correo: usuarioBd.correoInstitucional || correo
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
          token: firmarToken({
            id: usuario.id,
            roles: usuario.roles,
            permisos: usuario.permisos
          }),
          usuario
        };
      });
    },

    /**
     * RF-01: el estudiante pide el código a su correo institucional.
     * Regenera el código (solo guardamos hash) y lo envía por notificación.
     * Respuesta genérica para no filtrar si el correo existe.
     */
    async enviarCodigoEstudiante({ correo }) {
      const correoNormalizado = normalizarCorreo(correo);
      if (!correoNormalizado) {
        throw crearErrorHttp('El correo institucional es obligatorio', 400);
      }

      if (limiteIntentos.estaBloqueado(`enviar-codigo:${correoNormalizado}`)) {
        throw crearErrorHttp(
          'Demasiados intentos. Intenta de nuevo más tarde',
          429
        );
      }

      const convocatoria = await repositorio.buscarConvocatoriaActivaPorCorreo(
        correoNormalizado,
        reloj()
      );

      if (!convocatoria || !convocatoria.usuarioActivo) {
        limiteIntentos.registrarFallo(`enviar-codigo:${correoNormalizado}`);
        return { mensaje: MENSAJE_CODIGO_ENVIADO };
      }

      if (!notificaciones || typeof notificaciones.enviar !== 'function') {
        throw crearErrorHttp(
          'El envío de correos no está disponible en este momento',
          503
        );
      }

      const { codigo, codigoHash } = generarCodigo();
      const actualizadas = await repositorio.actualizarCodigoAutorizacion(
        convocatoria.actividadId,
        convocatoria.estudianteId,
        codigoHash,
        reloj()
      );

      if (!actualizadas) {
        return { mensaje: MENSAJE_CODIGO_ENVIADO };
      }

      try {
        const envio = await notificaciones.enviar(TIPOS_NOTIFICACION.CONVOCATORIA, {
          actividadId: convocatoria.actividadId,
          estudianteId: convocatoria.estudianteId,
          destinatario: convocatoria.correo,
          caso: {
            titulo: convocatoria.casoTitulo,
            desarrolloSituacional: convocatoria.desarrolloSituacional || '',
            contextoHistoria: convocatoria.contextoHistoria || ''
          },
          mensajePersonalizado:
            convocatoria.mensajePersonalizado ||
            'Tu código de acceso a Lumina. Úsalo en Iniciar sesión.',
          urlAcceso: process.env.URL_ACCESO || 'http://localhost:5173',
          codigoAutorizacion: codigo
        });

        limiteIntentos.reiniciar(`enviar-codigo:${correoNormalizado}`);

        const enPantalla = Boolean(envio?.demo) || envio?.canal === 'Sistema';
        return {
          mensaje: enPantalla
            ? 'Lumina generó tu código. Úsalo para entrar (el correo del sistema aún no está activo).'
            : MENSAJE_CODIGO_ENVIADO,
          // Solo se devuelve en modo demo/pantalla; con SMTP real el alumno lo ve en su bandeja.
          codigo: enPantalla ? codigo : undefined,
          previewUrl: envio?.previewUrl || null,
          canal: envio?.canal || null
        };
      } catch (error) {
        limiteIntentos.registrarFallo(`enviar-codigo:${correoNormalizado}`);
        throw crearErrorHttp(
          error?.message || 'No se pudo enviar el código al correo',
          502
        );
      }
    }
  };
}
