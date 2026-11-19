import test from 'node:test';
import assert from 'node:assert/strict';
import { validarParaPublicar } from '../src/modules/casos/caso.validacion.js';

function casoPublicable() {
  return {
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

test('un caso completo cumple las reglas de publicación', () => {
  assert.doesNotThrow(() => validarParaPublicar(casoPublicable()));
});

test('no se publica un caso sin rúbrica ni dos opciones', () => {
  const caso = casoPublicable();
  caso.rubrica = null;
  caso.escenas[0].decisiones[0].opciones = [
    { texto: 'Solo una', esCorrecta: true, explicacion: 'Texto' }
  ];

  assert.throws(() => validarParaPublicar(caso), (error) => {
    assert.equal(error.statusCode, 422);
    const texto = error.errores.join(' ');
    assert.match(texto, /rúbrica/);
    assert.match(texto, /dos opciones/);
    return true;
  });
});

test('las ponderaciones de la rúbrica deben sumar 100', () => {
  const caso = casoPublicable();
  caso.rubrica.criterios[0].ponderacion = 40;

  assert.throws(() => validarParaPublicar(caso), (error) => {
    assert.match(error.errores.join(' '), /100/);
    return true;
  });
});
