
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

  desuscribir(observador) {
  this.observadores = this.observadores.filter(
    (elemento) => elemento !== observador
  );
}

  notificar(evento) {
    for (const observador of this.observadores) {
      observador(evento);
    }
  }
}


export { EventosParticipacion };

