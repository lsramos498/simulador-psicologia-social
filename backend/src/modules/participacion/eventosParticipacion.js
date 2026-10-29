
class EventosParticipacion {
  constructor() {
    this.observadores = [];
  }

  suscribir(observador) {
    if (typeof observador !== 'function') {
      throw new TypeError('El observador debe ser una función');
    }

    this.observadores.push(observador);
  }

  notificar(evento) {
    for (const observador of this.observadores) {
      observador(evento);
    }
  }
}

module.exports = { EventosParticipacion };

