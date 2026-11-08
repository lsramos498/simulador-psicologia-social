
// PATRÓN OBSERVER: emisor que mantiene los observadores suscritos.
class EventosParticipacion {
  constructor() {
    this.observadores = [];
  }

  // PATRÓN OBSERVER: registra una función observadora para recibir eventos.
  suscribir(observador) {
    if (typeof observador !== 'function') {
      throw new TypeError('El observador debe ser una función');
    }

    this.observadores.push(observador);

  }

  // PATRÓN OBSERVER: retira un observador para que deje de recibir eventos.
  desuscribir(observador) {
  this.observadores = this.observadores.filter(
    (elemento) => elemento !== observador
  );
}

  // PATRÓN OBSERVER: entrega el evento a los observadores; un fallo interrumpe el recorrido.
  notificar(evento) {
    for (const observador of this.observadores) {
      observador(evento);
    }
  }
}


export { EventosParticipacion };

