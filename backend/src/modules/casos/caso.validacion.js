import { errorValidacion } from './caso.errores.js';

export const ESTADOS_CASO = Object.freeze({
  BORRADOR: 'Borrador',
  PUBLICADO: 'Publicado',
  ARCHIVADO: 'Archivado'
});

const MAX_INT = 2147483647;

function leerTexto(valor, etiqueta, errores, { requerido = true, maximo = null } = {}) {
  if (typeof valor !== 'string') {
    if (valor == null || valor === '') {
      if (requerido) {
        errores.push(`${etiqueta} es obligatorio.`);
      }
      return null;
    }
    errores.push(`${etiqueta} debe ser un texto.`);
    return null;
  }

  const limpio = valor.trim();
  if (!limpio) {
    if (requerido) {
      errores.push(`${etiqueta} es obligatorio.`);
    }
    return null;
  }

  if (maximo && limpio.length > maximo) {
    errores.push(`${etiqueta} no puede superar ${maximo} caracteres.`);
  }

  return limpio;
}

function leerEntero(valor, etiqueta, errores, { minimo = 1, maximo = MAX_INT } = {}) {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    errores.push(`${etiqueta} debe ser un entero entre ${minimo} y ${maximo}.`);
    return null;
  }
  return valor;
}

function leerBooleano(valor, etiqueta, errores) {
  if (typeof valor !== 'boolean') {
    errores.push(`${etiqueta} debe ser verdadero o falso.`);
    return false;
  }
  return valor;
}

function leerDecimal(valor, etiqueta, errores, { minimo = 0, maximo = 999999.99 } = {}) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    errores.push(`${etiqueta} debe ser un número.`);
    return null;
  }
  const redondeado = Math.round(valor * 100) / 100;
  if (redondeado < minimo || redondeado > maximo) {
    errores.push(`${etiqueta} debe estar entre ${minimo} y ${maximo}.`);
    return null;
  }
  return redondeado;
}

function ordenesRepetidos(items, etiqueta) {
  const vistos = new Set();
  const repetidos = [];
  for (const item of items) {
    if (item.orden == null || vistos.has(item.orden)) {
      if (item.orden != null) {
        repetidos.push(item.orden);
      }
    }
    vistos.add(item.orden);
  }
  return repetidos.length
    ? [`Hay ${etiqueta} con el mismo orden: ${[...new Set(repetidos)].join(', ')}.`]
    : [];
}

export function validarCreador(creadorId) {
  const errores = [];
  const id = leerEntero(creadorId, 'El docente creador', errores);
  if (errores.length) {
    throw errorValidacion(errores);
  }
  return id;
}

export function validarDatosBasicos(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos del caso no son válidos.']);
  }

  const titulo = leerTexto(datos.titulo, 'El título', errores, { maximo: 200 });
  const desarrolloSituacional = leerTexto(
    datos.desarrolloSituacional,
    'El desarrollo situacional',
    errores
  );
  const contextoHistoria = leerTexto(
    datos.contextoHistoria,
    'El contexto de la historia',
    errores
  );
  const tiempoEstimadoSegundos = leerEntero(
    datos.tiempoEstimadoSegundos,
    'El tiempo estimado en segundos',
    errores
  );

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return {
    titulo,
    desarrolloSituacional,
    contextoHistoria,
    tiempoEstimadoSegundos
  };
}

export function normalizarPersonaje(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos del personaje no son válidos.']);
  }

  const nombre = leerTexto(datos.nombre, 'El nombre del personaje', errores, { maximo: 100 });
  const rolSocial = leerTexto(datos.rolSocial, 'El rol social', errores, {
    requerido: false,
    maximo: 100
  });
  const perfil = leerTexto(datos.perfil, 'El perfil', errores, { requerido: false });
  const pautasComportamiento = leerTexto(
    datos.pautasComportamiento,
    'Las pautas de comportamiento',
    errores,
    { requerido: false }
  );

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return { nombre, rolSocial, perfil, pautasComportamiento };
}

export function normalizarOpcion(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos de la opción no son válidos.']);
  }

  const texto = leerTexto(datos.texto, 'El texto de la opción', errores);
  const esCorrecta = leerBooleano(datos.esCorrecta, 'La marca de opción esperada', errores);
  const consecuencia = leerTexto(datos.consecuencia, 'La consecuencia', errores, {
    requerido: false
  });
  const orden = leerEntero(datos.orden, 'El orden de la opción', errores);
  const explicacion = leerTexto(datos.explicacion, 'La explicación de la opción', errores);
  const fundamentoTeorico = leerTexto(
    datos.fundamentoTeorico,
    'El fundamento teórico',
    errores,
    { requerido: false }
  );

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return { texto, esCorrecta, consecuencia, orden, explicacion, fundamentoTeorico };
}

export function normalizarDecision(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos de la pregunta no son válidos.']);
  }

  const pregunta = leerTexto(datos.pregunta, 'La pregunta', errores);
  const orden = leerEntero(datos.orden, 'El orden de la pregunta', errores);
  const ayuda = leerTexto(datos.ayuda, 'La ayuda', errores, { requerido: false });
  const opciones = Array.isArray(datos.opciones)
    ? datos.opciones.map((opcion) => normalizarOpcion(opcion))
    : [];

  if (datos.opciones != null && !Array.isArray(datos.opciones)) {
    errores.push('Las opciones de la pregunta deben ser una lista.');
  }

  errores.push(...ordenesRepetidos(opciones, 'opciones'));

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return { pregunta, orden, ayuda, opciones };
}

function nombresDePersonajes(personajes) {
  if (personajes == null) {
    return [];
  }
  if (!Array.isArray(personajes)) {
    return null;
  }
  return personajes.map((personaje) => {
    if (typeof personaje === 'string') {
      return personaje.trim();
    }
    if (personaje && typeof personaje.nombre === 'string') {
      return personaje.nombre.trim();
    }
    return '';
  });
}

export function normalizarEscena(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos de la escena no son válidos.']);
  }

  const nombre = leerTexto(datos.nombre, 'El nombre de la escena', errores, { maximo: 150 });
  const contexto = leerTexto(datos.contexto, 'El contexto de la escena', errores);
  const orden = leerEntero(datos.orden, 'El orden de la escena', errores);
  const esFinal = leerBooleano(datos.esFinal ?? false, 'La marca de escena final', errores);
  const personajes = nombresDePersonajes(datos.personajes);
  const decisiones = Array.isArray(datos.decisiones)
    ? datos.decisiones.map((decision) => normalizarDecision(decision))
    : [];

  if (datos.decisiones != null && !Array.isArray(datos.decisiones)) {
    errores.push('Las preguntas de la escena deben ser una lista.');
  }
  if (personajes == null) {
    errores.push('Los personajes de la escena deben ser una lista.');
  } else if (personajes.some((nombre) => !nombre)) {
    errores.push('Cada personaje de la escena debe tener un nombre.');
  }

  errores.push(...ordenesRepetidos(decisiones, 'preguntas'));

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return {
    nombre,
    contexto,
    orden,
    esFinal,
    personajes: personajes ?? [],
    decisiones
  };
}

function normalizarNivel(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { errores: ['Los datos de un nivel de desempeño no son válidos.'], nivel: null };
  }

  const nombre = leerTexto(datos.nombre, 'El nombre del nivel', errores, { maximo: 80 });
  const descripcion = leerTexto(datos.descripcion, 'La descripción del nivel', errores);
  const puntaje = leerDecimal(datos.puntaje, 'El puntaje del nivel', errores, {
    minimo: 0,
    maximo: 999999.99
  });
  const orden = leerEntero(datos.orden, 'El orden del nivel', errores);

  return {
    errores,
    nivel: { nombre, descripcion, puntaje, orden }
  };
}

export function normalizarRubrica(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos de la rúbrica no son válidos.']);
  }

  const nombre = leerTexto(datos.nombre, 'El nombre de la rúbrica', errores, { maximo: 150 });
  const descripcion = leerTexto(datos.descripcion, 'La descripción de la rúbrica', errores, {
    requerido: false
  });

  if (!Array.isArray(datos.criterios) || datos.criterios.length === 0) {
    errores.push('La rúbrica debe tener al menos un criterio.');
  }

  const criterios = [];
  const nombres = new Set();

  for (const criterio of datos.criterios ?? []) {
    if (!criterio || typeof criterio !== 'object' || Array.isArray(criterio)) {
      errores.push('Un criterio de la rúbrica no es válido.');
      continue;
    }

    const nombreCriterio = leerTexto(criterio.nombre, 'El nombre del criterio', errores, {
      maximo: 150
    });
    const descripcionCriterio = leerTexto(
      criterio.descripcion,
      'La descripción del criterio',
      errores,
      { requerido: false }
    );
    const ponderacion = leerDecimal(criterio.ponderacion, 'La ponderación del criterio', errores, {
      minimo: 0.01,
      maximo: 100
    });
    const puntajeMaximo = leerDecimal(
      criterio.puntajeMaximo,
      'El puntaje máximo del criterio',
      errores,
      { minimo: 0.01, maximo: 999999.99 }
    );

    if (nombreCriterio) {
      const clave = nombreCriterio.toLocaleLowerCase('es');
      if (nombres.has(clave)) {
        errores.push(`El criterio «${nombreCriterio}» está repetido en la rúbrica.`);
      }
      nombres.add(clave);
    }

    if (!Array.isArray(criterio.niveles) || criterio.niveles.length === 0) {
      errores.push(`El criterio «${nombreCriterio || 'sin nombre'}» debe tener al menos un nivel.`);
    }

    const niveles = [];
    for (const nivel of criterio.niveles ?? []) {
      const resultado = normalizarNivel(nivel);
      errores.push(...resultado.errores);
      if (resultado.nivel) {
        if (
          resultado.nivel.puntaje != null &&
          puntajeMaximo != null &&
          resultado.nivel.puntaje > puntajeMaximo
        ) {
          errores.push(
            `El puntaje del nivel «${resultado.nivel.nombre || 'sin nombre'}» supera el máximo del criterio.`
          );
        }
        niveles.push(resultado.nivel);
      }
    }

    errores.push(...ordenesRepetidos(niveles, `niveles del criterio «${nombreCriterio || 'sin nombre'}»`));
    criterios.push({
      nombre: nombreCriterio,
      descripcion: descripcionCriterio,
      ponderacion,
      puntajeMaximo,
      niveles
    });
  }

  if (criterios.length > 0 && criterios.every((criterio) => criterio.ponderacion != null)) {
    const suma = Math.round(
      criterios.reduce((total, criterio) => total + criterio.ponderacion, 0) * 100
    ) / 100;
    if (suma !== 100) {
      errores.push(`La suma de las ponderaciones debe ser 100. Ahora suma ${suma}.`);
    }
  }

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return { nombre, descripcion, criterios };
}

export function validarCaso(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorValidacion(['Los datos del caso no son válidos.']);
  }

  const creadorId = validarCreador(datos.creadorId);
  const basicos = validarDatosBasicos(datos);
  const errores = [];

  if (datos.personajes != null && !Array.isArray(datos.personajes)) {
    errores.push('Los personajes deben ser una lista.');
  }
  if (datos.escenas != null && !Array.isArray(datos.escenas)) {
    errores.push('Las escenas deben ser una lista.');
  }

  const personajes = Array.isArray(datos.personajes)
    ? datos.personajes.map((personaje) => normalizarPersonaje(personaje))
    : [];
  const nombres = new Set();
  for (const personaje of personajes) {
    const clave = personaje.nombre.toLocaleLowerCase('es');
    if (nombres.has(clave)) {
      errores.push(`El personaje «${personaje.nombre}» está repetido.`);
    }
    nombres.add(clave);
  }

  const escenas = Array.isArray(datos.escenas)
    ? datos.escenas.map((escena) => normalizarEscena(escena))
    : [];
  errores.push(...ordenesRepetidos(escenas, 'escenas'));

  for (const escena of escenas) {
    for (const nombre of escena.personajes) {
      if (!nombres.has(nombre.toLocaleLowerCase('es'))) {
        errores.push(
          `La escena «${escena.nombre}» asocia al personaje «${nombre}», que no pertenece al caso.`
        );
      }
    }
  }

  const rubrica = datos.rubrica == null ? null : normalizarRubrica(datos.rubrica);

  if (errores.length) {
    throw errorValidacion(errores);
  }

  return {
    creadorId,
    ...basicos,
    personajes,
    escenas,
    rubrica
  };
}

function opcionMarcadaCorrecta(opcion) {
  return opcion.esCorrecta === true || opcion.esCorrecta === 1;
}

export function validarParaPublicar(caso) {
  const errores = [];
  const escenas = Array.isArray(caso?.escenas) ? caso.escenas : [];
  const decisiones = escenas.flatMap((escena) => escena.decisiones ?? []);

  if (escenas.length === 0) {
    errores.push('El caso debe tener al menos una escena antes de publicarse.');
  }

  if (decisiones.length === 0) {
    errores.push('El caso debe tener al menos una pregunta antes de publicarse.');
  }

  for (const decision of decisiones) {
    const opciones = decision.opciones ?? [];
    const pregunta = decision.pregunta || 'sin texto';

    if (opciones.length < 2) {
      errores.push(`La pregunta «${pregunta}» debe tener al menos dos opciones.`);
    }

    if (!opciones.some(opcionMarcadaCorrecta)) {
      errores.push(`La pregunta «${pregunta}» debe tener una opción esperada.`);
    }

    for (const opcion of opciones) {
      if (typeof opcion.explicacion !== 'string' || opcion.explicacion.trim() === '') {
        errores.push(`La opción «${opcion.texto || 'sin texto'}» debe tener una explicación.`);
      }
    }
  }

  if (!caso?.rubrica) {
    errores.push('El caso debe tener una rúbrica antes de publicarse.');
  } else {
    try {
      normalizarRubrica(caso.rubrica);
    } catch (error) {
      if (Array.isArray(error.errores)) {
        errores.push(...error.errores);
      } else {
        throw error;
      }
    }
  }

  if (errores.length) {
    throw errorValidacion(errores);
  }
}
