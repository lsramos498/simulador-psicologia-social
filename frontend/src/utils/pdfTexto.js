import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extrae texto plano de un PDF en el navegador (sin subirlo al servidor).
 */
export async function extraerTextoPdf(archivo) {
  if (!archivo) {
    throw new Error('Selecciona un archivo PDF.');
  }
  const buffer = await archivo.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const partes = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const linea = content.items.map((item) => item.str).join(' ');
    partes.push(linea);
  }
  const texto = partes.join('\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!texto) {
    throw new Error('No se pudo leer texto del PDF. Prueba otro archivo o pega el texto.');
  }
  return texto;
}
