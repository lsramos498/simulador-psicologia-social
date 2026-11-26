/**
 * Genera 200 imágenes de escenario visualmente distintas
 * (solo bases ilustradas de práctica) y regenera bancoEscenarios.js.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Jimp } from 'jimp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const escDir = path.join(root, 'public', 'escenarios');
const outDir = path.join(escDir, 'unicos');
fs.mkdirSync(outDir, { recursive: true });

const preferidas = fs
  .readdirSync(escDir)
  .filter((f) => f.endsWith('.jpg'))
  .filter((f) => f.startsWith('game-esc-') || f.startsWith('u-'));

if (preferidas.length < 8) {
  throw new Error('Faltan imágenes base ilustradas (game-esc-* / u-*)');
}

const porTema = {
  comisaria: preferidas.filter((f) => /comisaria/i.test(f)),
  hospital: preferidas.filter((f) => /hospital/i.test(f)),
  barrio: preferidas.filter((f) => /barrio/i.test(f)),
  hogar: preferidas.filter((f) => /hogar/i.test(f)),
  plaza: preferidas.filter((f) => /plaza|parque|fuente|cancha/i.test(f)),
  ong: preferidas.filter((f) => /ong|mediacion|taller/i.test(f)),
  trabajo: preferidas.filter((f) => /trabajo|open/i.test(f)),
  bienestar: preferidas.filter((f) => /bienestar/i.test(f)),
  colegio: preferidas.filter((f) => /colegio/i.test(f)),
  cafe: preferidas.filter((f) => /cafe/i.test(f))
};

const categorias = [
  { nombre: 'Comisaría', tema: 'comisaria', seeds: ['Recepción de la comisaría','Sala de denuncias','Oficina del patrullero','Sala de espera policial','Entrevista con el agente','Mostrador de atención','Archivo de denuncias','Patio interno de la comisaría','Sala de mediación policial','Consulta de seguimiento','Ventanilla de orientación','Sala de víctimas','Oficina de convivencia','Puesto de atención inmediata','Seguimiento en la comisaría'] },
  { nombre: 'Hospital', tema: 'hospital', seeds: ['Sala de espera del hospital','Admisiones','Consultorio externo','Pasillo de hospitalización','Urgencias en calma','Enfermería','Sala de familiares','Cafetería del hospital','Orientación al paciente','Área de psicología hospitalaria','Habitación compartida','Puesto de enfermería','Sala de juntas médicas','Entrada principal del hospital','Hablar con personal de salud'] },
  { nombre: 'Barrio', tema: 'barrio', seeds: ['Calle del barrio','Tienda de la esquina','Paradero del barrio','Cancha comunal','Casa vecinal','Andén frente al local','Reunión de vecinos','Puesto de frutas','Zona comercial local','Calle peatonal','Esquina concurrida','Salón comunal del barrio','Ruta hacia la casa','Entrada al conjunto','Hablar con gente del barrio'] },
  { nombre: 'Hogar', tema: 'hogar', seeds: ['Sala de la casa','Cocina familiar','Comedor','Patio interior','Habitación compartida','Puerta de entrada','Visita domiciliaria','Sala con vecinos','Espacio familiar','Balcón de la casa','Reunión familiar','Sala de estar','Pasillo de la vivienda','Charla en la cocina','Escucha en el hogar'] },
  { nombre: 'Plaza y espacio público', tema: 'plaza', seeds: ['Plaza principal','Banca del parque','Parque infantil','Zona verde','Fuente de la plaza','Camino peatonal','Punto de encuentro','Área deportiva abierta','Mercado al aire libre','Sendero del parque','Zona de descanso','Entrada al parque','Plazoleta del barrio','Espacio comunitario abierto','Encontrar a alguien en la plaza'] },
  { nombre: 'ONG y comunidad', tema: 'ong', seeds: ['Sede de la ONG','Sala de atención comunitaria','Taller grupal','Oficina de la organización','Recepción comunitaria','Sala de orientación','Espacio de voluntariado','Reunión de líderes','Sala de escucha','Proyecto comunitario','Mesa de trabajo social','Charla con la gestora','Sala de reuniones ONG','Entrada a la sede','Remisión a la organización'] },
  { nombre: 'Lugar de trabajo', tema: 'trabajo', seeds: ['Oficina laboral','Sala de reuniones','Recepción de la empresa','Área de descanso laboral','Puesto de trabajo','Talento humano','Cafetería laboral','Pasillo de oficinas','Entrevista en el trabajo','Sala de mediación laboral','Escritorio compartido','Atención al cliente','Sala de juntas','Entrada a la empresa','Área administrativa'] },
  { nombre: 'Servicios sociales', tema: 'bienestar', seeds: ['Oficina de bienestar','Ventanilla de trámites','Sala de orientación social','Centro de atención','Espera de turnos','Consulta psicosocial','Mesa de atención prioritaria','Sala de derechos','Punto de información','Oficina de trabajo social','Espacio de remisión','Sala familiar de bienestar','Entrada al centro','Área de seguimiento','Hablar con la profesional'] },
  { nombre: 'Colegio', tema: 'colegio', seeds: ['Entrada del colegio','Pasillo escolar','Coordinación','Orientación escolar','Patio del colegio','Sala de profesores','Biblioteca escolar','Recepción del colegio','Encuentro con acudientes','Cancha escolar','Salón de orientación','Portería','Zona de descanso escolar','Oficina directiva','Hablar con un docente'] },
  { nombre: 'Café y encuentro', tema: 'cafe', seeds: ['Café del barrio','Mesa junto a la ventana','Barra del café','Terraza del café','Rincón tranquilo','Encuentro informal','Espera en el café','Conversación en mesa','Punto de cita','Café cerca del hospital','Café cerca de la comisaría','Lugar neutral para hablar','Segunda conversación','Contrastar versiones en el café','Cerrar una entrevista'] },
  { nombre: 'Rutas de la simulación', tema: 'plaza', seeds: ['Ir a la comisaría','Ir al hospital','Ir al barrio','Ir al hogar','Ir a la plaza','Ir a la ONG','Ir al trabajo','Ir a bienestar','Ir al colegio','Buscar a otra persona','Cambiar de lugar','Volver a preguntar','Seguir una pista social','Contrastar dos versiones','Cerrar la visita'] },
  { nombre: 'Preguntar a personas', tema: 'cafe', seeds: ['Preguntar al testigo','Preguntar a la víctima','Preguntar al funcionario','Preguntar a la madre','Preguntar al adolescente','Preguntar a la vecina','Preguntar al líder comunitario','Preguntar a la enfermera','Preguntar al docente','Preguntar al compañero de trabajo','Preguntar a la gestora','Preguntar al comerciante','Preguntar al acudiente','Preguntar al paciente','Preguntar al agente'] },
  { nombre: 'Situaciones de práctica', tema: 'barrio', seeds: ['Conflicto entre vecinos','Discusión familiar','Tensión en el trabajo','Queja en la comisaría','Malentendido en el colegio','Problema de convivencia','Rumores en el barrio','Falta de apoyo institucional','Pedido de ayuda en la ONG','Situación en sala de espera','Presión del grupo','Decisión difícil en familia','Mediación entre dos partes','Queja de un usuario','Situación de exclusión'] }
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

const escenariosMeta = [];
let n = 1;
for (const cat of categorias) {
  for (const seed of cat.seeds) {
    if (escenariosMeta.length >= 200) break;
    escenariosMeta.push({
      id: `esc-${String(n).padStart(3, '0')}`,
      categoria: cat.nombre.toLowerCase().replace(/\s+/g, '-'),
      categoriaNombre: cat.nombre,
      tema: cat.tema,
      titulo: seed,
      descripcion: `${seed}. ${contextos[(n - 1) % contextos.length]}`
    });
    n += 1;
  }
}
while (escenariosMeta.length < 200) {
  const i = escenariosMeta.length;
  const cat = categorias[i % categorias.length];
  const seed = `${cat.seeds[i % cat.seeds.length]} (${Math.floor(i / cat.seeds.length) + 1})`;
  escenariosMeta.push({
    id: `esc-${String(i + 1).padStart(3, '0')}`,
    categoria: cat.nombre.toLocaleLowerCase('es').replace(/\s+/g, '-'),
    categoriaNombre: cat.nombre,
    tema: cat.tema,
    titulo: seed,
    descripcion: `${seed}. ${contextos[i % contextos.length]}`
  });
}

const cached = new Map();
async function loadBase(file) {
  if (!cached.has(file)) {
    cached.set(file, await Jimp.read(path.join(escDir, file)));
  }
  return cached.get(file);
}

function tintRgb(i) {
  const hues = [
    [36, 118, 170],
    [34, 150, 118],
    [176, 108, 58],
    [118, 78, 168],
    [190, 78, 98],
    [68, 138, 88],
    [88, 98, 178],
    [158, 88, 68],
    [48, 128, 148],
    [128, 98, 58]
  ];
  return hues[i % hues.length];
}

function basePara(meta, i) {
  const pool = porTema[meta.tema]?.length ? porTema[meta.tema] : preferidas;
  // Rota dentro del tema y también mezcla con otra base del mismo pool
  return pool[i % pool.length];
}

const escenarios = [];
for (let i = 0; i < escenariosMeta.length; i += 1) {
  const meta = escenariosMeta[i];
  const baseName = basePara(meta, i);
  const img = (await loadBase(baseName)).clone();

  const w = img.bitmap.width;
  const h = img.bitmap.height;
  // Recorte distinto por índice (encuadre único)
  const zoom = 0.78 + ((i * 11) % 18) / 100;
  const cropW = Math.max(320, Math.floor(w * zoom));
  const cropH = Math.max(180, Math.floor(h * zoom));
  const x = Math.floor((((i * 19) % 23) / 23) * Math.max(0, w - cropW));
  const y = Math.floor((((i * 17) % 19) / 19) * Math.max(0, h - cropH));
  img.crop({ x, y, w: cropW, h: cropH });
  img.resize({ w: 960, h: 540 });

  // Brillo (multiplicador: 1 = sin cambio) y contraste ligeros
  const brightMul = 0.88 + ((i % 7) * 0.04);
  const contrast = ((i % 5) - 2) * 0.04;
  img.brightness(brightMul);
  img.contrast(contrast);

  // Tinte de color único (sin barras ni badges encima)
  const [tr, tg, tb] = tintRgb(i);
  const mix = 0.12 + ((i % 6) * 0.025);
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (px, py, idx) {
    this.bitmap.data[idx] = Math.min(255, Math.round(this.bitmap.data[idx] * (1 - mix) + tr * mix));
    this.bitmap.data[idx + 1] = Math.min(255, Math.round(this.bitmap.data[idx + 1] * (1 - mix) + tg * mix));
    this.bitmap.data[idx + 2] = Math.min(255, Math.round(this.bitmap.data[idx + 2] * (1 - mix) + tb * mix));
  });

  // Viñeta suave distinta (más clara / más oscura en bordes)
  const cx = img.bitmap.width / 2;
  const cy = img.bitmap.height / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  const vignette = 0.08 + ((i % 4) * 0.03);
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (px, py, idx) {
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / maxD;
    const factor = 1 - d * vignette;
    this.bitmap.data[idx] = Math.max(0, Math.min(255, Math.round(this.bitmap.data[idx] * factor)));
    this.bitmap.data[idx + 1] = Math.max(0, Math.min(255, Math.round(this.bitmap.data[idx + 1] * factor)));
    this.bitmap.data[idx + 2] = Math.max(0, Math.min(255, Math.round(this.bitmap.data[idx + 2] * factor)));
  });

  const fileName = `unico-${String(i + 1).padStart(3, '0')}.jpg`;
  await img.write(path.join(outDir, fileName));

  escenarios.push({
    id: meta.id,
    categoria: meta.categoria,
    categoriaNombre: meta.categoriaNombre,
    titulo: meta.titulo,
    descripcion: meta.descripcion,
    imagen: `/escenarios/unicos/${fileName}`
  });

  if ((i + 1) % 25 === 0) console.log(`imagenes ${i + 1}/200`);
}

const outJs = `/** Lugares y encuentros para la simulación (~${escenarios.length}), cada uno con imagen distinta. */
export const BANCO_ESCENARIOS = ${JSON.stringify(escenarios, null, 2)};

export const CATEGORIAS_ESCENARIO = [
  ...new Set(BANCO_ESCENARIOS.map((e) => e.categoriaNombre))
];

export function escenarioPorId(id) {
  return BANCO_ESCENARIOS.find((e) => e.id === id) || null;
}
`;

fs.writeFileSync(path.join(root, 'src', 'data', 'bancoEscenarios.js'), outJs);
console.log(`OK ${escenarios.length} escenarios únicos | bases ${preferidas.length}`);
