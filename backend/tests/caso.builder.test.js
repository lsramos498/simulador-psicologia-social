import test from 'node:test';
import assert from 'node:assert/strict';
import { CasoBuilder } from '../src/modules/casos/caso.builder.js';

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
        { nombre: 'Avanzado', descripcion: 'Relaciona los hechos con la teoría.', puntaje: 5, orden: 2 }
      ]
    }
  ]
};

test('CasoBuilder arma el caso por pasos y build entrega la estructura', () => {
  const caso = new CasoBuilder()
    .conCreador(4)
    .conTitulo('  Conflicto en el aula  ')
    .conDesarrolloSituacional('Dos grupos discuten una norma del curso.')
    .conContextoHistoria('Primer semestre, después de un trabajo en equipo.')
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
          ayuda: null,
          opciones: [
            {
              texto: 'Pide escuchar a las dos partes.',
              esCorrecta: true,
              consecuencia: 'El grupo se detiene.',
              orden: 1,
              explicacion: 'Reconoce el conflicto antes de tomar partido.',
              fundamentoTeorico: 'Mediación'
            }
          ]
        }
      ]
    })
    .conRubrica(rubricaValida)
    .build();

  assert.equal(caso.titulo, 'Conflicto en el aula');
  assert.equal(caso.creadorId, 4);
  assert.equal(caso.escenas[0].decisiones[0].opciones[0].explicacion.includes('conflicto'), true);
  assert.equal(caso.rubrica.criterios[0].ponderacion, 100);
  assert.equal(caso.estado, undefined);
});

test('CasoBuilder rechaza un personaje que no pertenece al caso', () => {
  const builder = new CasoBuilder()
    .conCreador(1)
    .conTitulo('Caso')
    .conDesarrolloSituacional('Desarrollo')
    .conContextoHistoria('Contexto')
    .conTiempoEstimadoSegundos(300)
    .agregarEscena({
      nombre: 'Aula',
      contexto: 'Inicio',
      orden: 1,
      esFinal: false,
      personajes: ['Luis'],
      decisiones: []
    });

  assert.throws(() => builder.build(), (error) => {
    assert.equal(error.statusCode, 422);
    assert.match(error.errores.join(' '), /Luis/);
    return true;
  });
});
