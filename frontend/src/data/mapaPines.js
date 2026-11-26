/** Posiciones (%) de pines sobre el mapa interactivo (soporta muchas escenas). */
export const PINES_MAPA = [
  { left: 16, top: 36 },
  { left: 46, top: 56 },
  { left: 72, top: 32 },
  { left: 30, top: 70 },
  { left: 60, top: 68 },
  { left: 84, top: 58 },
  { left: 38, top: 26 },
  { left: 58, top: 20 },
  { left: 22, top: 54 },
  { left: 78, top: 44 },
  { left: 50, top: 40 },
  { left: 12, top: 64 },
  { left: 88, top: 28 },
  { left: 42, top: 48 },
  { left: 66, top: 50 },
  { left: 26, top: 22 }
];

export function pinDeIndice(idx) {
  return PINES_MAPA[idx % PINES_MAPA.length];
}
