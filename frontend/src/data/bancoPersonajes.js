import { leerPersonajesCustom } from '../utils/personajesLocal';

/** Personas ilustradas a quienes el estudiante puede preguntar. */
export const BANCO_PERSONAJES = [
  {
    id: 'valeria-investigadora',
    nombre: 'Valeria',
    rolSocial: 'Investigadora',
    perfil: 'Llega a la escena, observa y hace preguntas clave.',
    pautasComportamiento: 'Escucha con calma y pide detalles concretos.',
    acento: '#3d7ea6',
    imagen: '/personajes/game-pj-01.jpg'
  },
  {
    id: 'andres-agente',
    nombre: 'Andrés',
    rolSocial: 'Agente de policía',
    perfil: 'Atiende en la comisaría y registra denuncias.',
    pautasComportamiento: 'Prioriza el procedimiento y pide datos claros.',
    acento: '#2f5d8c',
    imagen: '/personajes/game-pj-02.jpg'
  },
  {
    id: 'marta-enfermera',
    nombre: 'Marta',
    rolSocial: 'Enfermera',
    perfil: 'Trabaja en el hospital y acompaña a las familias.',
    pautasComportamiento: 'Habla con cuidado y protege la privacidad.',
    acento: '#3f8f7a',
    imagen: '/personajes/game-pj-03.jpg'
  },
  {
    id: 'lucia-vecina',
    nombre: 'Lucía',
    rolSocial: 'Vecina',
    perfil: 'Conoce el barrio y suele enterarse de lo que pasa.',
    pautasComportamiento: 'Habla con cercanía; a veces mezcla hechos y rumores.',
    acento: '#c47a5a',
    imagen: '/personajes/game-pj-04.jpg'
  },
  {
    id: 'diego-adolescente',
    nombre: 'Diego',
    rolSocial: 'Adolescente',
    perfil: 'Está en el centro del conflicto y necesita confianza.',
    pautasComportamiento: 'Responde poco al inicio; se abre si lo respetan.',
    acento: '#6b7bb5',
    imagen: '/personajes/game-pj-05.jpg'
  },
  {
    id: 'elena-gestora',
    nombre: 'Elena',
    rolSocial: 'Gestora social',
    perfil: 'Trabaja en la ONG y articula redes de apoyo.',
    pautasComportamiento: 'Orienta, remite y pregunta por el contexto.',
    acento: '#5a8f4d',
    imagen: '/personajes/game-pj-06.jpg'
  },
  {
    id: 'pedro-comerciante',
    nombre: 'Pedro',
    rolSocial: 'Comerciante',
    perfil: 'Tiene el local de la esquina y observa el barrio.',
    pautasComportamiento: 'Cuenta lo que ve; evita involucrarse demasiado.',
    acento: '#b8893d',
    imagen: '/personajes/game-pj-07.jpg'
  },
  {
    id: 'sofia-madre',
    nombre: 'Sofía',
    rolSocial: 'Madre de familia',
    perfil: 'Busca apoyo y se preocupa por su hijo.',
    pautasComportamiento: 'Se abre si siente respeto; se cierra si la juzgan.',
    acento: '#7a6aad',
    imagen: '/personajes/game-pj-08.jpg'
  },
  {
    id: 'camila-docente',
    nombre: 'Camila',
    rolSocial: 'Docente',
    perfil: 'Trabaja en el colegio y conoce a estudiantes y familias.',
    pautasComportamiento: 'Pregunta antes de sacar conclusiones.',
    acento: '#4a8f9a',
    imagen: '/personajes/game-pj-09.jpg'
  },
  {
    id: 'nina-estudiante',
    nombre: 'Nina',
    rolSocial: 'Estudiante',
    perfil: 'Compañera cercana a la situación del caso.',
    pautasComportamiento: 'Comparte su versión con cautela.',
    acento: '#9a6aad',
    imagen: '/personajes/game-pj-10.jpg'
  }
];

export function bancoCompleto() {
  return [...BANCO_PERSONAJES, ...leerPersonajesCustom()];
}

export function aPersonajeApi(personaje) {
  return {
    nombre: personaje.nombre,
    rolSocial: personaje.rolSocial,
    perfil: personaje.perfil ?? null,
    pautasComportamiento: personaje.pautasComportamiento ?? null
  };
}

export function imagenDePersonaje(nombre) {
  if (!nombre) return null;
  const clave = String(nombre).toLocaleLowerCase('es');
  const hallado = bancoCompleto().find((p) => p.nombre.toLocaleLowerCase('es') === clave);
  return hallado?.imagen || null;
}
