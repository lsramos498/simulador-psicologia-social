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
  },
  {
    id: 'bruno-mediador',
    nombre: 'Bruno',
    rolSocial: 'Mediador comunitario',
    perfil: 'Facilita diálogos entre vecinos y liderazgos locales.',
    pautasComportamiento: 'Busca acuerdos y nombra reglas claras.',
    acento: '#8a5a3c',
    imagen: '/personajes/bruno.jpg'
  },
  {
    id: 'ana-psicologa',
    nombre: 'Ana',
    rolSocial: 'Psicóloga',
    perfil: 'Acompaña procesos emocionales y escucha activa.',
    pautasComportamiento: 'Valida emociones y evita consejos apresurados.',
    acento: '#5c7aa8',
    imagen: '/personajes/ana.jpg'
  },
  {
    id: 'gina-lideresa',
    nombre: 'Gina',
    rolSocial: 'Lideresa barrial',
    perfil: 'Organiza jornadas y conoce las redes del territorio.',
    pautasComportamiento: 'Habla con firmeza y pide hechos verificables.',
    acento: '#a65d7a',
    imagen: '/personajes/gina.jpg'
  },
  {
    id: 'felix-abuelo',
    nombre: 'Félix',
    rolSocial: 'Adulto mayor',
    perfil: 'Reside hace años en el sector y recuerda conflictos previos.',
    pautasComportamiento: 'Cuenta historias; a veces idealiza el pasado.',
    acento: '#6d7a55',
    imagen: '/personajes/felix.jpg'
  },
  {
    id: 'hugo-padre',
    nombre: 'Hugo',
    rolSocial: 'Padre de familia',
    perfil: 'Quiere proteger a su hijo y entiende poco el conflicto escolar.',
    pautasComportamiento: 'Se altera si lo culpan; colabora si lo incluyen.',
    acento: '#3f6f8f',
    imagen: '/personajes/hugo.jpg'
  },
  {
    id: 'camila-real',
    nombre: 'Carla',
    rolSocial: 'Trabajadora social',
    perfil: 'Visita hogares y articula ayudas institucionales.',
    pautasComportamiento: 'Prioriza seguridad y redes de apoyo.',
    acento: '#4f8f78',
    imagen: '/personajes/camila.jpg'
  },
  {
    id: 'diego-real',
    nombre: 'David',
    rolSocial: 'Joven del barrio',
    perfil: 'Conoce grupos de pares y dinámicas de presión social.',
    pautasComportamiento: 'Desconfía de autoridad; responde a respeto.',
    acento: '#5a6fb0',
    imagen: '/personajes/diego.jpg'
  },
  {
    id: 'elena-real',
    nombre: 'Elisa',
    rolSocial: 'Orientadora escolar',
    perfil: 'Interviene en convivencia y mediación en el colegio.',
    pautasComportamiento: 'Documenta y propone rutas de atención.',
    acento: '#7a8f4d',
    imagen: '/personajes/elena.jpg'
  },
  {
    id: 'real-pj-01',
    nombre: 'Isabel',
    rolSocial: 'Abogada de familia',
    perfil: 'Explica derechos y rutas legales sin alarmar.',
    pautasComportamiento: 'Usa lenguaje claro y verifica consentimiento.',
    acento: '#4a6d8c',
    imagen: '/personajes/real-pj-01.jpg'
  },
  {
    id: 'real-pj-02',
    nombre: 'Julián',
    rolSocial: 'Psicólogo clínico',
    perfil: 'Evalúa riesgo y propone acompañamiento.',
    pautasComportamiento: 'Escucha sin interrumpir y formula hipótesis.',
    acento: '#3d7a6a',
    imagen: '/personajes/real-pj-02.jpg'
  },
  {
    id: 'real-pj-03',
    nombre: 'Patricia',
    rolSocial: 'Directora de colegio',
    perfil: 'Toma decisiones institucionales sobre convivencia.',
    pautasComportamiento: 'Equilibra disciplina y cuidado pedagógico.',
    acento: '#8c5a6a',
    imagen: '/personajes/real-pj-03.jpg'
  },
  {
    id: 'real-pj-04',
    nombre: 'Tomás',
    rolSocial: 'Estudiante de grado 10',
    perfil: 'Testigo de una pelea y teme represalias.',
    pautasComportamiento: 'Habla mejor en privado y con adultos de confianza.',
    acento: '#6a7aad',
    imagen: '/personajes/real-pj-04.jpg'
  },
  {
    id: 'real-pj-05',
    nombre: 'Rocío',
    rolSocial: 'Madre comunitaria',
    perfil: 'Cuida niños del sector y detecta cambios de ánimo.',
    pautasComportamiento: 'Protege a los menores y pide apoyo concreto.',
    acento: '#a67a4a',
    imagen: '/personajes/real-pj-05.jpg'
  },
  {
    id: 'real-pj-06',
    nombre: 'Santiago',
    rolSocial: 'Enfermero',
    perfil: 'Atiende urgencias y orienta a familias en crisis.',
    pautasComportamiento: 'Prioriza estabilización y remisión oportuna.',
    acento: '#3f8f8a',
    imagen: '/personajes/real-pj-06.jpg'
  },
  {
    id: 'real-pj-07',
    nombre: 'Laura',
    rolSocial: 'Periodista local',
    perfil: 'Investiga hechos del barrio con enfoque ético.',
    pautasComportamiento: 'Verifica fuentes y evita estigmatizar.',
    acento: '#7a5aad',
    imagen: '/personajes/real-pj-07.jpg'
  },
  {
    id: 'real-pj-08',
    nombre: 'Miguel',
    rolSocial: 'Pastor comunitario',
    perfil: 'Acompaña familias y ofrece espacios de escucha.',
    pautasComportamiento: 'No impone; facilita diálogo y contención.',
    acento: '#6a7a4a',
    imagen: '/personajes/real-pj-08.jpg'
  },
  {
    id: 'pj-01-auxiliar',
    nombre: 'Natalia',
    rolSocial: 'Auxiliar administrativa',
    perfil: 'Recibe denuncias y organiza citas en la institución.',
    pautasComportamiento: 'Sigue protocolo y deriva a quien corresponde.',
    acento: '#5a8aad',
    imagen: '/personajes/pj-01.jpg'
  },
  {
    id: 'pj-02-vigilante',
    nombre: 'Óscar',
    rolSocial: 'Vigilante',
    perfil: 'Controla el acceso y observa lo que ocurre en portería.',
    pautasComportamiento: 'Reporta hechos; evita opinar sin evidencia.',
    acento: '#4a5a6a',
    imagen: '/personajes/pj-02.jpg'
  },
  {
    id: 'pj-03-companera',
    nombre: 'Paula',
    rolSocial: 'Compañera de clase',
    perfil: 'Estuvo presente cuando empezó el conflicto.',
    pautasComportamiento: 'Puede minimizar o exagerar según la presión del grupo.',
    acento: '#9a6a8a',
    imagen: '/personajes/pj-03.jpg'
  },
  {
    id: 'pj-04-coordinador',
    nombre: 'Ricardo',
    rolSocial: 'Coordinador de convivencia',
    perfil: 'Lidera mediaciones y aplica el manual de convivencia.',
    pautasComportamiento: 'Busca reparar el daño y prevenir repetición.',
    acento: '#3d6f7a',
    imagen: '/personajes/pj-04.jpg'
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
