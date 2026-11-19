import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../../../../storage/casos-material');

async function asegurarDir() {
  await fs.mkdir(DIR, { recursive: true });
}

function ruta(casoId) {
  const id = Number(casoId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Object.assign(new Error('casoId inválido'), { statusCode: 400 });
  }
  return path.join(DIR, `${id}.json`);
}

export async function leerMaterialCaso(casoId) {
  try {
    const texto = await fs.readFile(ruta(casoId), 'utf8');
    const data = JSON.parse(texto);
    return {
      dialogos: data?.dialogos && typeof data.dialogos === 'object' ? data.dialogos : {},
      portadas: data?.portadas && typeof data.portadas === 'object' ? data.portadas : {}
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { dialogos: {}, portadas: {} };
    }
    throw error;
  }
}

export async function guardarMaterialCaso(casoId, material) {
  await asegurarDir();
  const actual = await leerMaterialCaso(casoId);
  const siguiente = {
    dialogos:
      material?.dialogos && typeof material.dialogos === 'object'
        ? material.dialogos
        : actual.dialogos,
    portadas:
      material?.portadas && typeof material.portadas === 'object'
        ? material.portadas
        : actual.portadas,
    actualizadoEn: new Date().toISOString()
  };
  await fs.writeFile(ruta(casoId), JSON.stringify(siguiente, null, 2), 'utf8');
  return siguiente;
}
