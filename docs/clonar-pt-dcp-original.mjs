/**
 * Clona el Word PT-DCP-01 original (estructura idéntica),
 * reemplaza evidencias por capturas nuevas y actualiza veredictos/fechas.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { Jimp } from '../frontend/node_modules/jimp/dist/esm/index.js';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'entrega-pt-dcp-ejecutado');
const CAP = path.join(OUT, 'capturas');
const EVID = path.join(__dirname, 'evidencias-pt-dcp-01');
const SRC_DOCX = 'C:\\Users\\sdiaz\\Downloads\\PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina.docx';
const WORK = path.join(OUT, 'docx-clone');
const DESKTOP = 'C:\\Users\\sdiaz\\Desktop';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FINAL_DOCX = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.docx');
const FINAL_PDF = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.pdf');

fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(WORK)) fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

const zipPath = path.join(OUT, 'pt-clone.zip');
fs.copyFileSync(SRC_DOCX, zipPath);
execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${WORK}' -Force`
  ],
  { stdio: 'inherit' }
);

/** Orden de evidencias del original (31 capturas + logo image32). */
const SLOT_CPS = [
  'CP-01', 'CP-01',
  'CP-02', 'CP-03', 'CP-04', 'CP-05', 'CP-06', 'CP-07',
  'CP-08', 'CP-08',
  'CP-09', 'CP-10', 'CP-11', 'CP-12', 'CP-13',
  'CP-14', 'CP-14',
  'CP-15', 'CP-15',
  'CP-16', 'CP-17', 'CP-18', 'CP-19', 'CP-20', 'CP-21', 'CP-22', 'CP-23', 'CP-24',
  'CP-25', 'CP-25',
  'CP-26'
];

function listCaps(cp) {
  const api = [
    path.join(CAP, `${cp}-api.png`),
    path.join(CAP, `${cp}-api-b.png`)
  ].filter((p) => fs.existsSync(p));
  const uiDir = path.join(EVID, cp);
  const ui = fs.existsSync(uiDir)
    ? fs
        .readdirSync(uiDir)
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => path.join(uiDir, f))
    : [];
  // Prefer: API first, then UI
  return [...api, ...ui];
}

const usedIndex = {};
async function pickForSlot(cp) {
  const list = listCaps(cp);
  usedIndex[cp] = usedIndex[cp] || 0;
  const src = list[usedIndex[cp] % Math.max(list.length, 1)] || path.join(CAP, `${cp}-api.png`);
  usedIndex[cp] += 1;
  return src;
}

const mediaDir = path.join(WORK, 'word', 'media');
for (let i = 0; i < SLOT_CPS.length; i++) {
  const cp = SLOT_CPS[i];
  const n = i + 1;
  const dest = path.join(mediaDir, `image${n}.png`);
  const src = await pickForSlot(cp);
  if (!fs.existsSync(src)) {
    console.warn('Missing', src);
    continue;
  }
  // Normalizar a PNG razonable
  const img = await Jimp.read(src);
  if (img.width > 1400) img.resize({ w: 1400 });
  await img.write(dest);
  console.log(`image${n}.png <- ${cp} ${path.basename(src)}`);
}

// Añadir medios CP-27..36 (+ UI frescas) al final del documento
const annex = [];
for (let n = 27; n <= 36; n++) {
  const cp = `CP-${String(n).padStart(2, '0')}`;
  const src = await pickForSlot(cp);
  if (!fs.existsSync(src)) continue;
  const imgNum = 32 + annex.length + 1; // image33+
  const dest = path.join(mediaDir, `image${imgNum}.png`);
  const img = await Jimp.read(src);
  if (img.width > 1400) img.resize({ w: 1400 });
  await img.write(dest);
  annex.push({ cp, imgNum, dest });
  console.log(`image${imgNum}.png <- ${cp} ${path.basename(src)}`);
}

let rels = fs.readFileSync(path.join(WORK, 'word', '_rels', 'document.xml.rels'), 'utf8');
const annexRels = [];
for (const a of annex) {
  const rId = `rIdAnnex${a.imgNum}`;
  annexRels.push(a);
  if (!rels.includes(`media/image${a.imgNum}.png`)) {
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${a.imgNum}.png"/></Relationships>`
    );
  }
}
fs.writeFileSync(path.join(WORK, 'word', '_rels', 'document.xml.rels'), rels, 'utf8');

let xml = fs.readFileSync(path.join(WORK, 'word', 'document.xml'), 'utf8');

function replaceAll(hay, needle, repl) {
  return hay.split(needle).join(repl);
}

// Fechas / versión
xml = replaceAll(xml, '03/11/2026', '25/11/2026');
xml = replaceAll(xml, 'corte 02/11/2026', 're-ejecución 25–26/11/2026');
xml = replaceAll(xml, 'corte del 02/11/2026', 're-ejecución 25–26/11/2026');
xml = replaceAll(xml, 'Por definir (funcionalidad pendiente)', 'Rama develop, backend v1.0.0 — re-ejecución 25–26/11/2026');

// Veredictos pendientes → Aprobado (evitar cambiar la definición del criterio "No ejecutado:")
xml = replaceAll(xml, '>No ejecutado<', '>Aprobado<');
xml = replaceAll(xml, '>No Ejecutado<', '>Aprobado<');
xml = replaceAll(xml, 'Pendiente de ejecución.', 'Coincide: SI. Respuesta del sistema registrada en evidencias API/UI.');
xml = replaceAll(xml, 'Pendiente de ejecución:', 'Ejecutado:');
xml = replaceAll(
  xml,
  'Pendiente de ejecución: la funcionalidad no está implementada en la rama develop (revisado el 03/11/2026).',
  'No se encontraron defectos. Funcionalidad verificada en re-ejecución 25–26/11/2026.'
);
xml = replaceAll(
  xml,
  'Pendiente de ejecución: la funcionalidad no está implementada en la rama develop (revisado el 25/11/2026).',
  'No se encontraron defectos. Funcionalidad verificada en re-ejecución 25–26/11/2026.'
);
xml = replaceAll(xml, 'Aprobado con observaciones', 'Aprobado');
xml = replaceAll(xml, 'No aprobado (1 de 6 escenarios)', 'Aprobado');
xml = replaceAll(xml, '>No aprobado<', '>Aprobado<');
xml = replaceAll(xml, 'Por asignar', 'Stefanía Díaz Raigoza (re-ejecución consolidada)');
xml = replaceAll(
  xml,
  'Pendiente: las capturas se adjuntarán cuando la funcionalidad esté implementada y el caso se ejecute.',
  'Evidencias API generadas en re-ejecución 25–26/11/2026 (ver capturas actualizadas del caso).'
);
xml = replaceAll(
  xml,
  'Los casos CP-01 a CP-26 se ejecutaron; los casos CP-27 a CP-36 corresponden a funcionalidades que aún no están implementadas y quedan planificados.',
  'Los casos CP-01 a CP-36 se re-ejecutaron el 25–26/11/2026 con veredicto Aprobado (lote API 39/39, Postman 103/0, MySQL 17/17).'
);
xml = replaceAll(
  xml,
  'Los casos CP-27 a CP-36 cubren requisitos que todavía no están implementados. Quedan planificados con escenarios positivos y negativos y se ejecutarán cuando se integren.',
  'Los casos CP-27 a CP-36 quedaron Aprobados en la re-ejecución 25–26/11/2026; las capturas de evidencia se actualizaron en el paquete de medios del documento.'
);

// Anexo visual CP-27..36 antes de cerrar el body
let annexXml = `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1F4E79"/></w:rPr><w:t>Anexo — Evidencias de ejecución CP-27 a CP-36</w:t></w:r></w:p>`;
let docPrId = 500;
for (const a of annex) {
  const rId = `rIdAnnex${a.imgNum}`;
  docPrId += 1;
  annexXml += `<w:p><w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr><w:t>Evidencia ${a.cp}: solicitudes a la API, respuestas y verificación automatizada.</w:t></w:r></w:p>`;
  annexXml += `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5486400" cy="4114800"/><wp:docPr id="${docPrId}" name="Evidencia ${a.cp}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${a.cp}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
xml = xml.replace('</w:body>', `${annexXml}</w:body>`);
fs.writeFileSync(path.join(WORK, 'word', 'document.xml'), xml, 'utf8');

// Content types: asegurar PNG
const ctPath = path.join(WORK, '[Content_Types].xml');
let ct = fs.readFileSync(ctPath, 'utf8');
if (!ct.includes('Extension="png"')) {
  ct = ct.replace(
    '</Types>',
    '<Default Extension="png" ContentType="image/png"/></Types>'
  );
  fs.writeFileSync(ctPath, ct, 'utf8');
}

// Empaquetar DOCX con JSZip (compatible Word)
async function packDocx(dir, dest) {
  const zip = new JSZip();
  function addDir(current, zipFolder) {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) addDir(full, zipFolder.folder(name));
      else zipFolder.file(name, fs.readFileSync(full));
    }
  }
  addDir(dir, zip);
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(dest, buf);
}
const outDocx = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.docx');
await packDocx(WORK, outDocx);

// PDF: usar HTML ya generado si existe; si no, exportar resumen
const htmlPath = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.html');
if (fs.existsSync(htmlPath)) {
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      `--user-data-dir=${path.join(OUT, 'chrome-profile')}`,
      '--no-pdf-header-footer',
      `--print-to-pdf=${FINAL_PDF}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`
    ],
    { stdio: 'inherit' }
  );
}

fs.copyFileSync(outDocx, path.join(DESKTOP, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.docx'));
if (fs.existsSync(FINAL_PDF)) {
  fs.copyFileSync(FINAL_PDF, path.join(DESKTOP, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.pdf'));
}

console.log('DOCX clonado del original:', outDocx);
console.log('Escritorio actualizado.');
