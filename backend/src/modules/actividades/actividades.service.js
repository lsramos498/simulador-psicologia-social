import { TIPOS_NOTIFICACION } from '../notificaciones/notificaciones.factory.js';

const MAX_INT_MYSQL = 2147483647;
const ESTADOS_ACTIVIDAD = Object.freeze({
  PROGRAMADA: 'Programada',
  INICIADA: 'Iniciada',
  CERRADA: 'Cerrada'
});

function errorActividad(codigo, mensaje, statusCode = 400) {
  return Object.assign(new Error(mensaje), { codigo, statusCode });
}

function validarId(valor, nombre) {
  if (
    !Number.isSafeInteger(valor) ||
    valor <= 0 ||
    valor > MAX_INT_MYSQL
  ) {
    throw new TypeError(`${nombre} debe ser un entero positivo válido.`);
  }
}

function normalizarFecha(valor, nombre) {
  let anio;
  let mes;
  let dia;
  let hora;
  let minuto;
  let segundo;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      throw new TypeError(`${nombre} no es una fecha válida.`);
    }

    anio = valor.getFullYear();
    mes = valor.getMonth() + 1;
    dia = valor.getDate();
    hora = valor.getHours();
    minuto = valor.getMinutes();
    segundo = valor.getSeconds();
  } else if (typeof valor === 'string') {
    const coincidencia = valor.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (!coincidencia) {
      throw new TypeError(
        `${nombre} debe tener formato YYYY-MM-DDTHH:mm o YYYY-MM-DD HH:mm:ss.`
      );
    }

    [
      ,
      anio,
      mes,
      dia,
      hora,
      minuto,
      segundo
    ] = coincidencia;

    anio = Number(anio);
    mes = Number(mes);
    dia = Number(dia);
    hora = Number(hora);
    minuto = Number(minuto);
    segundo = Number(segundo ?? 0);
  } else {
    throw new TypeError(`${nombre} debe ser una fecha válida.`);
  }

  if (anio < 1000 || anio > 9999) {
    throw new TypeError(`${nombre} debe tener un año válido para MySQL.`);
  }

  const fecha = new Date(anio, mes - 1, dia, hora, minuto, segundo);

  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() + 1 !== mes ||
    fecha.getDate() !== dia ||
    fecha.getHours() !== hora ||
    fecha.getMinutes() !== minuto ||
    fecha.getSeconds() !== segundo
  ) {
    throw new TypeError(`${nombre} contiene una fecha u hora inválida.`);
  }

  const completar = (numero) => String(numero).padStart(2, '0');

  return `${anio}-${completar(mes)}-${completar(dia)} ` +
    `${completar(hora)}:${completar(minuto)}:${completar(segundo)}`;
}

function validarTextoOpcional(valor, nombre, longitudMaxima = null) {
  if (valor == null) {
    return null;
  }

  if (typeof valor !== 'string') {
    throw new TypeError(`${nombre} debe ser un texto.`);
  }

  const texto = valor.trim();

  if (longitudMaxima && texto.length > longitudMaxima) {
    throw new TypeError(
      `${nombre} no puede superar ${longitudMaxima} caracteres.`
    );
  }

  return texto || null;
}

function validarDatosActividad(datos, docenteId) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new TypeError('Los datos de la actividad no son válidos.');
  }

  validarId(docenteId, 'docenteId');
  validarId(datos.casoId, 'casoId');
  validarId(datos.espacioAcademicoId, 'espacioAcademicoId');
  validarId(datos.rubricaId, 'rubricaId');

  const tiempoLimiteSegundos = datos.tiempoLimiteSegundos;
  const intentosPermitidos = datos.intentosPermitidos ?? 1;

  if (
    !Number.isInteger(tiempoLimiteSegundos) ||
    tiempoLimiteSegundos <= 0 ||
    tiempoLimiteSegundos > MAX_INT_MYSQL
  ) {
    throw new TypeError(
      'El tiempo límite debe ser un entero positivo válido para MySQL.'
    );
  }

  if (
    !Number.isInteger(intentosPermitidos) ||
    intentosPermitidos < 1 ||
    intentosPermitidos > MAX_INT_MYSQL
  ) {
    throw new TypeError(
      'Los intentos permitidos deben ser un entero mayor o igual a uno.'
    );
  }

  if (
    !Array.isArray(datos.estudiantesIds) ||
    datos.estudiantesIds.length === 0
  ) {
    throw new TypeError('Debe asociarse al menos un estudiante.');
  }

  datos.estudiantesIds.forEach((id) => validarId(id, 'estudianteId'));

  const estudiantesUnicos = new Set(datos.estudiantesIds);

  if (estudiantesUnicos.size !== datos.estudiantesIds.length) {
    throw new TypeError('No se permiten estudiantes duplicados.');
  }

  const fechaInicio = normalizarFecha(datos.fechaInicio, 'fechaInicio');
  const fechaFin = normalizarFecha(datos.fechaFin, 'fechaFin');

  if (fechaFin <= fechaInicio) {
    throw errorActividad(
      'FECHAS_INVALIDAS',
      'La fecha de finalización debe ser posterior a la de inicio.'
    );
  }

  return {
    casoId: datos.casoId,
    espacioAcademicoId: datos.espacioAcademicoId,
    docenteId,
    rubricaId: datos.rubricaId,
    fechaInicio,
    fechaFin,
    tiempoLimiteSegundos,
    lugar: validarTextoOpcional(datos.lugar, 'lugar', 255),
    mensajePersonalizado: validarTextoOpcional(
      datos.mensajePersonalizado,
      'mensajePersonalizado'
    ),
    intentosPermitidos,
    estudiantesIds: [...datos.estudiantesIds]
  };
}

function resolverCodigo(generado) {
  const codigo = generado?.codigo;
  const codigoHash = generado?.codigoHash;

  if (
    typeof codigo !== 'string' ||
    !codigo.trim() ||
    codigo.length > 100 ||
    typeof codigoHash !== 'string' ||
    !codigoHash.trim() ||
    codigoHash.length > 100
  ) {
    throw new TypeError(
      'El generador debe usar crearCodigoAutorizacion() y devolver el código y su hash.'
    );
  }

  return { codigo: codigo.trim(), codigoHash };
}

export function crearServicioActividades(
  repositorio,
  crearCodigoAutorizacion,
  reloj = () => new Date(),
  notificaciones = null
) {
  if (!repositorio || typeof repositorio.enTransaccion !== 'function') {
    throw new TypeError('Se requiere un repositorio de actividades válido.');
  }

  if (
    typeof repositorio.obtenerActividadPorId !== 'function' ||
    typeof repositorio.listarEstudiantesAutorizados !== 'function'
  ) {
    throw new TypeError('El repositorio no tiene las operaciones de consulta requeridas.');
  }

  if (typeof crearCodigoAutorizacion !== 'function') {
    throw new TypeError('Se requiere crearCodigoAutorizacion() del módulo de acceso.');
  }

  if (typeof reloj !== 'function') {
    throw new TypeError('El reloj debe ser una función.');
  }

  if (
    notificaciones != null &&
    typeof notificaciones.enviar !== 'function'
  ) {
    throw new TypeError('Se requiere el servicio de notificaciones.');
  }

  return {
    async crear(datos, docenteId) {
      const actividad = validarDatosActividad(datos, docenteId);

      const fechaCreacion = normalizarFecha(
        reloj(),
        'fechaCreacion'
      );

      const { actividad: creada, convocatorias } = await repositorio.enTransaccion(async (transaccion) => {
        const caso = await transaccion.obtenerCaso(actividad.casoId);

        if (!caso) {
          throw errorActividad(
            'CASO_NO_EXISTE',
            'El caso académico no existe.',
            404
          );
        }

        if (caso.estado !== 'Publicado') {
          throw errorActividad(
            'CASO_NO_PUBLICADO',
            'Solo se pueden programar casos publicados.',
            409
          );
        }

        if (
          actividad.tiempoLimiteSegundos >
          Number(caso.tiempoEstimadoSegundos)
        ) {
          throw errorActividad(
            'TIEMPO_SUPERA_CASO',
            'El tiempo límite no puede superar el tiempo estimado del caso.'
          );
        }

        const espacio = await transaccion.obtenerEspacioAcademico(
          actividad.espacioAcademicoId
        );

        if (!espacio) {
          throw errorActividad(
            'ESPACIO_NO_EXISTE',
            'El espacio académico no existe.',
            404
          );
        }

        if (Number(espacio.activo) !== 1) {
          throw errorActividad(
            'ESPACIO_INACTIVO',
            'El espacio académico no está activo.',
            409
          );
        }

        const docente = await transaccion.obtenerDocente(
          actividad.docenteId
        );

        if (!docente) {
          throw errorActividad(
            'DOCENTE_NO_EXISTE',
            'El docente no existe.',
            404
          );
        }

        if (Number(docente.activo) !== 1) {
          throw errorActividad(
            'DOCENTE_INACTIVO',
            'La cuenta del docente no está activa.',
            403
          );
        }

        if (Number(docente.esDocente) !== 1) {
          throw errorActividad(
            'USUARIO_NO_ES_DOCENTE',
            'El usuario no tiene asignado el rol Docente.',
            403
          );
        }

        const rubrica = await transaccion.obtenerRubrica(
          actividad.rubricaId,
          actividad.casoId
        );

        if (!rubrica) {
          throw errorActividad(
            'RUBRICA_NO_CORRESPONDE',
            'La rúbrica no existe o no pertenece al caso seleccionado.',
            409
          );
        }

        if (Number(rubrica.activa) !== 1) {
          throw errorActividad(
            'RUBRICA_INACTIVA',
            'La rúbrica seleccionada no está activa.',
            409
          );
        }

        const estudiantes = await transaccion.obtenerEstudiantes(
          actividad.estudiantesIds
        );

        if (estudiantes.length !== actividad.estudiantesIds.length) {
          throw errorActividad(
            'ESTUDIANTE_NO_EXISTE',
            'Uno o más estudiantes no existen.',
            404
          );
        }

        const estudiantesPorId = new Map(
          estudiantes.map((estudiante) => [
            Number(estudiante.id),
            estudiante
          ])
        );

        for (const estudianteId of actividad.estudiantesIds) {
          const estudiante = estudiantesPorId.get(estudianteId);

          if (Number(estudiante.activo) !== 1) {
            throw errorActividad(
              'ESTUDIANTE_INACTIVO',
              `El estudiante ${estudianteId} no está activo.`,
              403
            );
          }

          if (Number(estudiante.esEstudiante) !== 1) {
            throw errorActividad(
              'USUARIO_NO_ES_ESTUDIANTE',
              `El usuario ${estudianteId} no tiene el rol Estudiante.`,
              403
            );
          }
        }

        const actividadId = await transaccion.insertarActividad({
          ...actividad,
          fechaCreacion
        });

        const autorizaciones = [];
        const convocatorias = [];
        const codigosUtilizados = new Set();

        for (const estudianteId of actividad.estudiantesIds) {
          const { codigo, codigoHash } = resolverCodigo(crearCodigoAutorizacion());
          const estudiante = estudiantesPorId.get(estudianteId);

          if (codigosUtilizados.has(codigo) || codigosUtilizados.has(codigoHash)) {
            throw errorActividad(
              'CODIGO_DUPLICADO',
              'Se generaron códigos de autorización repetidos.',
              409
            );
          }

          codigosUtilizados.add(codigo);
          codigosUtilizados.add(codigoHash);

          if (
            notificaciones &&
            (typeof estudiante.correo !== 'string' || !estudiante.correo.trim())
          ) {
            throw errorActividad(
              'ESTUDIANTE_SIN_CORREO',
              `El estudiante ${estudianteId} no tiene correo institucional.`,
              422
            );
          }

          let autorizacionId;

          try {
            autorizacionId = await transaccion.insertarEstudianteAutorizado({
              actividadId,
              estudianteId,
              codigoAutorizacion: codigoHash,
              fechaAutorizacion: fechaCreacion
            });
          } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
              throw errorActividad(
                'CODIGO_DUPLICADO',
                'No se pudo registrar el código porque ya existe.',
                409
              );
            }

            throw error;
          }

          autorizaciones.push({
            id: autorizacionId,
            estudianteId,
            codigoAutorizacion: codigo
          });

          if (notificaciones) {
            convocatorias.push({
              destinatario: estudiante.correo.trim(),
              caso: {
                titulo: caso.titulo,
                desarrolloSituacional: caso.desarrolloSituacional ?? '',
                contextoHistoria: caso.contextoHistoria ?? ''
              },
              mensajePersonalizado: actividad.mensajePersonalizado,
              urlAcceso: process.env.URL_ACCESO || 'http://localhost:3000',
              codigoAutorizacion: codigo
            });
          }
        }

        return {
          actividad: {
            id: actividadId,
            ...actividad,
            estado: ESTADOS_ACTIVIDAD.PROGRAMADA,
            fechaCreacion,
            estudiantesAutorizados: autorizaciones
          },
          convocatorias
        };
      });

      if (notificaciones) {
        for (const convocatoria of convocatorias) {
          await notificaciones.enviar(TIPOS_NOTIFICACION.CONVOCATORIA, convocatoria);
        }
      }

      return creada;
    },

    async iniciar(actividadId, docenteId) {
      return cambiarEstadoActividad(
        repositorio,
        actividadId,
        docenteId,
        ESTADOS_ACTIVIDAD.INICIADA
      );
    },

    async cerrar(actividadId, docenteId) {
      return cambiarEstadoActividad(
        repositorio,
        actividadId,
        docenteId,
        ESTADOS_ACTIVIDAD.CERRADA
      );
    },

async cerrarVencidas() {
  if (typeof repositorio.cerrarActividadesVencidas !== 'function') {
    throw new TypeError(
      'El repositorio no puede cerrar actividades vencidas.'
    );
  }

  const fechaActual = normalizarFecha(
    reloj(),
    'fechaActual'
  );

  return repositorio.cerrarActividadesVencidas(fechaActual);
},

    async consultarPorId(actividadId) {
      validarId(actividadId, 'actividadId');

      const actividad = await repositorio.obtenerActividadPorId(
        actividadId
      );

      if (!actividad) {
        throw errorActividad(
          'ACTIVIDAD_NO_EXISTE',
          'La actividad programada no existe.',
          404
        );
      }

      const estudiantesAutorizados =
        await repositorio.listarEstudiantesAutorizados(actividadId);

      return {
        ...actividad,
        estudiantesAutorizados
      };
    }
  };
}

async function cambiarEstadoActividad(
  repositorio,
  actividadId,
  docenteId,
  estado
) {
  validarId(actividadId, 'actividadId');
  validarId(docenteId, 'docenteId');

  if (typeof repositorio.actualizarEstado !== 'function') {
    throw new TypeError(
      'El repositorio no puede actualizar el estado de la actividad.'
    );
  }

  const actividad = await repositorio.obtenerActividadPorId(actividadId);

  if (!actividad) {
    throw errorActividad(
      'ACTIVIDAD_NO_EXISTE',
      'La actividad programada no existe.',
      404
    );
  }

  if (Number(actividad.docenteId) !== docenteId) {
    throw errorActividad(
      'ACTIVIDAD_AJENA',
      'No tiene autorización para modificar esta actividad.',
      403
    );
  }

  const transicionesPermitidas = {
    [ESTADOS_ACTIVIDAD.PROGRAMADA]: ESTADOS_ACTIVIDAD.INICIADA,
    [ESTADOS_ACTIVIDAD.INICIADA]: ESTADOS_ACTIVIDAD.CERRADA
  };

  const estadoEsperado = transicionesPermitidas[actividad.estado];

  if (estadoEsperado !== estado) {
    throw errorActividad(
      'TRANSICION_INVALIDA',
      `No se puede cambiar una actividad de ${actividad.estado} a ${estado}.`,
      409
    );
  }

  const filas = await repositorio.actualizarEstado(
    actividadId,
    estado
  );

  if (!filas) {
    throw errorActividad(
      'ACTIVIDAD_NO_EXISTE',
      'La actividad programada no existe.',
      404
    );
  }

  return { ...actividad, estado };
}
