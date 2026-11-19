/** Posiciones (%) de pines sobre el mapa interactivo. */
export const PINES_MAPA = [
  { left: 18, top: 38 },
  { left: 48, top: 58 },
  { left: 72, top: 34 },
  { left: 32, top: 72 },
  { left: 62, top: 70 },
  { left: 82, top: 62 },
  { left: 40, top: 28 },
  { left: 58, top: 22 }
];

export function pinDeIndice(idx) {
  return PINES_MAPA[idx % PINES_MAPA.length];
}
