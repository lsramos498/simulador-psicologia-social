function opcion(orden, esCorrecta) {
  return {
    texto: '',
    esCorrecta,
    consecuencia: '',
    orden,
    explicacion: '',
    fundamentoTeorico: ''
  };
}

function decision(orden) {
  return {
    pregunta: '',
    orden,
    ayuda: '',
    opciones: [opcion(1, true), opcion(2, false)]
  };
}

export function casoVacio() {
  return {
    titulo: '',
    desarrolloSituacional: '',
    contextoHistoria: '',
    tiempoEstimadoSegundos: 600,
    personajes: [],
    escenas: [
      {
        nombre: '',
        contexto: '',
        orden: 1,
        esFinal: false,
        personajes: [],
        decisiones: [decision(1)]
      }
    ],
    rubrica: {
      nombre: '',
      descripcion: '',
      criterios: [
        {
          nombre: '',
          descripcion: '',
          ponderacion: 100,
          puntajeMaximo: 5,
          niveles: [
            { nombre: 'Inicial', descripcion: '', puntaje: 2, orden: 1 },
            { nombre: 'Logrado', descripcion: '', puntaje: 5, orden: 2 }
          ]
        }
      ]
    }
  };
}

export function prepararCaso(caso, creadorId) {
  return {
    creadorId: Number(creadorId),
    titulo: caso.titulo,
    desarrolloSituacional: caso.desarrolloSituacional,
    contextoHistoria: caso.contextoHistoria,
    tiempoEstimadoSegundos: Number(caso.tiempoEstimadoSegundos),
    personajes: caso.personajes
      .filter((personaje) => personaje.nombre.trim())
      .map((personaje) => ({
        nombre: personaje.nombre,
        rolSocial: personaje.rolSocial,
        perfil: personaje.perfil,
        pautasComportamiento: personaje.pautasComportamiento
      })),
    escenas: caso.escenas.map((escena) => ({
      nombre: escena.nombre,
      contexto: escena.contexto,
      orden: Number(escena.orden),
      esFinal: Boolean(escena.esFinal),
      personajes: escena.personajes,
      decisiones: escena.decisiones.map((item) => ({
        pregunta: item.pregunta,
        orden: Number(item.orden),
        ayuda: item.ayuda,
        opciones: item.opciones.map((itemOpcion) => ({
          texto: itemOpcion.texto,
          esCorrecta: Boolean(itemOpcion.esCorrecta),
          consecuencia: itemOpcion.consecuencia,
          orden: Number(itemOpcion.orden),
          explicacion: itemOpcion.explicacion,
          fundamentoTeorico: itemOpcion.fundamentoTeorico
        }))
      }))
    })),
    rubrica: {
      nombre: caso.rubrica.nombre,
      descripcion: caso.rubrica.descripcion,
      criterios: caso.rubrica.criterios.map((criterio) => ({
        nombre: criterio.nombre,
        descripcion: criterio.descripcion,
        ponderacion: Number(criterio.ponderacion),
        puntajeMaximo: Number(criterio.puntajeMaximo),
        niveles: criterio.niveles.map((nivel) => ({
          nombre: nivel.nombre,
          descripcion: nivel.descripcion,
          puntaje: Number(nivel.puntaje),
          orden: Number(nivel.orden)
        }))
      }))
    }
  };
}

export function renumerar(lista) {
  return lista.map((item, indice) => ({ ...item, orden: indice + 1 }));
}
