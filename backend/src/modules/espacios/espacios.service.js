import { crearErrorHttp } from '../acceso/errores.js';

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function crearServicioEspacios(repositorio) {
  if (!repositorio || typeof repositorio.insertar !== 'function') {
    throw new TypeError('Se requiere el repositorio de espacios académicos');
  }

  return {
    async crear(datos) {
      const nombre = texto(datos?.nombre);
      if (!nombre) {
        throw crearErrorHttp('El nombre del espacio académico es obligatorio.', 400);
      }
      if (nombre.length > 150) {
        throw crearErrorHttp('El nombre supera la longitud permitida.', 400);
      }

      let codigo = texto(datos?.codigo);
      if (!codigo) {
        codigo = null;
      } else if (codigo.length > 50) {
        throw crearErrorHttp('El código supera la longitud permitida.', 400);
      }

      try {
        const id = await repositorio.insertar({ nombre, codigo });
        return { id, nombre, codigo, activo: true };
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw crearErrorHttp('Ya existe un espacio académico con ese código.', 409);
        }
        throw error;
      }
    },

    async listar() {
      const filas = await repositorio.listar();
      return filas.map((fila) => ({
        id: fila.id,
        nombre: fila.nombre,
        codigo: fila.codigo,
        activo: Boolean(fila.activo)
      }));
    }
  };
}
