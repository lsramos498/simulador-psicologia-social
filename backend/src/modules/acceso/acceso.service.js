
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
     * RF-01 / RF-20: el estudiante pide que le reenvíen su código al correo
     * institucional. Ruta pública, así que:
     *  - El código NUNCA viaja en la respuesta HTTP (ni el enlace del correo):
     *    solo llega al correo del estudiante. Si saliera en la respuesta,
     *    cualquiera que sepa el correo de un convocado entraría como él.
     *    Única excepción: ACCESO_CODIGO_EN_PANTALLA=true para demos locales.
     *  - Respuesta igual exista o no el correo (no revela quién está convocado).
     *  - El código nuevo reemplaza al anterior solo si el correo salió de
     *    verdad; si el envío falla, el estudiante conserva su código.
     *  - Máximo 5 solicitudes por correo cada 15 minutos (cuentan todas,
     *    también las exitosas), para que nadie invalide el código ajeno sin fin.
     */
    async enviarCodigoEstudiante({ correo }) {
      const correoNormalizado = normalizarCorreo(correo);
      if (!correoNormalizado) {
        throw crearErrorHttp('El correo institucional es obligatorio', 400);
      }

      const clave = `enviar-codigo:${correoNormalizado}`;
      if (limiteIntentos.estaBloqueado(clave)) {
        throw crearErrorHttp('Demasiados intentos. Intenta de nuevo más tarde', 429);
      }
      limiteIntentos.registrarFallo(clave);

      // Antes de buscar el correo: así el 503 no revela si está convocado.
      if (!notificaciones || typeof notificaciones.enviar !== 'function') {
        throw crearErrorHttp('El envío de correos no está disponible en este momento', 503);
      }

      const respuestaGenerica = { mensaje: MENSAJE_CODIGO_ENVIADO };
      const convocatoria = await repositorio.buscarConvocatoriaActivaPorCorreo(
        correoNormalizado,
        reloj()
      );
      if (!convocatoria || !convocatoria.usuarioActivo) {
        return respuestaGenerica;
      }

      const { codigo, codigoHash } = generarCodigo();
      let envio;
      try {
        envio = await notificaciones.enviar(TIPOS_NOTIFICACION.CONVOCATORIA, {
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
      } catch (error) {
        console.error('No se pudo enviar el código del estudiante:', error?.message);
        return respuestaGenerica; // conserva el código anterior
      }

      const llegoAlCorreo = envio?.canal === 'Correo' && !envio?.demo;
      // SMTP_MODE=demo|pantalla implica entrega en UI (sin buzón real).
      // ACCESO_CODIGO_EN_PANTALLA=true fuerza lo mismo en otros modos (p. ej. ethereal).
      const modoSmtp = String(process.env.SMTP_MODE || '').trim().toLowerCase();
      const mostrarEnPantalla =
        process.env.ACCESO_CODIGO_EN_PANTALLA === 'true' ||
        modoSmtp === 'demo' ||
        modoSmtp === 'pantalla';
      if (!llegoAlCorreo && !mostrarEnPantalla) {
        return respuestaGenerica; // no se reemplaza un código que nadie recibió
      }

      await repositorio.actualizarCodigoAutorizacion(
        convocatoria.actividadId,
        convocatoria.estudianteId,
        codigoHash,
        reloj()
      );

      return mostrarEnPantalla
        ? { mensaje: 'Modo demostración: Lumina muestra tu código en pantalla.', codigo }
        : respuestaGenerica;
    }
  };
}
