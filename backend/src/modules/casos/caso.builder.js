import { validarCaso } from './caso.validacion.js';

/**
 * Patrón Builder del agregado Caso (Stefanía Díaz — casos académicos).
 * RF-05 a RF-09: un caso reúne datos básicos, personajes, escenas, preguntas,
 * opciones, explicaciones y (RF-17) una rúbrica.
 *
 * Por qué un Builder: el armado por pasos evita un constructor con decenas de
 * parámetros y separa tres responsabilidades:
 *  - Builder: construcción + validación estructural (este archivo).
 *  - Servicio: reglas de aplicación (docente activo, estado, propietario).
 *  - Repositorio: persistencia en MySQL.
 *
 * Importante: `build()` NO guarda nada en la base de datos; solo entrega una
 * estructura ya validada. Guardarla es decisión de `casos.service.js`.
 */
export class CasoBuilder {
  /**
   * Crea un builder vacío. Los campos se completan con los métodos `con*` y
   * `agregar*`; la lista de personajes y escenas arranca vacía.
   */
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

  /**
   * Define el docente creador del caso.
   * @param {number} creadorId  Id del usuario (Usuario.id) que crea el caso.
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  conCreador(creadorId) {
    this._creadorId = creadorId;
    return this;
  }

  /**
   * Define el título del caso (obligatorio, máximo 200 caracteres al validar).
   * @param {string} titulo
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  conTitulo(titulo) {
    this._titulo = titulo;
    return this;
  }

  /**
   * Define el desarrollo situacional: la situación que el estudiante analiza.
   * @param {string} desarrolloSituacional  Texto obligatorio.
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  conDesarrolloSituacional(desarrolloSituacional) {
    this._desarrolloSituacional = desarrolloSituacional;
    return this;
  }

  /**
   * Define el contexto de la historia que enmarca el caso.
   * @param {string} contextoHistoria  Texto obligatorio.
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  conContextoHistoria(contextoHistoria) {
    this._contextoHistoria = contextoHistoria;
    return this;
  }

  /**
   * Define el tiempo estimado de resolución del caso.
   * @param {number} tiempoEstimadoSegundos  Entero positivo, en segundos.
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  conTiempoEstimadoSegundos(tiempoEstimadoSegundos) {
    this._tiempoEstimadoSegundos = tiempoEstimadoSegundos;
    return this;
  }

  /**
   * Agrega un personaje al caso. Puede llamarse varias veces.
   * La validación (nombre obligatorio y sin repetir) ocurre en `build()`.
   * @param {{ nombre: string, rolSocial?: string, perfil?: string, pautasComportamiento?: string }} personaje
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  agregarPersonaje(personaje) {
    this._personajes.push(personaje);
    return this;
  }

  /**
   * Agrega una escena (con sus preguntas y opciones anidadas). Puede llamarse
   * varias veces; el campo `orden` no debe repetirse entre escenas.
   * @param {{ nombre: string, contexto: string, orden: number, esFinal?: boolean,
   *   personajes?: Array<string|{nombre: string}>, decisiones?: object[] }} escena
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  agregarEscena(escena) {
    this._escenas.push(escena);
    return this;
  }

  /**
   * Asocia la rúbrica de evaluación al caso (RF-17). Es opcional al construir,
   * pero se exige para publicar.
   * @param {{ nombre: string, descripcion?: string, criterios: object[] }} rubrica
   * @returns {CasoBuilder} El mismo builder, para encadenar llamadas.
   */
  conRubrica(rubrica) {
    this._rubrica = rubrica;
    return this;
  }

  /**
   * Valida y entrega el caso armado. No persiste nada.
   * @returns {object} Caso normalizado (textos recortados, números validados).
   * @throws {Error} Error de dominio `ESTRUCTURA_INVALIDA` (422) con la lista
   *   `errores` si falta algún dato o la estructura no cumple las reglas.
   */
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

/**
 * Atajo que arma un caso a partir de un objeto plano (por ejemplo, el cuerpo
 * JSON de `POST /api/casos/construir`) usando internamente `CasoBuilder`.
 * Es tolerante a `datos` nulo: los campos faltantes los reporta `build()`.
 *
 * @param {object} datos  Objeto con `creadorId`, `titulo`, `desarrolloSituacional`,
 *   `contextoHistoria`, `tiempoEstimadoSegundos` y, opcionalmente, las listas
 *   `personajes`, `escenas` y el objeto `rubrica`.
 * @returns {object} Caso validado y normalizado (no persistido).
 * @throws {Error} `ESTRUCTURA_INVALIDA` (422) si los datos no son válidos.
 */
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
