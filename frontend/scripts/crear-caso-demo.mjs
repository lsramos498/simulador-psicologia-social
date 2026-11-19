/**
 * Crea y publica el caso demo completo (3 lugares + diálogos).
 * Uso: node scripts/crear-caso-demo.mjs
 */
const API = process.env.LUMINA_API || 'http://127.0.0.1:3000';

async function pedir(ruta, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await res.text();
  const data = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.detalle = data;
    throw err;
  }
  return data;
}

const payload = {
  titulo: 'Conflicto de convivencia en el barrio El Roble',
  desarrolloSituacional:
    'En el barrio El Roble aumentó la tensión entre dos familias por ruidos, acusaciones de falta de respeto y una denuncia en la comisaría. Vecinos, el colegio y una ONG ya se enteraron. El estudiante llega a la escena para visitar lugares, preguntar a las personas involucradas y decidir cómo intervenir sin polarizar más el conflicto.',
  contextoHistoria:
    'Práctica de psicología social con enfoque comunitario. El estudiante debe contrastar versiones en la comisaría, el hogar/barrio y la ONG, identificar redes de apoyo y proponer una mediación ética.',
  tiempoEstimadoSegundos: 900,
  personajes: [
    {
      nombre: 'Andrés',
      rolSocial: 'Agente de policía',
      perfil: 'Atiende en la comisaría y registra denuncias.'
    },
    {
      nombre: 'Lucía',
      rolSocial: 'Vecina',
      perfil: 'Conoce el barrio y suele enterarse de lo que pasa.'
    },
    {
      nombre: 'Sofía',
      rolSocial: 'Madre de familia',
      perfil: 'Busca apoyo y se preocupa por su hijo.'
    },
    {
      nombre: 'Diego',
      rolSocial: 'Adolescente',
      perfil: 'Escucha el conflicto desde casa.'
    },
    {
      nombre: 'Elena',
      rolSocial: 'Gestora social',
      perfil: 'Trabaja en la ONG y articula redes de apoyo.'
    },
    {
      nombre: 'Marta',
      rolSocial: 'Enfermera',
      perfil: 'Ha visto el impacto del estrés en la familia.'
    }
  ],
  escenas: [
    {
      nombre: 'Recepción de la comisaría',
      contexto: 'El estudiante llega a la comisaría para indagar sobre la denuncia.',
      orden: 1,
      esFinal: false,
      personajes: ['Andrés', 'Sofía', 'Lucía'],
      decisiones: [
        {
          pregunta: 'Al llegar a la comisaría, ¿qué conviene hacer primero?',
          orden: 1,
          opciones: [
            {
              texto:
                'Escuchar al agente y a las partes, pedir hechos concretos y evitar tomar partido antes de contrastar versiones.',
              esCorrecta: true,
              orden: 1,
              explicacion:
                'Favorece la contención, la escucha y evita polarizar el conflicto.'
            },
            {
              texto:
                'Decidir quién tiene la razón con lo primero que diga un vecino y confrontar de inmediato a la otra familia.',
              esCorrecta: false,
              orden: 2,
              explicacion: 'Toma partido sin evidencia y puede agravar la tensión.'
            }
          ]
        }
      ]
    },
    {
      nombre: 'Calle del barrio',
      contexto: 'El estudiante va al barrio para contrastar lo que se vive en la cotidianidad.',
      orden: 2,
      esFinal: false,
      personajes: ['Lucía', 'Diego', 'Sofía', 'Elena'],
      decisiones: [
        {
          pregunta: 'En el barrio, ¿cómo indagar sin alimentar los bandos?',
          orden: 1,
          opciones: [
            {
              texto:
                'Preguntar a varias personas, escuchar sin juzgar y registrar coincidencias y diferencias.',
              esCorrecta: true,
              orden: 1,
              explicacion: 'Permite mapear el conflicto y las redes sociales del barrio.'
            },
            {
              texto:
                'Reunir a la gente en la esquina para que discutan delante de todos quién tiene la culpa.',
              esCorrecta: false,
              orden: 2,
              explicacion: 'Publicar el conflicto suele escalarlo y humillar a alguien.'
            }
          ]
        }
      ]
    },
    {
      nombre: 'Sede de la ONG',
      contexto: 'Espacio neutral para pensar una mediación y redes de apoyo.',
      orden: 3,
      esFinal: true,
      personajes: ['Elena', 'Marta', 'Andrés', 'Sofía'],
      decisiones: [
        {
          pregunta: 'Para cerrar la práctica, ¿qué intervención conviene proponer?',
          orden: 1,
          opciones: [
            {
              texto:
                'Una mediación en espacio neutral con turnos de habla, reglas claras y apoyo de comisaría/ONG.',
              esCorrecta: true,
              orden: 1,
              explicacion: 'Integra instituciones y cuida la dignidad de todas las partes.'
            },
            {
              texto:
                'Decirles que resuelvan solos porque “así son los vecinos” y archivar el caso.',
              esCorrecta: false,
              orden: 2,
              explicacion: 'Abandona a las personas y no practica intervención comunitaria.'
            }
          ]
        }
      ]
    }
  ],
  rubrica: {
    nombre: 'Evaluación · Barrio El Roble',
    criterios: [
      {
        nombre: 'Escucha y contraste de versiones',
        ponderacion: 50,
        puntajeMaximo: 4,
        niveles: [
          { nombre: 'Básico', descripcion: 'Escucha una sola versión.', puntaje: 1, orden: 1 },
          {
            nombre: 'Avanzado',
            descripcion: 'Contrasta varias voces antes de decidir.',
            puntaje: 4,
            orden: 2
          }
        ]
      },
      {
        nombre: 'Intervención ética',
        ponderacion: 50,
        puntajeMaximo: 4,
        niveles: [
          { nombre: 'Básico', descripcion: 'Propone algo genérico.', puntaje: 1, orden: 1 },
          {
            nombre: 'Avanzado',
            descripcion: 'Propone mediación respetuosa y redes de apoyo.',
            puntaje: 4,
            orden: 2
          }
        ]
      }
    ]
  }
};

const portadas = {
  1: {
    id: 'esc-comisaria',
    titulo: 'Recepción de la comisaría',
    imagen: '/escenarios/game-esc-comisaria.jpg',
    categoriaNombre: 'Comisaría'
  },
  2: {
    id: 'esc-barrio',
    titulo: 'Calle del barrio',
    imagen: '/escenarios/game-esc-barrio.jpg',
    categoriaNombre: 'Barrio'
  },
  3: {
    id: 'esc-ong',
    titulo: 'Sede de la ONG',
    imagen: '/escenarios/game-esc-ong.jpg',
    categoriaNombre: 'ONG y comunidad'
  }
};

const login = await pedir('/api/acceso/ingreso', {
  method: 'POST',
  body: {
    correo: process.env.ADMIN_CORREO || 'admin@unihumboldt.edu.co',
    contrasena: process.env.ADMIN_CONTRASENA || 'replace_with_strong_password'
  }
});

const token = login.token;
const creado = await pedir('/api/casos/construir', {
  method: 'POST',
  token,
  body: payload
});

const caso = creado.data;
const publicado = await pedir(`/api/casos/${caso.id}/publicar`, {
  method: 'POST',
  token
});

console.log(
  JSON.stringify(
    {
      id: publicado.data.id,
      titulo: publicado.data.titulo,
      estado: publicado.data.estado,
      escenas: publicado.data.escenas?.map((e) => ({
        id: e.id,
        orden: e.orden,
        nombre: e.nombre,
        personajes: (e.personajes || []).map((p) => p.nombre)
      })),
      portadas
    },
    null,
    2
  )
);
