/**
 * Crea caso, programa actividad, convoca a sdiaz_549@unihumboldt.edu.co e inicia.
 */
import 'dotenv/config';

const API = process.env.API_BASE || 'http://127.0.0.1:3000';
const CORREO_EST = 'sdiaz_549@unihumboldt.edu.co';
const DOCENTE = {
  correo: process.env.DOCENTE_CORREO || 'docente.casos@unihumboldt.edu.co',
  contrasena: process.env.DOCENTE_CONTRASENA || 'Docente1234'
};
const ADMIN = {
  correo: process.env.ADMIN_CORREO || 'admin@unihumboldt.edu.co',
  contrasena: process.env.ADMIN_CONTRASENA || 'replace_with_strong_password'
};

async function pedir(ruta, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const texto = await res.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = { raw: texto };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${ruta} → ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function login(creds) {
  return pedir('/api/acceso/ingreso', { method: 'POST', body: creds });
}

let token;
let quien;
try {
  const doc = await login(DOCENTE);
  token = doc.token;
  quien = doc.usuario;
  console.log('Login docente OK:', quien?.correoInstitucional || DOCENTE.correo, quien?.roles);
} catch (e) {
  console.log('Docente falló, pruebo admin…', e.message);
  const adm = await login(ADMIN);
  token = adm.token;
  quien = adm.usuario;
  console.log('Login admin OK:', ADMIN.correo, quien?.roles);
}

// 1) Estudiante destino
const lista = await pedir('/api/acceso/estudiantes', { token });
let estudiante = (lista.data || []).find(
  (e) => String(e.correo || e.correoInstitucional || '').toLowerCase() === CORREO_EST
);
if (!estudiante) {
  console.log('Creando estudiante', CORREO_EST);
  const creado = await pedir('/api/acceso/estudiantes', {
    method: 'POST',
    token,
    body: {
      nombres: 'Stefania',
      apellidos: 'Diaz',
      correo: CORREO_EST
    }
  });
  estudiante = creado.data;
}
console.log('Estudiante id', estudiante.id, estudiante.correo || CORREO_EST);

// 2) Caso completo + publicar
const stamp = Date.now();
const construido = await pedir('/api/casos/construir', {
  method: 'POST',
  token,
  body: {
    titulo: `Conflicto en sala de espera · práctica ${stamp.toString().slice(-4)}`,
    desarrolloSituacional:
      'En un hospital de primer nivel, la sala de espera se tensiona por rumores cruzados sobre un adolescente hospitalizado. Dos acompañantes confrontan versiones distintas frente a otras familias, con poca información clara del personal de salud y alto riesgo de escalada emocional y de exposición de datos sensibles.',
    contextoHistoria:
      'Práctica de psicología social. Tu rol es contener, cuidar la privacidad, contrastar pistas sin tomar partido público y proponer una ruta ética de remisión y seguimiento con el equipo de salud.',
    tiempoEstimadoSegundos: 900,
    personajes: [
      {
        nombre: 'Camila',
        rolSocial: 'Acompañante',
        perfil:
          'Lleva horas esperando noticias de su sobrino. Está agotada, habla fuerte y cree que el silencio del personal es abandono. Repite detalles personales delante de desconocidos porque siente que nadie la escucha.',
        pautasComportamiento:
          'Pide respuestas inmediatas, interrumpe y eleva la voz cuando percibe indiferencia. Si la contienes con calma, baja el tono y acepta turnos de habla.'
      },
      {
        nombre: 'Mateo',
        rolSocial: 'Acompañante',
        perfil:
          'Se siente señalado por rumores del pasillo. Minimiza el conflicto, niega haber hablado mal de la familia de Camila y teme que cualquier aclaración pública lo deje peor parado frente a otras personas.',
        pautasComportamiento:
          'Se defiende con ironía y frases cortas. Si lo escuchas en privado, aporta hechos útiles; si lo confrontas en público, se cierra.'
      }
    ],
    escenas: [
      {
        nombre: 'Sala de espera',
        orden: 1,
        contexto:
          'Son las 10:40 en la sala de espera de un hospital de primer nivel. Hay sillas llenas, niños inquietos y una ventanilla que abre solo de forma intermitente. Cerca de la puerta, Camila alza la voz porque lleva horas sin una explicación clara sobre su sobrino adolescente, internado tras un episodio de crisis. Mateo, sentado dos filas más adelante, responde con frases cortas y niega haber alimentado rumores. Otras familias escuchan fragmentos (“dicen que…”, “en el pasillo contaron…”), así que cualquier intervención pública puede exponer datos clínicos o familiares. El personal de salud está ocupado y te pide, como estudiante en práctica, que contengas la situación sin diagnosticar, sin tomar partido y sin prometer lo que no puedes cumplir. Tu primera tarea es bajar la tensión, abrir un canal de escucha respetuoso y proteger la privacidad mientras contrastas las pistas de cada persona.',
        esFinal: false,
        personajes: ['Camila', 'Mateo'],
        decisiones: [
          {
            pregunta:
              'Con este contexto y las pistas de Camila y Mateo, ¿cuál es tu primera intervención como estudiante en práctica?',
            orden: 1,
            opciones: [
              {
                texto:
                  'Propongo hablar con Camila y Mateo por separado, en un espacio más discreto, para bajar la tensión, validar lo emocional y ordenar hechos sin exponer datos frente a otras familias.',
                esCorrecta: true,
                orden: 1,
                explicacion:
                  'La escucha privada y calmada contiene, protege privacidad y abre contraste de versiones.'
              },
              {
                texto:
                  'Les pido en voz alta, delante de toda la sala, que “se calmen ya” y cuenten todo frente a los demás para “aclarar el chisme” de una vez, aunque eso exponga información sensible.',
                esCorrecta: false,
                orden: 2,
                explicacion:
                  'La confrontación pública puede escalar el daño y vulnerar la privacidad.'
              }
            ]
          }
        ]
      },
      {
        nombre: 'Pasillo de orientación',
        orden: 2,
        contexto:
          'Después de escuchar versiones parciales en la sala, te mueves con Camila y Mateo hacia un pasillo más tranquilo, cerca de orientación. Ya no hay tanto público, pero ambos siguen activados: Camila quiere una respuesta inmediata del sistema de salud y Mateo teme quedar como “el malo” del relato. Una auxiliar te indica que el médico dará información solo a quien corresponda y te recuerda no diagnosticar ni adelantar resultados clínicos. En este punto la escena ya no se trata solo de calmar voces: necesitas cerrar con una ruta ética. Eso implica cuidar la privacidad, explicar con claridad los límites de tu rol, coordinar remisión con el personal de salud y acordar un siguiente paso realista (turnos de habla, seguimiento, a quién preguntar y qué no se discute en pasillos). La pregunta de esta escena evalúa si puedes integrar las pistas en una salida profesional, sin promesas vacías y sin forzar una conclusión unilateral.',
        esFinal: true,
        personajes: ['Camila', 'Mateo'],
        decisiones: [
          {
            pregunta:
              'Según el contexto y lo que armaste de la historia, ¿cómo cierras la intervención en esta escena?',
            orden: 1,
            opciones: [
              {
                texto:
                  'Acuerdo turnos de habla, protejo la privacidad, explico los límites de mi rol y coordino con el personal de salud un seguimiento concreto para que ambos sepan qué sigue y a quién recurrir.',
                esCorrecta: true,
                orden: 1,
                explicacion: 'Cierra con ruta ética, clara y viable.'
              },
              {
                texto:
                  'Impongo una conclusión rápida (“aquí el culpable es uno”), sin validar lo emocional, sin coordinar remisión y prometiendo que “ya está resuelto” aunque el equipo de salud todavía no haya informado.',
                esCorrecta: false,
                orden: 2,
                explicacion: 'Cierra mal, pierde confianza y puede generar daño.'
              }
            ]
          }
        ]
      }
    ],
    rubrica: {
      nombre: 'Intervención ética en sala de espera',
      descripcion: 'Evalúa contención y criterio profesional.',
      criterios: [
        {
          nombre: 'Intervención ética',
          ponderacion: 100,
          puntajeMaximo: 4,
          niveles: [
            { nombre: 'Básico', descripcion: 'Identifica el conflicto.', puntaje: 1, orden: 1 },
            { nombre: 'Avanzado', descripcion: 'Media y propone ruta clara.', puntaje: 4, orden: 2 }
          ]
        }
      ]
    }
  }
});
let caso = construido.data;
console.log('Caso creado', caso.id, caso.titulo);

const pub = await pedir(`/api/casos/${caso.id}/publicar`, { method: 'POST', token });
caso = pub.data || { ...caso, estado: 'Publicado' };
const rubricaId = caso.rubricaId || caso.rubrica?.id;
if (!rubricaId) throw new Error('Caso sin rúbrica tras publicar');
console.log('Caso publicado', caso.id, 'rúbrica', rubricaId);

// 3) Espacio
let espacios = await pedir('/api/espacios', { token });
let espacio = (espacios.data || [])[0];
if (!espacio) {
  const creEsp = await pedir('/api/espacios', {
    method: 'POST',
    token,
    body: { nombre: 'Práctica psicología social', codigo: `PSS-${stamp.toString().slice(-5)}` }
  });
  espacio = creEsp.data;
}
console.log('Espacio', espacio.id, espacio.nombre);

// 4) Actividad + correo
const inicio = new Date(Date.now() - 2 * 60_000);
const fin = new Date(Date.now() + 6 * 60 * 60_000);
const act = await pedir('/api/actividades', {
  method: 'POST',
  token,
  body: {
    casoId: caso.id,
    espacioAcademicoId: espacio.id,
    rubricaId,
    fechaInicio: fmt(inicio),
    fechaFin: fmt(fin),
    tiempoLimiteSegundos: 900,
    intentosPermitidos: 2,
    lugar: 'Sala de práctica Lumina',
    mensajePersonalizado:
      'Fuiste convocada a la práctica de sala de espera. Entra a Lumina con tu correo institucional y el código de esta convocatoria.',
    estudiantesIds: [estudiante.id]
  }
});
const actividad = act.data;
const codigo = actividad.codigosDeAcceso?.[0]?.codigo;
const notif = (actividad.notificaciones || [])[0];
console.log('Actividad', actividad.id);
console.log('Código de acceso', codigo);
console.log('Notificación', notif?.canal, notif?.estado, notif?.previewUrl || '');

// 5) Iniciar como docente
const ini = await pedir(`/api/actividades/${actividad.id}/iniciar`, { method: 'POST', token });
console.log('Actividad iniciada:', ini.data?.estado || 'Iniciada');

console.log('\n=== LISTO ===');
console.log(`Correo estudiante: ${CORREO_EST}`);
console.log(`Código: ${codigo}`);
console.log(`Actividad #${actividad.id} · Caso #${caso.id}`);
console.log('Entrá en el login de estudiante con ese correo y código, luego Iniciar caso.');
