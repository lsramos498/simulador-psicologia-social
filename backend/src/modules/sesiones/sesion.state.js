export const ESTADOS_SESION = Object.freeze({
  SIN_INICIAR: 'Sin iniciar',
  EN_CURSO: 'En curso',
  FINALIZADO: 'Finalizado'
});

export const MOTIVOS_CIERRE = Object.freeze({
  FINALIZACION: 'Finalizacion',
  TIEMPO_AGOTADO: 'TiempoAgotado',
  CIERRE_DOCENTE: 'CierreDocente',
  CIERRE_AUTOMATICO: 'CierreAutomatico'
});

function convertirFecha(fecha, nombre) {
  const resultado = fecha instanceof Date
    ? new Date(fecha.getTime())
    : new Date(fecha);

  if (Number.isNaN(resultado.getTime())) {
    throw new Error(`${nombre} debe ser una fecha válida.`);
  }

  return resultado;
}

class EstadoBase {
  iniciar() {
    throw new Error('La sesión no puede iniciarse desde su estado actual.');
  }

  finalizar() {
    throw new Error('La sesión no puede finalizarse desde su estado actual.');
  }
}

class EstadoSinIniciar extends EstadoBase {
  iniciar(sesion, fechaInicio) {
    if (sesion.inicio !== null) {
      throw new Error('La sesión ya tiene una fecha de inicio.');
    }

    sesion.inicio = convertirFecha(fechaInicio, 'fechaInicio');
    sesion.estado = ESTADOS_SESION.EN_CURSO;
    sesion._estado = new EstadoEnCurso();
  }
}

class EstadoEnCurso extends EstadoBase {
  finalizar(sesion, {
    fechaFin = new Date(),
    segundosConsumidos,
    motivoCierre = MOTIVOS_CIERRE.FINALIZACION
  } = {}) {
    const fin = convertirFecha(fechaFin, 'fechaFin');

    if (!sesion.inicio) {
      throw new Error('La sesión no tiene una fecha de inicio.');
    }

    if (fin < sesion.inicio) {
      throw new Error('La fecha de finalización no puede ser anterior al inicio.');
    }

    const segundos = segundosConsumidos ??
      Math.floor((fin.getTime() - sesion.inicio.getTime()) / 1000);

    if (!Number.isInteger(segundos) || segundos < 0) {
      throw new Error('Los segundos consumidos deben ser un entero no negativo.');
    }

    const motivosPermitidos = Object.values(MOTIVOS_CIERRE);

    if (!motivosPermitidos.includes(motivoCierre)) {
      throw new Error(`Motivo de cierre no válido: ${motivoCierre}`);
    }

    sesion.fin = fin;
    sesion.segundosConsumidos = segundos;
    sesion.motivoCierre = motivoCierre;
    sesion.estado = ESTADOS_SESION.FINALIZADO;
    sesion._estado = new EstadoFinalizado();
  }
}

class EstadoFinalizado extends EstadoBase {}

function crearEstado(estado) {
  switch (estado) {
    case ESTADOS_SESION.SIN_INICIAR:
      return new EstadoSinIniciar();

    case ESTADOS_SESION.EN_CURSO:
      return new EstadoEnCurso();

    case ESTADOS_SESION.FINALIZADO:
      return new EstadoFinalizado();

    default:
      throw new Error(`Estado de sesión no válido: ${estado}`);
  }
}

export class SesionSimulacion {
  constructor({
    id = null,
    actividadId,
    estudianteId,
    numeroIntento = 1,
    estado = ESTADOS_SESION.SIN_INICIAR,
    inicio = null,
    fin = null,
    segundosConsumidos = 0,
    motivoCierre = null
  }) {
    if (!Number.isInteger(numeroIntento) || numeroIntento < 1) {
      throw new Error('El número de intento debe ser un entero mayor o igual a 1.');
    }

    if (!Number.isInteger(segundosConsumidos) || segundosConsumidos < 0) {
      throw new Error('Los segundos consumidos deben ser un entero no negativo.');
    }

    this.id = id;
    this.actividadId = actividadId;
    this.estudianteId = estudianteId;
    this.numeroIntento = numeroIntento;
    this.estado = estado;
    this.inicio = inicio === null ? null : convertirFecha(inicio, 'inicio');
    this.fin = fin === null ? null : convertirFecha(fin, 'fin');
    this.segundosConsumidos = segundosConsumidos;
    this.motivoCierre = motivoCierre;

    this._estado = crearEstado(estado);
  }

  iniciar(fechaInicio = new Date()) {
    this._estado.iniciar(this, fechaInicio);
    return this.toJSON();
  }

  finalizar(datos = {}) {
    this._estado.finalizar(this, datos);
    return this.toJSON();
  }

  toJSON() {
    return {
      id: this.id,
      actividadId: this.actividadId,
      estudianteId: this.estudianteId,
      numeroIntento: this.numeroIntento,
      estado: this.estado,
      inicio: this.inicio,
      fin: this.fin,
      segundosConsumidos: this.segundosConsumidos,
      motivoCierre: this.motivoCierre
    };
  }
}
