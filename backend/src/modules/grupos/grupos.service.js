function errorHttp(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function ahoraSql(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function crearServicioGrupos(repositorio) {
  if (!repositorio) throw new TypeError('Se requiere el repositorio de grupos.');

  return {
    async crear(datos, docenteId) {
      const nombre = texto(datos?.nombre);
      const codigo = texto(datos?.codigo) || null;
      const descripcion = texto(datos?.descripcion) || null;
      if (!nombre) throw errorHttp('El nombre del grupo es obligatorio.');
      if (nombre.length > 150) throw errorHttp('El nombre es demasiado largo.');
      if (codigo && codigo.length > 50) throw errorHttp('El código es demasiado largo.');

      const id = await repositorio.crear({
        nombre,
        codigo,
        docenteId: Number(docenteId),
        descripcion,
        fechaCreacion: ahoraSql()
      });
      return this.obtener(id, docenteId, { esAdmin: true });
    },

    async listar(docenteId, { esAdmin = false } = {}) {
      return repositorio.listarPorDocente(Number(docenteId), { todas: esAdmin });
    },

    async obtener(grupoId, docenteId, { esAdmin = false } = {}) {
      const grupo = await repositorio.obtener(Number(grupoId));
      if (!grupo) throw errorHttp('El grupo no existe.', 404);
      if (!esAdmin && Number(grupo.docenteId) !== Number(docenteId)) {
        throw errorHttp('No puedes gestionar este grupo.', 403);
      }
      const estudiantes = await repositorio.listarEstudiantes(grupo.id);
      return { ...grupo, estudiantes, totalEstudiantes: estudiantes.length };
    },

    async asignarEstudiantes(grupoId, estudiantesIds, docenteId, { esAdmin = false } = {}) {
      const grupo = await this.obtener(grupoId, docenteId, { esAdmin });
      const ids = Array.isArray(estudiantesIds)
        ? [...new Set(estudiantesIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
        : [];
      if (ids.length === 0) throw errorHttp('Debes indicar al menos un estudiante.');

      const fecha = ahoraSql();
      for (const id of ids) {
        if (!(await repositorio.esEstudiante(id))) {
          throw errorHttp(`El usuario ${id} no es estudiante.`, 400);
        }
        await repositorio.asignarEstudiante(grupo.id, id, fecha);
      }
      return this.obtener(grupo.id, docenteId, { esAdmin });
    },

    async retirarEstudiante(grupoId, estudianteId, docenteId, { esAdmin = false } = {}) {
      await this.obtener(grupoId, docenteId, { esAdmin });
      const ok = await repositorio.retirarEstudiante(Number(grupoId), Number(estudianteId));
      if (!ok) throw errorHttp('Ese estudiante no está en el grupo.', 404);
      return this.obtener(grupoId, docenteId, { esAdmin });
    },

    async idsDeGrupo(grupoId, docenteId, { esAdmin = false } = {}) {
      await this.obtener(grupoId, docenteId, { esAdmin });
      return repositorio.idsEstudiantes(Number(grupoId));
    }
  };
}
