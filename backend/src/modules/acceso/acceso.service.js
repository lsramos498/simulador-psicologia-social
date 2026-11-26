
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
import { urlAccesoEstudiante } from '../../utils/urlAcceso.js';

let hashFicticio;

async function obtenerHashFicticio() {
  hashFicticio ??= await hashearContrasena(
    'contrasena-ficticia-que-nunca-coincide'
  );
  return hashFicticio;
}

const MENSAJE_CODIGO_SESION =
  'Si tu correo está registrado como estudiante, te enviamos un código de inicio de sesión. Revisa tu bandeja.';

const OTP_MINUTOS = 15;

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

  async function conLimiteDeIntentos(clave, ingresar) {
    if (limiteIntentos.estaBloqueado(clave)) {
      throw crearErrorHttp(
        'Demasiados intentos fallidos. Intenta de nuevo más tarde',
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
    /**
     * Ingreso estudiante con código de SESIÓN (OTP por correo).
     * No usa el código de convocatoria de una actividad.
     */
    async ingresarEstudiante(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const codigo = normalizarCodigo(credenciales?.codigo);

      if (!correo || !codigo) {
        throw crearErrorHttp(
          'El correo institucional y el código de inicio de sesión son obligatorios',
          400
        );
      }

      return conLimiteDeIntentos(`login-sesion:${correo}`, async () => {
        const usuarioBd = await repositorio.buscarUsuarioPorCorreo(correo);
        if (!usuarioBd || !usuarioBd.activo) {
          throw crearErrorHttp('Correo o código no válidos', 401);
        }

        const { roles, permisos } = await repositorio.obtenerRolesYPermisos(usuarioBd.id);
        const usuario = { id: usuarioBd.id, roles, permisos };
        if (!tieneRol(usuario, ROLES.ESTUDIANTE)) {
          throw crearErrorHttp('Este ingreso es solo para estudiantes', 403);
        }

        const consumo = await repositorio.consumirCodigoLogin(
          hashearCodigoAutorizacion(codigo),
          reloj()
        );
        if (!consumo || Number(consumo.usuarioId) !== Number(usuarioBd.id)) {
          throw crearErrorHttp('Correo o código no válidos', 401);
        }

        const token = firmarToken({
          id: usuarioBd.id,
          roles,
          permisos
        });

        return {
          token,
          usuario: {
            id: usuarioBd.id,
            roles,
            nombres: usuarioBd.nombres || null,
            apellidos: usuarioBd.apellidos || null,
            correo: usuarioBd.correoInstitucional || correo
          }
        };
      });
    },

    /**
     * Acceso legado / opcional: correo + código de CONVOCATORIA de una actividad.
     * Se mantiene por compatibilidad con enlaces antiguos, pero el flujo principal
     * es código de sesión + panel de actividades.
     */
    async ingresarEstudianteActividad(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const codigo = normalizarCodigo(credenciales?.codigo);

      if (!correo || !codigo) {
        throw crearErrorHttp(
          'El correo institucional y el código de la actividad son obligatorios',
          400
        );
      }

      return conLimiteDeIntentos(`codigo-actividad:${correo}`, async () => {
        const registro = await repositorio.buscarAccesoPorCodigoHash(
          hashearCodigoAutorizacion(codigo)
        );
        const { estudianteId, actividadId, verResultado } = validarAccesoEstudiante(
          { correo, codigo },
          registro,
          reloj()
        );
        const { roles, permisos } = await repositorio.obtenerRolesYPermisos(estudianteId);
        const usuario = { id: estudianteId, roles, permisos };
        if (!tieneRol(usuario, ROLES.ESTUDIANTE)) {
          throw crearErrorHttp('El usuario no tiene el rol Estudiante', 403);
        }
        const token = firmarToken({ ...usuario, actividadId });
        return {
          token,
          usuario: {
            id: estudianteId,
            roles,
            actividadId,
            verResultado: Boolean(verResultado)
          }
        };
      });
    },

    async ingresarConContrasena(credenciales) {
      const correo = normalizarCorreo(credenciales?.correo);
      const contrasena = credenciales?.contrasena;

      if (!correo || typeof contrasena !== 'string' || contrasena === '') {
        throw crearErrorHttp(
          'El correo institucional y la contraseña son obligatorios',
          400
        );
      }

      return conLimiteDeIntentos(`contrasena:${correo}`, async () => {
        const usuarioBd = await repositorio.buscarUsuarioPorCorreo(correo);
        const hashGuardado = usuarioBd?.contrasenaHash ?? await obtenerHashFicticio();
        const contrasenaValida = await verificarContrasena(contrasena, hashGuardado);

        if (!usuarioBd || !contrasenaValida) {
          throw crearErrorHttp('Correo o contraseña no válidos', 401);
        }
        if (!usuarioBd.activo) {
          throw crearErrorHttp('La cuenta está inactiva', 403);
        }

        const { roles, permisos } = await repositorio.obtenerRolesYPermisos(usuarioBd.id);
        const usuario = {
          id: usuarioBd.id,
          roles,
          permisos,
          nombres: usuarioBd.nombres || null,
          apellidos: usuarioBd.apellidos || null,
          correo: usuarioBd.correoInstitucional || correo
        };

        if (!tieneRol(usuario, ROLES.DOCENTE, ROLES.ADMINISTRADOR)) {
          throw crearErrorHttp(
            'Este ingreso es solo para docentes y administradores',
            403
          );
        }

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
     * Envía OTP de INICIO DE SESIÓN al correo del estudiante registrado.
     * No es el código de una actividad concreta.
     */
    async enviarCodigoEstudiante({ correo }) {
      const correoNormalizado = normalizarCorreo(correo);
      if (!correoNormalizado) {
        throw crearErrorHttp('El correo institucional es obligatorio', 400);
      }

      const clave = `enviar-codigo-sesion:${correoNormalizado}`;
      if (limiteIntentos.estaBloqueado(clave)) {
        throw crearErrorHttp('Demasiados intentos. Intenta de nuevo más tarde', 429);
      }
      limiteIntentos.registrarFallo(clave);

      const respuestaGenerica = { mensaje: MENSAJE_CODIGO_SESION };

      if (!notificaciones || typeof notificaciones.enviar !== 'function') {
        throw crearErrorHttp('El envío de correos no está disponible en este momento', 503);
      }

      const usuarioBd = await repositorio.buscarUsuarioPorCorreo(correoNormalizado);
      if (!usuarioBd || !usuarioBd.activo) {
        return respuestaGenerica;
      }

      const { roles } = await repositorio.obtenerRolesYPermisos(usuarioBd.id);
      if (!roles.includes(ROLES.ESTUDIANTE)) {
        return respuestaGenerica;
      }

      const { codigo, codigoHash } = generarCodigo();
      const ahora = reloj();
      const expiraEn = new Date(ahora.getTime() + OTP_MINUTOS * 60_000);

      try {
        await notificaciones.enviar(TIPOS_NOTIFICACION.CODIGO_SESION, {
          estudianteId: usuarioBd.id,
          destinatario: usuarioBd.correoInstitucional || correoNormalizado,
          codigoAutorizacion: codigo,
          urlAcceso: urlAccesoEstudiante({ correo: correoNormalizado }),
          minutosValidez: OTP_MINUTOS
        });
      } catch (error) {
        console.error('No se pudo enviar el código de sesión:', error?.message);
        return respuestaGenerica;
      }

      // Guardar siempre que el envío no haya fallado: el OTP debe poder usarse.
      // En producción el código solo llega por correo. En local, si
      // ACCESO_CODIGO_EN_PANTALLA=true, también se devuelve para demos/E2E.
      await repositorio.guardarCodigoLogin(usuarioBd.id, codigoHash, expiraEn, ahora);

      const mostrarEnPantalla =
        String(process.env.ACCESO_CODIGO_EN_PANTALLA || '').toLowerCase() === 'true';
      if (mostrarEnPantalla) {
        return {
          ...respuestaGenerica,
          codigoAutorizacion: codigo,
          demoLocal: true
        };
      }

      return respuestaGenerica;
    },

    async listarMisActividades(estudianteId) {
      if (typeof repositorio.listarActividadesDelEstudiante !== 'function') {
        throw crearErrorHttp('No disponible', 501);
      }
      return repositorio.listarActividadesDelEstudiante(Number(estudianteId));
    }
  };
}
