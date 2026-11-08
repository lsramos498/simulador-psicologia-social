
// PATRÓN OBSERVER: emisor que mantiene los observadores suscritos.
class EventosParticipacion {
  constructor() {
    this.observadores = [];
  }

  // PATRÓN OBSERVER: registra una función una sola vez para recibir eventos.
  suscribir(observador) {
    if (typeof observador !== 'function') {
      throw new TypeError('El observador debe ser una función');
    }

    if (!this.observadores.includes(observador)) {
      this.observadores.push(observador);
    }
  }

  // PATRÓN OBSERVER: retira un observador para que deje de recibir eventos.
  desuscribir(observador) {
    this.observadores = this.observadores.filter(
      (elemento) => elemento !== observador
    );
  }

  /**
   * Invoca inmediatamente a los observadores, conservando los efectos síncronos previos.
   * Devuelve una promesa con el resumen cuando todos terminan; sus fallos quedan controlados.
   * El índice identifica la posición en esta publicación, no una identidad persistente.
   * El resumen no incluye eventos, valores devueltos ni detalles privados de las excepciones.
   */
  // PATRÓN OBSERVER: publica a los suscritos y aísla el fallo de cada observador.
  notificar(evento) {
    // PATRÓN OBSERVER: cambios de suscripción durante el aviso aplican a la siguiente publicación.
    const pendientes = [...this.observadores].map((observador, indice) => {
      const fallo = () => ({ indice, codigo: 'OBSERVADOR_FALLO' });
      try {
        return Promise.resolve(observador(evento)).then(() => null, fallo);
      } catch {
        return Promise.resolve(fallo());
      }
    });

    return Promise.all(pendientes).then((resultados) => {
      const errores = resultados.filter((resultado) => resultado !== null);
      return {
        total: resultados.length,
        exitosos: resultados.length - errores.length,
        fallidos: errores.length,
        errores
      };
    });
  }
}


export { EventosParticipacion };

