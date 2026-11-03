import test from 'node:test';
import assert from 'node:assert/strict';
import { construirCaso } from '../src/modules/casos/caso.builder.js';
import {
  normalizarDecision,
  normalizarEscena,
  normalizarOpcion,
  normalizarPersonaje,
  normalizarRubrica,
  validarCaso,
  validarCreador,
  validarDatosBasicos,
  validarParaPublicar
} from '../src/modules/casos/caso.validacion.js';
import { crearServicioCasos } from '../src/modules/casos/casos.service.js';

function datosBasicos(extra = {}) {
  return {
    creadorId: 5,
    titulo: 'Conflicto en el aula',
    desarrolloSituacional: 'Dos grupos discuten una norma.',
    contextoHistoria: 'Primer semestre.',
    tiempoEstimadoSegundos: 600,
    ...extra
  };
}

function casoPublicable() {
  return {
    id: 1,
    estado: 'Borrador',
    escenas: [
      {
        nombre: 'Aula',
        decisiones: [
          {
            pregunta: '¿Cómo interviene?',
            opciones: [
              { texto: 'Escucha', esCorrecta: true, explicacion: 'Contiene el conflicto.' },
              { texto: 'Se va', esCorrecta: false, explicacion: 'Evita la situación.' }
            ]
          }
        ]
      }
    ],
    rubrica: {
      nombre: 'Rúbrica',
      criterios: [
        {
          nombre: 'Intervención',
          ponderacion: 100,
          puntajeMaximo: 4,
          niveles: [
            { nombre: 'Básico', descripcion: 'Nombra el conflicto.', puntaje: 1, orden: 1 }
          ]
        }
      ]
    }
  };
}

function repositorio(extra = {}) {
  const repo = {
    async obtenerUsuarioActivo(id) {
      return id === 5 ? { id } : null;
    },
    async enTransaccion(operacion) {
      return operacion(repo);
    },
    async obtenerPorId() {
      return { id: 1, estado: 'Borrador' };
    },
    ...extra
  };
  return repo;
}

test('los datos básicos recortan el título y exigen tiempo mayor que cero', () => {
  const datos = validarDatosBasicos({
    titulo: '  Caso  ',
    desarrolloSituacional: 'Desarrollo',
    contextoHistoria: 'Contexto',
    tiempoEstimadoSegundos: 90
  });

  assert.equal(datos.titulo, 'Caso');
  assert.throws(
    () => validarDatosBasicos({ ...datos, titulo: '   ' }),
    (error) => error.errores.some((item) => item.includes('título'))
  );
  assert.throws(
    () => validarDatosBasicos({ ...datos, tiempoEstimadoSegundos: 0 }),
    (error) => error.statusCode === 422
  );
});

test('el creador debe ser un entero positivo', () => {
  assert.equal(validarCreador(4), 4);
  assert.throws(() => validarCreador(0), (error) => error.codigo === 'ESTRUCTURA_INVALIDA');
  assert.throws(() => validarCreador(1.5), (error) => error.statusCode === 422);
});

test('cada opción exige explicación y una marca booleana', () => {
  const opcion = normalizarOpcion({
    texto: 'Escucha',
    esCorrecta: true,
    orden: 1,
    explicacion: 'Reconoce el conflicto.'
  });

  assert.equal(opcion.explicacion, 'Reconoce el conflicto.');
  assert.throws(
    () => normalizarOpcion({ texto: 'Escucha', esCorrecta: true, orden: 1, explicacion: '  ' }),
    (error) => error.errores.some((item) => item.includes('explicación'))
  );
  assert.throws(
    () => normalizarOpcion({ texto: 'Escucha', esCorrecta: 'si', orden: 1, explicacion: 'Texto' }),
    (error) => error.errores.some((item) => item.includes('verdadero o falso'))
  );
});

test('el caso rechaza escenas con el mismo orden y personajes ajenos', () => {
  assert.throws(
    () => validarCaso(datosBasicos({
      escenas: [
        { nombre: 'A', contexto: 'Uno', orden: 1, esFinal: false, decisiones: [] },
        { nombre: 'B', contexto: 'Dos', orden: 1, esFinal: false, decisiones: [] }
      ]
    })),
    (error) => error.errores.some((item) => item.includes('mismo orden'))
  );

  assert.throws(
    () => validarCaso(datosBasicos({
      personajes: [{ nombre: 'Ana' }, { nombre: ' ana ' }],
      escenas: []
    })),
    (error) => error.errores.some((item) => item.includes('repetido'))
  );
});

test('la rúbrica rechaza ponderaciones que no suman 100 y puntajes fuera de rango', () => {
  const valida = normalizarRubrica({
    nombre: 'Observación',
    criterios: [
      {
        nombre: 'Contexto',
        ponderacion: 60,
        puntajeMaximo: 5,
        niveles: [{ nombre: 'Inicial', descripcion: 'Describe.', puntaje: 2, orden: 1 }]
      },
      {
        nombre: 'Intervención',
        ponderacion: 40,
        puntajeMaximo: 5,
        niveles: [{ nombre: 'Inicial', descripcion: 'Propone.', puntaje: 2, orden: 1 }]
      }
    ]
  });

  assert.equal(valida.criterios.length, 2);
  assert.throws(
    () => normalizarRubrica({
      nombre: 'Observación',
      criterios: [
        {
          nombre: 'Contexto',
          ponderacion: 60,
          puntajeMaximo: 5,
          niveles: [{ nombre: 'Inicial', descripcion: 'Describe.', puntaje: 9, orden: 1 }]
        }
      ]
    }),
    (error) => {
      const texto = error.errores.join(' ');
      assert.match(texto, /supera el máximo/);
      assert.match(texto, /100/);
      return true;
    }
  );
});

test('publicar exige una opción esperada y la explicación de cada opción', () => {
  const sinEsperada = casoPublicable();
  sinEsperada.escenas[0].decisiones[0].opciones[0].esCorrecta = false;
  assert.throws(
    () => validarParaPublicar(sinEsperada),
    (error) => error.errores.some((item) => item.includes('opción esperada'))
  );

  const sinExplicacion = casoPublicable();
  sinExplicacion.escenas[0].decisiones[0].opciones[1].explicacion = '   ';
  assert.throws(
    () => validarParaPublicar(sinExplicacion),
    (error) => error.errores.some((item) => item.includes('explicación'))
  );
});

test('construirCaso no acepta un caso sin desarrollo situacional', () => {
  assert.throws(
    () => construirCaso(datosBasicos({ desarrolloSituacional: '' })),
    (error) => error.codigo === 'ESTRUCTURA_INVALIDA'
  );
});

test('publicar cambia el borrador completo a Publicado', async () => {
  const cambios = [];
  let lecturas = 0;
  const completo = casoPublicable();
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      lecturas += 1;
      return lecturas === 1 ? completo : { ...completo, estado: 'Publicado' };
    },
    async actualizarEstado(id, estado) {
      cambios.push({ id, estado });
      return 1;
    }
  }));

  const publicado = await servicio.publicar(1);

  assert.equal(publicado.estado, 'Publicado');
  assert.deepEqual(cambios, [{ id: 1, estado: 'Publicado' }]);
});

test('no se puede volver a archivar un caso archivado', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerPorId() {
      return { id: 1, estado: 'Archivado' };
    }
  }));

  await assert.rejects(
    () => servicio.archivar(1),
    (error) => error.codigo === 'CASO_YA_ARCHIVADO'
  );
});

test('la opción debe pertenecer a una pregunta del mismo caso', async () => {
  let inserto = false;
  const servicio = crearServicioCasos(repositorio({
    async obtenerDecision() {
      return { id: 8, casoId: 99 };
    },
    async insertarOpcion() {
      inserto = true;
    }
  }));

  await assert.rejects(
    () => servicio.agregarOpcion(1, 8, {
      texto: 'Escucha',
      esCorrecta: true,
      orden: 1,
      explicacion: 'Reconoce el conflicto.'
    }),
    (error) => error.codigo === 'DECISION_NO_EXISTE'
  );
  assert.equal(inserto, false);
});

test('un personaje de otro caso no se asocia a la escena', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerEscena() {
      return { id: 2, casoId: 1 };
    },
    async obtenerPersonaje() {
      return { id: 7, casoId: 40 };
    }
  }));

  await assert.rejects(
    () => servicio.asociarPersonaje(1, 2, 7),
    (error) => error.codigo === 'PERSONAJE_AJENO' && error.statusCode === 422
  );
});

test('guardar la rúbrica solo ocurre si el caso sigue en borrador', async () => {
  let guardada = null;
  const servicio = crearServicioCasos(repositorio({
    async guardarRubrica(_id, rubrica) {
      guardada = rubrica;
    },
    async obtenerCompleto(id) {
      return { id, estado: 'Borrador', rubrica: guardada };
    }
  }));

  const caso = await servicio.guardarRubrica(1, {
    nombre: 'Rúbrica de aula',
    criterios: [
      {
        nombre: 'Intervención',
        ponderacion: 100,
        puntajeMaximo: 5,
        niveles: [
          { nombre: 'Inicial', descripcion: 'Describe el hecho.', puntaje: 2, orden: 1 }
        ]
      }
    ]
  });

  assert.equal(guardada.nombre, 'Rúbrica de aula');
  assert.equal(caso.rubrica.nombre, 'Rúbrica de aula');
});

test('el personaje exige nombre y deja vacíos los datos opcionales', () => {
  const personaje = normalizarPersonaje({ nombre: '  Ana  ' });

  assert.equal(personaje.nombre, 'Ana');
  assert.equal(personaje.rolSocial, null);
  assert.equal(personaje.perfil, null);
  assert.throws(
    () => normalizarPersonaje({ nombre: '   ' }),
    (error) => error.errores.some((item) => item.includes('nombre'))
  );
});

test('la pregunta rechaza opciones con el mismo orden y una lista inválida', () => {
  assert.throws(
    () => normalizarDecision({
      pregunta: '¿Qué hace?',
      orden: 1,
      opciones: [
        { texto: 'A', esCorrecta: true, orden: 1, explicacion: 'Una' },
        { texto: 'B', esCorrecta: false, orden: 1, explicacion: 'Otra' }
      ]
    }),
    (error) => error.errores.some((item) => item.includes('mismo orden'))
  );

  assert.throws(
    () => normalizarDecision({ pregunta: '¿Qué hace?', orden: 1, opciones: 'no' }),
    (error) => error.errores.some((item) => item.includes('lista'))
  );
});

test('la escena exige el nombre de cada personaje y asume que no es final', () => {
  const escena = normalizarEscena({
    nombre: 'Aula',
    contexto: 'Inicio',
    orden: 1,
    decisiones: []
  });

  assert.equal(escena.esFinal, false);
  assert.deepEqual(escena.personajes, []);
  assert.throws(
    () => normalizarEscena({
      nombre: 'Aula',
      contexto: 'Inicio',
      orden: 1,
      personajes: [''],
      decisiones: []
    }),
    (error) => error.errores.some((item) => item.includes('nombre'))
  );
});

test('el título no puede superar 200 caracteres', () => {
  assert.throws(
    () => validarDatosBasicos({
      titulo: 'a'.repeat(201),
      desarrolloSituacional: 'Desarrollo',
      contextoHistoria: 'Contexto',
      tiempoEstimadoSegundos: 90
    }),
    (error) => error.errores.some((item) => item.includes('200'))
  );
});

test('publicar exige al menos una escena y una pregunta', () => {
  assert.throws(
    () => validarParaPublicar({ escenas: [], rubrica: casoPublicable().rubrica }),
    (error) => {
      const texto = error.errores.join(' ');
      return texto.includes('escena') && texto.includes('pregunta');
    }
  );
});

test('la rúbrica rechaza un criterio repetido', () => {
  const criterio = {
    nombre: 'Contexto',
    ponderacion: 50,
    puntajeMaximo: 5,
    niveles: [{ nombre: 'Inicial', descripcion: 'Describe.', puntaje: 2, orden: 1 }]
  };

  assert.throws(
    () => normalizarRubrica({
      nombre: 'Observación',
      criterios: [criterio, { ...criterio, nombre: ' contexto ' }]
    }),
    (error) => error.errores.some((item) => item.includes('repetido'))
  );
});

test('consultar casos exige un identificador entero y avisa si el caso no existe', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      return null;
    }
  }));

  await assert.rejects(
    () => servicio.listar('abc'),
    (error) => error.codigo === 'ID_INVALIDO'
  );
  await assert.rejects(
    () => servicio.obtener(4),
    (error) => error.codigo === 'CASO_NO_EXISTE' && error.statusCode === 404
  );
});

test('actualizar un borrador guarda el título recortado', async () => {
  let guardado = null;
  const servicio = crearServicioCasos(repositorio({
    async actualizarCaso(_id, datos) {
      guardado = datos;
      return 1;
    },
    async obtenerCompleto(id) {
      return { id, estado: 'Borrador', ...guardado };
    }
  }));

  const caso = await servicio.actualizar(1, datosBasicos({ titulo: '  Nuevo título  ' }));

  assert.equal(guardado.titulo, 'Nuevo título');
  assert.equal(caso.titulo, 'Nuevo título');
});

test('actualizar rechaza un caso que ya no está en borrador', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerPorId() {
      return { id: 1, estado: 'Publicado' };
    }
  }));

  await assert.rejects(
    () => servicio.actualizar(1, datosBasicos()),
    (error) => error.codigo === 'CASO_NO_EDITABLE'
  );
});

test('archivar un borrador lo deja en Archivado', async () => {
  const cambios = [];
  const servicio = crearServicioCasos(repositorio({
    async actualizarEstado(id, estado, anterior) {
      cambios.push({ id, estado, anterior });
      return 1;
    },
    async obtenerCompleto(id) {
      return { id, estado: 'Archivado' };
    }
  }));

  const caso = await servicio.archivar(1);

  assert.equal(caso.estado, 'Archivado');
  assert.deepEqual(cambios, [{ id: 1, estado: 'Archivado', anterior: 'Borrador' }]);
});

test('una escena nueva no puede traer personajes todavía', async () => {
  let inserto = false;
  const servicio = crearServicioCasos(repositorio({
    async insertarEscena() {
      inserto = true;
    }
  }));

  await assert.rejects(
    () => servicio.agregarEscena(1, {
      nombre: 'Aula',
      contexto: 'Inicio',
      orden: 1,
      esFinal: false,
      personajes: ['Ana']
    }),
    (error) => error.codigo === 'PERSONAJES_EN_ESCENA'
  );
  assert.equal(inserto, false);
});

test('la pregunta debe pertenecer a una escena del mismo caso', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerEscena() {
      return { id: 2, casoId: 9 };
    }
  }));

  await assert.rejects(
    () => servicio.agregarDecision(1, 2, { pregunta: '¿Qué hace?', orden: 1 }),
    (error) => error.codigo === 'ESCENA_NO_EXISTE'
  );
});

test('agregar un personaje guarda el nombre recortado', async () => {
  let guardado = null;
  const servicio = crearServicioCasos(repositorio({
    async insertarPersonaje(_id, personaje) {
      guardado = personaje;
    },
    async obtenerCompleto(id) {
      return { id, personajes: [guardado] };
    }
  }));

  const caso = await servicio.agregarPersonaje(1, { nombre: '  Ana  ' });

  assert.equal(guardado.nombre, 'Ana');
  assert.equal(guardado.rolSocial, null);
  assert.equal(caso.personajes[0].nombre, 'Ana');
});

test('no se publica un caso que ya no está en borrador', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      return { ...casoPublicable(), estado: 'Publicado' };
    }
  }));

  await assert.rejects(
    () => servicio.publicar(1),
    (error) => error.codigo === 'CASO_NO_PUBLICABLE'
  );
});

test('los datos del caso deben ser un objeto y el título un texto', () => {
  assert.throws(
    () => validarDatosBasicos(null),
    (error) => error.errores.some((item) => item.includes('no son válidos'))
  );
  assert.throws(
    () => validarDatosBasicos({
      titulo: 12,
      desarrolloSituacional: 'Desarrollo',
      contextoHistoria: 'Contexto',
      tiempoEstimadoSegundos: 90
    }),
    (error) => error.errores.some((item) => item.includes('texto'))
  );
});

test('el tiempo estimado no puede pasar el máximo de MySQL', () => {
  assert.throws(
    () => validarDatosBasicos({
      titulo: 'Caso',
      desarrolloSituacional: 'Desarrollo',
      contextoHistoria: 'Contexto',
      tiempoEstimadoSegundos: 2147483648
    }),
    (error) => error.statusCode === 422
  );
});

test('la pregunta recorta el texto y rechaza dos preguntas con el mismo orden', () => {
  const decision = normalizarDecision({
    pregunta: '  ¿Qué hace?  ',
    orden: 1,
    opciones: []
  });

  assert.equal(decision.pregunta, '¿Qué hace?');
  assert.equal(decision.ayuda, null);
  assert.throws(
    () => normalizarEscena({
      nombre: 'Aula',
      contexto: 'Inicio',
      orden: 1,
      esFinal: false,
      decisiones: [
        { pregunta: 'Una', orden: 1, opciones: [] },
        { pregunta: 'Otra', orden: 1, opciones: [] }
      ]
    }),
    (error) => error.errores.some((item) => item.includes('mismo orden'))
  );
});

test('la marca de escena final tiene que ser verdadero o falso', () => {
  assert.throws(
    () => normalizarEscena({
      nombre: 'Aula',
      contexto: 'Inicio',
      orden: 1,
      esFinal: 'si',
      decisiones: []
    }),
    (error) => error.errores.some((item) => item.includes('verdadero o falso'))
  );
});

test('el orden de una opción empieza en uno', () => {
  assert.throws(
    () => normalizarOpcion({
      texto: 'Escucha',
      esCorrecta: true,
      orden: 0,
      explicacion: 'Reconoce el conflicto.'
    }),
    (error) => error.errores.some((item) => item.includes('orden'))
  );
});

test('la rúbrica exige criterios y cada criterio exige un nivel', () => {
  assert.throws(
    () => normalizarRubrica({ nombre: 'Observación', criterios: [] }),
    (error) => error.errores.some((item) => item.includes('al menos un criterio'))
  );
  assert.throws(
    () => normalizarRubrica({
      nombre: 'Observación',
      criterios: [{ nombre: 'Contexto', ponderacion: 100, puntajeMaximo: 5, niveles: [] }]
    }),
    (error) => error.errores.some((item) => item.includes('al menos un nivel'))
  );
});

test('un personaje de la escena tiene que existir en el caso', () => {
  assert.throws(
    () => validarCaso(datosBasicos({
      personajes: [{ nombre: 'Ana' }],
      escenas: [{
        nombre: 'Aula',
        contexto: 'Inicio',
        orden: 1,
        esFinal: false,
        personajes: ['Luis'],
        decisiones: []
      }]
    })),
    (error) => error.errores.some((item) => item.includes('Luis'))
  );
});

test('publicar acepta la opción esperada marcada con 1', () => {
  const caso = casoPublicable();
  caso.escenas[0].decisiones[0].opciones[0].esCorrecta = 1;

  assert.doesNotThrow(() => validarParaPublicar(caso));
});

test('listar sin filtro consulta todos y con filtro usa el docente', async () => {
  const filtros = [];
  const servicio = crearServicioCasos(repositorio({
    async listar(filtro) {
      filtros.push(filtro);
      return [];
    }
  }));

  assert.deepEqual(await servicio.listar(), []);
  assert.deepEqual(await servicio.listar(''), []);
  assert.deepEqual(await servicio.listar(5), []);
  assert.deepEqual(filtros, [null, null, 5]);
});

test('archivar un caso publicado lo deja en Archivado', async () => {
  const cambios = [];
  const servicio = crearServicioCasos(repositorio({
    async obtenerPorId() {
      return { id: 1, estado: 'Publicado' };
    },
    async actualizarEstado(id, estado, anterior) {
      cambios.push({ id, estado, anterior });
      return 1;
    },
    async obtenerCompleto(id) {
      return { id, estado: 'Archivado' };
    }
  }));

  const caso = await servicio.archivar(1);

  assert.equal(caso.estado, 'Archivado');
  assert.deepEqual(cambios, [{ id: 1, estado: 'Archivado', anterior: 'Publicado' }]);
});

test('agregar una escena en borrador la guarda sin personajes', async () => {
  let guardada = null;
  const servicio = crearServicioCasos(repositorio({
    async insertarEscena(_id, escena) {
      guardada = escena;
    },
    async obtenerCompleto(id) {
      return { id, escenas: [guardada] };
    }
  }));

  const caso = await servicio.agregarEscena(1, {
    nombre: '  Aula  ',
    contexto: 'Inicio de clase',
    orden: 1,
    esFinal: false
  });

  assert.equal(guardada.nombre, 'Aula');
  assert.deepEqual(guardada.personajes, []);
  assert.equal(caso.escenas[0].nombre, 'Aula');
});

test('publicar un caso que no existe avisa que no se encontró', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      return null;
    }
  }));

  await assert.rejects(
    () => servicio.publicar(3),
    (error) => error.codigo === 'CASO_NO_EXISTE' && error.statusCode === 404
  );
});

test('construir rechaza un docente que no está activo', async () => {
  let guardo = false;
  const servicio = crearServicioCasos(repositorio({
    async guardarCasoCompleto() {
      guardo = true;
    }
  }));

  await assert.rejects(
    () => servicio.construir(datosBasicos({ creadorId: 9 })),
    (error) => error.codigo === 'CREADOR_NO_EXISTE'
  );
  assert.equal(guardo, false);
});

test('no se guarda la rúbrica de un caso publicado', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerPorId() {
      return { id: 1, estado: 'Publicado' };
    }
  }));

  await assert.rejects(
    () => servicio.guardarRubrica(1, {
      nombre: 'Rúbrica',
      criterios: [{
        nombre: 'Intervención',
        ponderacion: 100,
        puntajeMaximo: 5,
        niveles: [{ nombre: 'Inicial', descripcion: 'Describe.', puntaje: 2, orden: 1 }]
      }]
    }),
    (error) => error.codigo === 'CASO_NO_EDITABLE'
  );
});

test('asociar un personaje del mismo caso deja el vínculo', async () => {
  let vinculo = null;
  const servicio = crearServicioCasos(repositorio({
    async obtenerEscena() {
      return { id: 2, casoId: 1 };
    },
    async obtenerPersonaje() {
      return { id: 7, casoId: 1 };
    },
    async asociarPersonaje(escenaId, personajeId) {
      vinculo = { escenaId, personajeId };
    },
    async obtenerCompleto(id) {
      return { id, escenas: [{ id: 2, personajes: [7] }] };
    }
  }));

  const caso = await servicio.asociarPersonaje(1, 2, 7);

  assert.deepEqual(vinculo, { escenaId: 2, personajeId: 7 });
  assert.deepEqual(caso.escenas[0].personajes, [7]);
});

test('crear no guarda un caso sin título', async () => {
  let guardo = false;
  const servicio = crearServicioCasos(repositorio({
    async insertarCaso() {
      guardo = true;
    }
  }));

  await assert.rejects(
    () => servicio.crear(datosBasicos({ titulo: '   ' })),
    (error) => error.codigo === 'ESTRUCTURA_INVALIDA'
  );
  assert.equal(guardo, false);
});
