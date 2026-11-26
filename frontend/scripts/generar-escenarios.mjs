import fs from 'fs';

const imgs = {
  comisaria: '/escenarios/game-esc-comisaria.jpg',
  hospital: '/escenarios/game-esc-hospital.jpg',
  barrio: '/escenarios/game-esc-barrio.jpg',
  hogar: '/escenarios/game-esc-hogar.jpg',
  plaza: '/escenarios/game-esc-plaza.jpg',
  ong: '/escenarios/game-esc-ong.jpg',
  trabajo: '/escenarios/game-esc-trabajo.jpg',
  bienestar: '/escenarios/game-esc-bienestar.jpg',
  colegio: '/escenarios/game-esc-colegio.jpg',
  cafe: '/escenarios/game-esc-cafe.jpg'
};

const categorias = [
  {
    id: 'comisaria',
    nombre: 'Comisaría',
    img: 'comisaria',
    seeds: [
      'Recepción de la comisaría',
      'Sala de denuncias',
      'Oficina del patrullero',
      'Sala de espera policial',
      'Entrevista con el agente',
      'Mostrador de atención',
      'Archivo de denuncias',
      'Patio interno de la comisaría',
      'Sala de mediación policial',
      'Consulta de seguimiento',
      'Ventanilla de orientación',
      'Sala de víctimas',
      'Oficina de convivencia',
      'Puesto de atención inmediata',
      'Seguimiento en la comisaría'
    ]
  },
  {
    id: 'hospital',
    nombre: 'Hospital',
    img: 'hospital',
    seeds: [
      'Sala de espera del hospital',
      'Admisiones',
      'Consultorio externo',
      'Pasillo de hospitalización',
      'Urgencias en calma',
      'Enfermería',
      'Sala de familiares',
      'Cafetería del hospital',
      'Orientación al paciente',
      'Área de psicología hospitalaria',
      'Habitación compartida',
      'Puesto de enfermería',
      'Sala de juntas médicas',
      'Entrada principal del hospital',
      'Hablar con personal de salud'
    ]
  },
  {
    id: 'barrio',
    nombre: 'Barrio',
    img: 'barrio',
    seeds: [
      'Calle del barrio',
      'Tienda de la esquina',
      'Paradero del barrio',
      'Cancha comunal',
      'Casa vecinal',
      'Andén frente al local',
      'Reunión de vecinos',
      'Puesto de frutas',
      'Zona comercial local',
      'Calle peatonal',
      'Esquina concurrida',
      'Salón comunal del barrio',
      'Ruta hacia la casa',
      'Entrada al conjunto',
      'Hablar con gente del barrio'
    ]
  },
  {
    id: 'hogar',
    nombre: 'Hogar',
    img: 'hogar',
    seeds: [
      'Sala de la casa',
      'Cocina familiar',
      'Comedor',
      'Patio interior',
      'Habitación compartida',
      'Puerta de entrada',
      'Visita domiciliaria',
      'Sala con vecinos',
      'Espacio familiar',
      'Balcón de la casa',
      'Reunión familiar',
      'Sala de estar',
      'Pasillo de la vivienda',
      'Charla en la cocina',
      'Escucha en el hogar'
    ]
  },
  {
    id: 'plaza',
    nombre: 'Plaza y espacio público',
    img: 'plaza',
    seeds: [
      'Plaza principal',
      'Banca del parque',
      'Parque infantil',
      'Zona verde',
      'Fuente de la plaza',
      'Camino peatonal',
      'Punto de encuentro',
      'Área deportiva abierta',
      'Mercado al aire libre',
      'Sendero del parque',
      'Zona de descanso',
      'Entrada al parque',
      'Plazoleta del barrio',
      'Espacio comunitario abierto',
      'Encontrar a alguien en la plaza'
    ]
  },
  {
    id: 'ong',
    nombre: 'ONG y comunidad',
    img: 'ong',
    seeds: [
      'Sede de la ONG',
      'Sala de atención comunitaria',
      'Taller grupal',
      'Oficina de la organización',
      'Recepción comunitaria',
      'Sala de orientación',
      'Espacio de voluntariado',
      'Reunión de líderes',
      'Sala de escucha',
      'Proyecto comunitario',
      'Mesa de trabajo social',
      'Charla con la gestora',
      'Sala de reuniones ONG',
      'Entrada a la sede',
      'Remisión a la organización'
    ]
  },
  {
    id: 'trabajo',
    nombre: 'Lugar de trabajo',
    img: 'trabajo',
    seeds: [
      'Oficina laboral',
      'Sala de reuniones',
      'Recepción de la empresa',
      'Área de descanso laboral',
      'Puesto de trabajo',
      'Talento humano',
      'Cafetería laboral',
      'Pasillo de oficinas',
      'Entrevista en el trabajo',
      'Sala de mediación laboral',
      'Escritorio compartido',
      'Atención al cliente',
      'Sala de juntas',
      'Entrada a la empresa',
      'Área administrativa'
    ]
  },
  {
    id: 'bienestar',
    nombre: 'Servicios sociales',
    img: 'bienestar',
    seeds: [
      'Oficina de bienestar',
      'Ventanilla de trámites',
      'Sala de orientación social',
      'Centro de atención',
      'Espera de turnos',
      'Consulta psicosocial',
      'Mesa de atención prioritaria',
      'Sala de derechos',
      'Punto de información',
      'Oficina de trabajo social',
      'Espacio de remisión',
      'Sala familiar de bienestar',
      'Entrada al centro',
      'Área de seguimiento',
      'Hablar con la profesional'
    ]
  },
  {
    id: 'colegio',
    nombre: 'Colegio',
    img: 'colegio',
    seeds: [
      'Entrada del colegio',
      'Pasillo escolar',
      'Coordinación',
      'Orientación escolar',
      'Patio del colegio',
      'Sala de profesores',
      'Biblioteca escolar',
      'Recepción del colegio',
      'Encuentro con acudientes',
      'Cancha escolar',
      'Salón de orientación',
      'Portería',
      'Zona de descanso escolar',
      'Oficina directiva',
      'Hablar con un docente'
    ]
  },
  {
    id: 'cafe',
    nombre: 'Café y encuentro',
    img: 'cafe',
    seeds: [
      'Café del barrio',
      'Mesa junto a la ventana',
      'Barra del café',
      'Terraza del café',
      'Rincón tranquilo',
      'Encuentro informal',
      'Espera en el café',
      'Conversación en mesa',
      'Punto de cita',
      'Café cerca del hospital',
      'Café cerca de la comisaría',
      'Lugar neutral para hablar',
      'Segunda conversación',
      'Contrastar versiones en el café',
      'Cerrar una entrevista'
    ]
  },
  {
    id: 'ruta',
    nombre: 'Rutas de la simulación',
    img: 'plaza',
    seeds: [
      'Ir a la comisaría',
      'Ir al hospital',
      'Ir al barrio',
      'Ir al hogar',
      'Ir a la plaza',
      'Ir a la ONG',
      'Ir al trabajo',
      'Ir a bienestar',
      'Ir al colegio',
      'Buscar a otra persona',
      'Cambiar de lugar',
      'Volver a preguntar',
      'Seguir una pista social',
      'Contrastar dos versiones',
      'Cerrar la visita'
    ]
  },
  {
    id: 'persona',
    nombre: 'Preguntar a personas',
    img: 'cafe',
    seeds: [
      'Preguntar al testigo',
      'Preguntar a la víctima',
      'Preguntar al funcionario',
      'Preguntar a la madre',
      'Preguntar al adolescente',
      'Preguntar a la vecina',
      'Preguntar al líder comunitario',
      'Preguntar a la enfermera',
      'Preguntar al docente',
      'Preguntar al compañero de trabajo',
      'Preguntar a la gestora',
      'Preguntar al comerciante',
      'Preguntar al acudiente',
      'Preguntar al paciente',
      'Preguntar al agente'
    ]
  },
  {
    id: 'practica',
    nombre: 'Situaciones de práctica',
    img: 'barrio',
    seeds: [
      'Conflicto entre vecinos',
      'Discusión familiar',
      'Tensión en el trabajo',
      'Queja en la comisaría',
      'Malentendido en el colegio',
      'Problema de convivencia',
      'Rumores en el barrio',
      'Falta de apoyo institucional',
      'Pedido de ayuda en la ONG',
      'Situación en sala de espera',
      'Presión del grupo',
      'Decisión difícil en familia',
      'Mediación entre dos partes',
      'Queja de un usuario',
      'Situación de exclusión'
    ]
  }
];

const contextos = [
  'El estudiante llega aquí para observar e indagar.',
  'Hay personas a quienes se puede preguntar con respeto.',
  'Conviene contrastar versiones y escuchar con cuidado.',
  'Registra qué se ve, qué se oye y a quién preguntar.',
  'Espacio cotidiano para practicar intervención social.',
  'Requiere escucha, empatía y cuidado ético.',
  'Puedes avanzar preguntando o cambiando de lugar.',
  'El objetivo es comprender la situación desde este punto.'
];

const escenarios = [];
let n = 1;
for (const cat of categorias) {
  for (const seed of cat.seeds) {
    if (escenarios.length >= 200) break;
    escenarios.push({
      id: `esc-${String(n).padStart(3, '0')}`,
      categoria: cat.id,
      categoriaNombre: cat.nombre,
      titulo: seed,
      descripcion: `${seed}. ${contextos[(n - 1) % contextos.length]}`,
      imagen: imgs[cat.img]
    });
    n += 1;
  }
}

while (escenarios.length < 200) {
  const i = escenarios.length;
  const cat = categorias[i % categorias.length];
  const seed = `${cat.seeds[i % cat.seeds.length]} (${Math.floor(i / cat.seeds.length) + 1})`;
  escenarios.push({
    id: `esc-${String(i + 1).padStart(3, '0')}`,
    categoria: cat.id,
    categoriaNombre: cat.nombre,
    titulo: seed,
    descripcion: `${seed}. ${contextos[i % contextos.length]}`,
    imagen: imgs[cat.img]
  });
}

fs.writeFileSync(
  'src/data/bancoEscenarios.js',
  `/** Lugares y encuentros para la simulación de práctica (~${escenarios.length}). */
export const BANCO_ESCENARIOS = ${JSON.stringify(escenarios, null, 2)};

export const CATEGORIAS_ESCENARIO = [
  ...new Set(BANCO_ESCENARIOS.map((e) => e.categoriaNombre))
];

export function escenarioPorId(id) {
  return BANCO_ESCENARIOS.find((e) => e.id === id) || null;
}
`
);

const galeria = Array.from({ length: 10 }, (_, i) => ({
  id: `game-pj-${String(i + 1).padStart(2, '0')}`,
  etiqueta: `Personaje ${i + 1}`,
  imagen: `/personajes/game-pj-${String(i + 1).padStart(2, '0')}.jpg`
}));

fs.writeFileSync(
  'src/data/galeriaPersonajes.js',
  `/** Retratos disponibles para asignar a personas del caso. */
export const GALERIA_PERSONAJES = ${JSON.stringify(galeria, null, 2)};
`
);

console.log(`OK escenarios=${escenarios.length} galeria=${galeria.length}`);
