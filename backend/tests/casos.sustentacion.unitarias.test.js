/**
 * Pruebas unitarias del módulo de casos — Stefanía Díaz
 * Para demostrar en sustentación:
 *   cd backend
 *   node --test tests/casos.sustentacion.unitarias.test.js
 *
 * Requisitos: RF-05 a RF-09 y parte de RF-17
 * Patrón: Builder
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasoBuilder, construirCaso } from '../src/modules/casos/caso.builder.js';
import {
  validarDatosBasicos,
  validarParaPublicar,
  normalizarRubrica
} from '../src/modules/casos/caso.validacion.js';
import { crearServicioCasos } from '../src/modules/casos/casos.service.js';

const docente = { id: 5, roles: ['Docente'], permisos: ['CREAR_CASOS'] };

const rubricaValida = {
  nombre: 'Participación en el conflicto',
  descripcion: 'Observa la lectura del contexto.',
  criterios: [
    {
      nombre: 'Lectura del contexto',
      descripcion: 'Identifica actores y tensiones.',
      ponderacion: 100,
      puntajeMaximo: 5,
      niveles: [
        { nombre: 'Inicial', descripcion: 'Describe los hechos.', puntaje: 2, orden: 1 },
        { nombre: 'Avanzado', descripcion: 'Relaciona hechos con teoría.', puntaje: 5, orden: 2 }
      ]
    }
  ]
};

function casoPublicable() {
  return {
    id: 1,
    creadorId: 5,
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
    rubrica: rubricaValida
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
      return { id: 1, creadorId: 5, estado: 'Borrador' };
    },
    ...extra
  };
  return repo;
}

// ---------- Builder (patrón de diseño) ----------

test('Builder: construye un caso válido por pasos', () => {
  const caso = new CasoBuilder()
    .conCreador(5)
    .conTitulo('  Conflicto en el aula  ')
    .conDesarrolloSituacional('Dos grupos discuten una norma.')
    .conContextoHistoria('Primer semestre.')
    .conTiempoEstimadoSegundos(900)
    .agregarPersonaje({ nombre: 'Ana', rolSocial: 'Estudiante' })
    .agregarEscena({
      nombre: 'El pasillo',
      contexto: 'Ana espera a su grupo.',
      orden: 1,
      esFinal: false,
      personajes: ['Ana'],
      decisiones: [
        {
          pregunta: '¿Qué hace Ana?',
          orden: 1,
          opciones: [
            {
              texto: 'Pide escuchar a las dos partes.',
              esCorrecta: true,
              orden: 1,
              explicacion: 'Reconoce el conflicto antes de tomar partido.'
            },
            {
              texto: 'Ignora la discusión.',
              esCorrecta: false,
              orden: 2,
              explicacion: 'No interviene.'
            }
          ]
        }
      ]
    })
    .conRubrica(rubricaValida)
    .build();

  assert.equal(caso.titulo, 'Conflicto en el aula');
  assert.equal(caso.creadorId, 5);
  assert.equal(caso.escenas.length, 1);
  assert.equal(caso.rubrica.criterios[0].ponderacion, 100);
});

test('Builder: rechaza un caso sin desarrollo situacional', () => {
  assert.throws(
    () => construirCaso({
      creadorId: 5,
      titulo: 'Caso',
      desarrolloSituacional: '',
      contextoHistoria: 'Contexto',
      tiempoEstimadoSegundos: 300
    }),
    (error) => error.codigo === 'ESTRUCTURA_INVALIDA'
  );
});

// ---------- Validación y rúbrica ----------

test('Validación: los datos básicos exigen título y tiempo válido', () => {
  const datos = validarDatosBasicos({
    titulo: '  Caso de aula  ',
    desarrolloSituacional: 'Hay una discusión.',
    contextoHistoria: 'Curso.',
    tiempoEstimadoSegundos: 480
  });

  assert.equal(datos.titulo, 'Caso de aula');
  assert.throws(
    () => validarDatosBasicos({
      titulo: '   ',
      desarrolloSituacional: 'Desarrollo',
      contextoHistoria: 'Contexto',
      tiempoEstimadoSegundos: 100
    }),
    (error) => Array.isArray(error.errores)
  );
});

test('Rúbrica: las ponderaciones deben sumar 100', () => {
  assert.throws(
    () => normalizarRubrica({
      nombre: 'Observación',
      criterios: [
        {
          nombre: 'A',
          ponderacion: 40,
          puntajeMaximo: 5,
          niveles: [{ nombre: 'Básico', descripcion: 'Describe', puntaje: 1, orden: 1 }]
        },
        {
          nombre: 'B',
          ponderacion: 40,
          puntajeMaximo: 5,
          niveles: [{ nombre: 'Básico', descripcion: 'Describe', puntaje: 1, orden: 1 }]
        }
      ]
    }),
    (error) => error.errores.some((item) => item.includes('100'))
  );
});

// ---------- Publicación ----------

test('Publicación: un caso completo cumple las reglas', () => {
  assert.doesNotThrow(() => validarParaPublicar(casoPublicable()));
});

test('Publicación: rechaza un caso sin rúbrica ni dos opciones', () => {
  assert.throws(
    () => validarParaPublicar({
      escenas: [{
        decisiones: [{
          pregunta: '¿Qué hace?',
          opciones: [{ texto: 'Solo una', esCorrecta: true, explicacion: 'Insuficiente' }]
        }]
      }],
      rubrica: null
    }),
    (error) => error.codigo === 'ESTRUCTURA_INVALIDA'
  );
});

test('Servicio: no publica un borrador incompleto', async () => {
  let actualizo = false;
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      return { id: 1, creadorId: 5, estado: 'Borrador', escenas: [], rubrica: null };
    },
    async actualizarEstado() {
      actualizo = true;
      return 1;
    }
  }));

  await assert.rejects(
    () => servicio.publicar(1, docente),
    (error) => error.statusCode === 422
  );
  assert.equal(actualizo, false);
});

test('Servicio: publica un borrador completo', async () => {
  let lecturas = 0;
  const completo = casoPublicable();
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      lecturas += 1;
      return lecturas === 1 ? completo : { ...completo, estado: 'Publicado' };
    },
    async actualizarEstado() {
      return 1;
    }
  }));

  const publicado = await servicio.publicar(1, docente);
  assert.equal(publicado.estado, 'Publicado');
});

// ---------- Permisos ----------

test('Permisos: un docente no puede publicar el caso de otra compañera', async () => {
  const servicio = crearServicioCasos(repositorio({
    async obtenerCompleto() {
      return { ...casoPublicable(), creadorId: 9 };
    },
    async actualizarEstado() {
      throw new Error('no debería publicar');
    }
  }));

  await assert.rejects(
    () => servicio.publicar(1, docente),
    (error) => error.codigo === 'CASO_AJENO' && error.statusCode === 403
  );
});
