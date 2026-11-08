import { ROLES } from './autorizacion.js';
import { normalizarCorreo } from './codigos.js';
import { hashearContrasena, validarPoliticaContrasena } from './contrasenas.js';
import { crearErrorHttp } from './errores.js';

/**
 * Servicio de administración (Sofía Gallego — acceso y permisos).
 * RF-03: el administrador crea los usuarios docentes y asigna sus roles y permisos.
 *
 * Decisiones del equipo:
 *  - Solo existen los roles Administrador, Docente y Estudiante (no se crean roles nuevos).
 *  - Los permisos se asignan a los roles (RolPermiso), no a usuarios sueltos.
 *  - El catálogo de permisos lo carga el seed; aquí solo se asignan los existentes.
 *
 * Quién puede llamar estas operaciones (solo Administrador) lo controlan las rutas.
 * Aquí se validan los datos y las reglas de negocio.
 */

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarIdUsuario(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) {
    throw crearErrorHttp('El id de usuario no es válido', 400);
  }
  return id;
}

export function crearServicioAdministracion(repositorio) {
  if (!repositorio || typeof repositorio.crearUsuarioConRol !== 'function') {
    throw new TypeError('Se requiere el repositorio de administración');
  }

  async function exigirRol(nombre) {
    const rol = await repositorio.obtenerRolPorNombre(texto(nombre));
    if (!rol) throw crearErrorHttp(`El rol "${texto(nombre)}" no existe`, 404);
    return rol;
  }

  async function exigirPermiso(nombre) {
    const permiso = await repositorio.obtenerPermisoPorNombre(texto(nombre));
    if (!permiso) throw crearErrorHttp(`El permiso "${texto(nombre)}" no existe`, 404);
    return permiso;
  }

  async function exigirUsuario(usuarioId) {
    if (!(await repositorio.existeUsuario(usuarioId))) {
      throw crearErrorHttp('El usuario no existe', 404);
    }
  }

  return {
    /** Crea un usuario con el rol Docente. */
    async crearDocente(datos, administradorId) {
      const nombres = texto(datos?.nombres);
      const apellidos = texto(datos?.apellidos);
      const correo = normalizarCorreo(datos?.correo);
      const contrasena = datos?.contrasena;

      const faltantes = [];
      if (!nombres) faltantes.push('nombres');
      if (!apellidos) faltantes.push('apellidos');
      if (!correo) faltantes.push('correo');
      if (typeof contrasena !== 'string' || contrasena === '') faltantes.push('contrasena');
      if (faltantes.length > 0) {
        throw crearErrorHttp(`Faltan datos: ${faltantes.join(', ')}`, 400);
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw crearErrorHttp('El correo institucional no es válido', 400);
      }

      if (nombres.length > 100 || apellidos.length > 100 || correo.length > 150) {
        throw crearErrorHttp('Algún dato supera la longitud permitida', 400);
      }

      const incumplimientos = validarPoliticaContrasena(contrasena);
      if (incumplimientos.length > 0) {
        throw crearErrorHttp(`La contraseña debe tener ${incumplimientos.join(', ')}`, 400);
      }

      if (await repositorio.existeCorreo(correo)) {
        throw crearErrorHttp('Ya existe un usuario con ese correo', 409);
      }

      const rolDocente = await exigirRol(ROLES.DOCENTE);
      const id = await repositorio.crearUsuarioConRol({
        nombres,
        apellidos,
        correo,
        contrasenaHash: await hashearContrasena(contrasena),
        rolId: rolDocente.id,
        asignadoPor: administradorId
      });

      // Nunca se devuelve la contraseña ni su hash.
      return { id, nombres, apellidos, correo, roles: [ROLES.DOCENTE] };
    },

    async asignarRol(usuarioId, nombreRol, administradorId) {
      const id = validarIdUsuario(usuarioId);
      await exigirUsuario(id);
      const rol = await exigirRol(nombreRol);
      await repositorio.asignarRol(id, rol.id, administradorId);
      return { usuarioId: id, rol: rol.nombre };
    },

    async quitarRol(usuarioId, nombreRol, administradorId) {
      const id = validarIdUsuario(usuarioId);
      const rol = await exigirRol(nombreRol);

      // Evita que el administrador se bloquee a sí mismo.
      if (id === administradorId && rol.nombre === ROLES.ADMINISTRADOR) {
        throw crearErrorHttp('No puedes quitarte tu propio rol de Administrador', 409);
      }

      if (!(await repositorio.quitarRol(id, rol.id))) {
        throw crearErrorHttp('El usuario no tiene ese rol', 404);
      }
      return { usuarioId: id, rol: rol.nombre };
    },

    async asignarPermiso(nombreRol, nombrePermiso) {
      const rol = await exigirRol(nombreRol);
      const permiso = await exigirPermiso(nombrePermiso);
      await repositorio.asignarPermisoARol(rol.id, permiso.id);
      return { rol: rol.nombre, permiso: permiso.nombre };
    },

    async quitarPermiso(nombreRol, nombrePermiso) {
      const rol = await exigirRol(nombreRol);
      const permiso = await exigirPermiso(nombrePermiso);
      if (!(await repositorio.quitarPermisoDeRol(rol.id, permiso.id))) {
        throw crearErrorHttp('El rol no tiene ese permiso', 404);
      }
      return { rol: rol.nombre, permiso: permiso.nombre };
    },

    listarRoles: () => repositorio.listarRolesConPermisos(),
    listarPermisos: () => repositorio.listarPermisos()
  };
}
