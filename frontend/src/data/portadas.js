const PORTADAS = [
  '/escenarios/game-esc-comisaria.jpg',
  '/escenarios/game-esc-hospital.jpg',
  '/escenarios/game-esc-barrio.jpg',
  '/escenarios/game-esc-hogar.jpg',
  '/escenarios/game-esc-plaza.jpg',
  '/escenarios/game-esc-ong.jpg',
  '/escenarios/game-esc-trabajo.jpg',
  '/escenarios/game-esc-bienestar.jpg',
  '/escenarios/game-esc-colegio.jpg',
  '/escenarios/game-esc-cafe.jpg'
];

const FALLBACK = [
  'linear-gradient(135deg, #d8e7f2 0%, #eef4f8 55%, #f7fafc 100%)',
  'linear-gradient(135deg, #e4efe8 0%, #f3f7f4 55%, #fbfcfb 100%)',
  'linear-gradient(135deg, #efe6da 0%, #f7f1ea 55%, #fcfaf7 100%)'
];

export function portadaDeCaso(caso) {
  const clave = Number(caso?.id) || String(caso?.titulo || '').length;
  return PORTADAS[Math.abs(clave) % PORTADAS.length];
}

export function portadaFondoCss(caso) {
  const img = portadaDeCaso(caso);
  const clave = Number(caso?.id) || String(caso?.titulo || '').length;
  const fallback = FALLBACK[Math.abs(clave) % FALLBACK.length];
  return `linear-gradient(90deg, rgba(247,250,252,0.12), rgba(20,36,48,0.48)), url('${img}'), ${fallback}`;
}
