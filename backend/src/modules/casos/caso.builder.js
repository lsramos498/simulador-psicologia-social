import { validarCaso } from './caso.validacion.js';

/**
 * Builder del agregado Caso.
 * Un caso reúne datos básicos, personajes, escenas, preguntas, opciones,
 * explicaciones y una rúbrica. El armado por pasos evita un constructor
 * con decenas de parámetros y build() solo entrega una estructura ya validada.
 */
export class CasoBuilder {
  constructor() {
    this._creadorId = null;
    this._titulo = null;
    this._desarrolloSituacional = null;
    this._contextoHistoria = null;
    this._tiempoEstimadoSegundos = null;
    this._personajes = [];
    this._escenas = [];
    this._rubrica = null;
  }

  conCreador(creadorId) {
    this._creadorId = creadorId;
    return this;
  }

  conTitulo(titulo) {
    this._titulo = titulo;
    return this;
  }

  conDesarrolloSituacional(desarrolloSituacional) {
    this._desarrolloSituacional = desarrolloSituacional;
    return this;
  }

  conContextoHistoria(contextoHistoria) {
    this._contextoHistoria = contextoHistoria;
    return this;
  }

  conTiempoEstimadoSegundos(tiempoEstimadoSegundos) {
    this._tiempoEstimadoSegundos = tiempoEstimadoSegundos;
    return this;
  }

  agregarPersonaje(personaje) {
    this._personajes.push(personaje);
    return this;
  }

  agregarEscena(escena) {
    this._escenas.push(escena);
    return this;
  }

  conRubrica(rubrica) {
    this._rubrica = rubrica;
    return this;
  }

  build() {
    return validarCaso({
      creadorId: this._creadorId,
      titulo: this._titulo,
      desarrolloSituacional: this._desarrolloSituacional,
      contextoHistoria: this._contextoHistoria,
      tiempoEstimadoSegundos: this._tiempoEstimadoSegundos,
      personajes: this._personajes,
      escenas: this._escenas,
      rubrica: this._rubrica
    });
  }
}

export function construirCaso(datos) {
  const builder = new CasoBuilder()
    .conCreador(datos?.creadorId)
    .conTitulo(datos?.titulo)
    .conDesarrolloSituacional(datos?.desarrolloSituacional)
    .conContextoHistoria(datos?.contextoHistoria)
    .conTiempoEstimadoSegundos(datos?.tiempoEstimadoSegundos);

  for (const personaje of datos?.personajes ?? []) {
    builder.agregarPersonaje(personaje);
  }

  for (const escena of datos?.escenas ?? []) {
    builder.agregarEscena(escena);
  }

  if (datos?.rubrica != null) {
    builder.conRubrica(datos.rubrica);
  }

  return builder.build();
}
