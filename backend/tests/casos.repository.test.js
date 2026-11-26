import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioCasos } from '../src/modules/casos/casos.repository.js';

function crearPoolFalso() {
  const llamadas = [];
  let secuencia = 1;
  const conexion = {
    async execute(sql) {
      const compacto = sql.replace(/\s+/g, ' ').trim();
      llamadas.push(compacto);
      if (compacto.startsWith('INSERT')) {
        return [{ insertId: secuencia++ }];
      }
      if (compacto.includes('FROM Caso') && compacto.includes('WHERE id')) {
        return [[{
          id: 1,
          creadorId: 5,
          titulo: 'Caso',
          desarrolloSituacional: 'Desarrollo',
          contextoHistoria: 'Contexto',
          tiempoEstimadoSegundos: 300,
          estado: 'Borrador',
          fechaCreacion: new Date(),
          fechaActualizacion: null
        }]];
      }
      if (compacto.includes('MAX(version)')) {
        return [[{ version: 0 }]];
      }
      return [[]];
    },
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {}
  };

  return {
    llamadas,
    execute: conexion.execute.bind(conexion),
    async getConnection() {
      return conexion;
    }
  };
}

const casoCompleto = {
  creadorId: 5,
  titulo: 'Conflicto',
  desarrolloSituacional: 'Desarrollo del caso',
  contextoHistoria: 'Contexto del caso',
  tiempoEstimadoSegundos: 500,
  personajes: [
    { nombre: 'Ana', rolSocial: 'Estudiante', perfil: null, pautasComportamiento: null }
  ],
  escenas: [
    {
      nombre: 'Aula',
      contexto: 'Inicio de clase',
      orden: 1,
      esFinal: false,
      personajes: ['Ana'],
      decisiones: [
        {
          pregunta: '¿Qué hace?',
          orden: 1,
          ayuda: null,
          opciones: [
            {
              texto: 'Escucha',
              esCorrecta: true,
              consecuencia: null,
              orden: 1,
              explicacion: 'Reconoce el conflicto.',
              fundamentoTeorico: null
            }
          ]
        }
      ]
    }
  ],
  rubrica: {
    nombre: 'Rúbrica',
    descripcion: null,
    criterios: [
      {
        nombre: 'Lectura',
        descripcion: null,
        ponderacion: 100,
        puntajeMaximo: 5,
        niveles: [
          { nombre: 'Inicial', descripcion: 'Describe.', puntaje: 2, orden: 1 }
        ]
      }
    ]
  }
};

test('la persistencia usa los nombres de tabla del esquema', async () => {
  const pool = crearPoolFalso();
  const repositorio = crearRepositorioCasos(pool);

  await repositorio.enTransaccion((tx) => tx.guardarCasoCompleto(casoCompleto));

  const sql = pool.llamadas.join('\n');
  for (const tabla of [
    'INSERT INTO Caso',
    'INSERT INTO Personaje',
    'INSERT INTO Escena',
    'INSERT INTO EscenaPersonaje',
    'INSERT INTO Decision',
    'INSERT INTO OpcionDecision',
    'INSERT INTO Retroalimentacion',
    'INSERT INTO Rubrica',
    'INSERT INTO CriterioEvaluacion',
    'INSERT INTO RubricaCriterio',
    'INSERT INTO NivelDesempeno'
  ]) {
    assert.ok(sql.includes(tabla), `Falta ${tabla}`);
  }
});
