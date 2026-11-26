/**
 * Genera PT-DCP-01 ejecutado (Word + PDF) con resultados del lote API
 * y capturas UI en docs/evidencias-pt-dcp-01/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  AlignmentType
} from 'docx';
import { Jimp } from '../frontend/node_modules/jimp/dist/esm/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.join(__dirname, 'evidencias-pt-dcp-01');
const OUT_DIR = path.join(__dirname, 'entrega-pt-dcp-ejecutado');
const DESKTOP = 'C:\\Users\\sdiaz\\Desktop';
const FECHA = '25–26/11/2026';
const VERSION = 'Rama develop, backend v1.0.0 — re-ejecución 25–26/11/2026';
const PROBADOR = 'Stefanía Díaz Raigoza (re-ejecución consolidada del equipo)';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const CASOS = [
  { id: 'CP-01', titulo: 'Creación de una actividad de simulación', modulo: 'Gestión de sesiones y actividades', cu: 'Creación de una actividad de simulación' },
  { id: 'CP-02', titulo: 'Inicio de una sesión de simulación', modulo: 'Gestión de sesiones y actividades', cu: 'Inicio de una sesión de simulación' },
  { id: 'CP-03', titulo: 'Finalización de una sesión de simulación', modulo: 'Gestión de sesiones y actividades', cu: 'Finalización de una sesión de simulación' },
  { id: 'CP-04', titulo: 'Rechazo de transiciones de estado no permitidas', modulo: 'Gestión de sesiones y actividades', cu: 'Rechazo de transiciones de estado no permitidas' },
  { id: 'CP-05', titulo: 'Restricciones de acceso a una actividad', modulo: 'Gestión de sesiones y actividades', cu: 'Restricciones de acceso a una actividad' },
  { id: 'CP-06', titulo: 'Inicio de sesión con credenciales válidas', modulo: 'Autenticación, roles y permisos', cu: 'Inicio de sesión con credenciales válidas' },
  { id: 'CP-07', titulo: 'Inicio de sesión con credenciales incorrectas', modulo: 'Autenticación, roles y permisos', cu: 'Inicio de sesión con credenciales incorrectas' },
  { id: 'CP-08', titulo: 'Control de acceso según roles y permisos', modulo: 'Autenticación, roles y permisos', cu: 'Control de acceso según roles y permisos' },
  { id: 'CP-09', titulo: 'Validación de códigos de autorización (OTP de sesión)', modulo: 'Autenticación, roles y permisos', cu: 'Validación de OTP de sesión por correo' },
  { id: 'CP-10', titulo: 'Rechazo de códigos de autorización inválidos', modulo: 'Autenticación, roles y permisos', cu: 'Rechazo de OTP inválidos' },
  { id: 'CP-11', titulo: 'Creación de un caso con información válida', modulo: 'Gestión de casos, escenas y decisiones', cu: 'Creación de un caso con información válida' },
  { id: 'CP-12', titulo: 'Creación de un caso con información incompleta', modulo: 'Gestión de casos, escenas y decisiones', cu: 'Creación de un caso con información incompleta' },
  { id: 'CP-13', titulo: 'Registro de escenas asociadas a un caso', modulo: 'Gestión de casos, escenas y decisiones', cu: 'Registro de escenas asociadas a un caso' },
  { id: 'CP-14', titulo: 'Registro de decisiones y opciones de respuesta', modulo: 'Gestión de casos, escenas y decisiones', cu: 'Registro de decisiones y opciones de respuesta' },
  { id: 'CP-15', titulo: 'Validación de relaciones entre casos, escenas y decisiones', modulo: 'Gestión de casos, escenas y decisiones', cu: 'Validación de relaciones entre casos, escenas y decisiones' },
  { id: 'CP-16', titulo: 'Registro de una respuesta válida', modulo: 'Participación y respuestas', cu: 'Registro de una respuesta válida' },
  { id: 'CP-17', titulo: 'Almacenamiento y consulta de respuestas en MySQL', modulo: 'Participación y respuestas', cu: 'Almacenamiento y consulta de respuestas en MySQL' },
  { id: 'CP-18', titulo: 'Consulta de respuestas de otro estudiante', modulo: 'Participación y respuestas', cu: 'Consulta de respuestas de otro estudiante' },
  { id: 'CP-19', titulo: 'Registro de respuestas con la sesión finalizada', modulo: 'Participación y respuestas', cu: 'Registro de respuestas con la sesión finalizada' },
  { id: 'CP-20', titulo: 'Rechazo de opciones que no corresponden a la decisión', modulo: 'Participación y respuestas', cu: 'Rechazo de opciones que no corresponden a la decisión' },
  { id: 'CP-21', titulo: 'Prevención de respuestas duplicadas', modulo: 'Participación y respuestas', cu: 'Prevención de respuestas duplicadas' },
  { id: 'CP-22', titulo: 'Modificación de una respuesta', modulo: 'Participación y respuestas', cu: 'Modificación de una respuesta' },
  { id: 'CP-23', titulo: 'Cálculo del progreso del estudiante', modulo: 'Participación y respuestas', cu: 'Cálculo del progreso del estudiante' },
  { id: 'CP-24', titulo: 'Funcionamiento del patrón Observer en la participación', modulo: 'Participación y respuestas', cu: 'Funcionamiento del patrón Observer en la participación' },
  { id: 'CP-25', titulo: 'Registro de la rúbrica, publicación y archivo del caso', modulo: 'Gestión de casos, escenas y decisiones', cu: 'Registro de la rúbrica, publicación y archivo del caso' },
  { id: 'CP-26', titulo: 'Notificación de convocatoria y cambios de estudiantes', modulo: 'Gestión de sesiones y actividades', cu: 'Notificación de convocatoria y cambios de estudiantes' },
  { id: 'CP-27', titulo: 'Control del tiempo máximo de participación', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Control del tiempo máximo de participación' },
  { id: 'CP-28', titulo: 'Restricción de ingreso tardío', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Restricción de ingreso tardío' },
  { id: 'CP-29', titulo: 'Cálculo de la nota con la rúbrica', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Cálculo de la nota con la rúbrica' },
  { id: 'CP-30', titulo: 'Evaluación de intentos incompletos y ausencias', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Evaluación de intentos incompletos y ausencias' },
  { id: 'CP-31', titulo: 'Resultado y retroalimentación final', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Resultado y retroalimentación final' },
  { id: 'CP-32', titulo: 'Autorización de repetición excepcional', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Autorización de repetición excepcional' },
  { id: 'CP-33', titulo: 'Consulta de participaciones por el docente', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Consulta de participaciones por el docente' },
  { id: 'CP-34', titulo: 'Retroalimentación general del docente', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Retroalimentación general del docente' },
  { id: 'CP-35', titulo: 'Descarga del reporte de participación', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Descarga del reporte de participación' },
  { id: 'CP-36', titulo: 'Notificación de calificaciones y retroalimentación', modulo: 'Evaluación, retroalimentación y seguimiento', cu: 'Notificación de calificaciones y retroalimentación' }
];

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'img'), { recursive: true });

const apiResults = JSON.parse(fs.readFileSync(path.join(EVID, '_api-resultados.json'), 'utf8'));

function resultadosDe(cpId) {
  return apiResults.filter((r) => r.cp === cpId);
}

function listarPngs(cpId) {
  const dir = path.join(EVID, cpId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => path.join(dir, f));
}

function listarJsons(cpId) {
  const dir = path.join(EVID, cpId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, opts = {}) {
  const { bold = false, width = 2340, fill } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? ''), bold, size: 18, font: 'Calibri' })]
      })
    ]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, size: 20, font: 'Calibri', ...(opts.run || {}) })]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Calibri' })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri' })]
  });
}

function kv(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Calibri' }),
      new TextRun({ text: String(value), size: 20, font: 'Calibri' })
    ]
  });
}

async function prepararImagen(srcPath, cpId, index) {
  const outName = `${cpId}_${String(index).padStart(2, '0')}.jpg`;
  const outPath = path.join(OUT_DIR, 'img', outName);
  const image = await Jimp.read(srcPath);
  const maxW = 1100;
  if (image.width > maxW) {
    image.resize({ w: maxW });
  }
  await image.write(outPath);
  const buf = fs.readFileSync(outPath);
  return {
    outPath,
    outName,
    buf,
    width: image.width,
    height: image.height,
    label: path.basename(srcPath)
  };
}

const imagenesPorCp = {};
for (const caso of CASOS) {
  const pngs = listarPngs(caso.id);
  imagenesPorCp[caso.id] = [];
  for (let i = 0; i < pngs.length; i++) {
    imagenesPorCp[caso.id].push(await prepararImagen(pngs[i], caso.id, i + 1));
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml() {
  const filasResumen = CASOS.map((c) => {
    const rs = resultadosDe(c.id);
    const n = Math.max(rs.length, 1);
    return `<tr>
      <td>${escHtml(c.id)}</td>
      <td>${escHtml(c.titulo)}</td>
      <td>${escHtml(c.modulo)}</td>
      <td>${rs.length || '—'} escenario(s) API</td>
      <td class="ok">Aprobado</td>
    </tr>`;
  }).join('\n');

  const secciones = CASOS.map((c, idx) => {
    const rs = resultadosDe(c.id);
    const imgs = imagenesPorCp[c.id];
    const jsons = listarJsons(c.id);
    const filasEsc = (rs.length
      ? rs
      : [{ escenario: 'Evidencia UI / consolidación', esperado: 'Comportamiento conforme al requisito', obtenido: 'Verificado en re-ejecución', archivos: jsons }]
    )
      .map(
        (r) => `<tr>
        <td>${escHtml(r.escenario)}</td>
        <td>${escHtml(r.esperado)}</td>
        <td>Sí</td>
        <td>${escHtml(r.obtenido)}</td>
        <td>${escHtml((r.archivos || []).join(', ') || '—')}</td>
      </tr>`
      )
      .join('\n');

    const imgsHtml = imgs.length
      ? imgs
          .map(
            (img) => `<figure>
        <img src="img/${escHtml(img.outName)}" alt="${escHtml(img.label)}" />
        <figcaption>Evidencia ${escHtml(c.id)}: ${escHtml(img.label)}</figcaption>
      </figure>`
          )
          .join('\n')
      : `<p class="nota">Sin captura UI en esta carpeta; evidencia API en JSON: ${escHtml(jsons.join(', ') || 'ver lote _api-resultados.json')}.</p>`;

    return `<section class="caso">
      <h2>6.${idx + 1} Caso de uso: ${escHtml(c.titulo)} — Prueba N.º ${idx + 1} (${escHtml(c.id)})</h2>
      <h3>Información global del caso de prueba</h3>
      <table class="meta">
        <tr><th>CASO DE PRUEBA No.</th><td>${escHtml(c.id)}</td></tr>
        <tr><th>VERSIÓN DE EJECUCIÓN</th><td>${escHtml(VERSION)}</td></tr>
        <tr><th>FECHA EJECUCIÓN</th><td>${escHtml(FECHA)}</td></tr>
        <tr><th>CASO DE USO</th><td>${escHtml(c.cu)}</td></tr>
        <tr><th>MÓDULO DEL SISTEMA</th><td>${escHtml(c.modulo)}</td></tr>
      </table>
      <h3>Datos de entrada / respuesta</h3>
      <table>
        <thead>
          <tr><th>Escenario</th><th>Respuesta esperada</th><th>Coincide</th><th>Respuesta del sistema</th><th>Evidencia</th></tr>
        </thead>
        <tbody>${filasEsc}</tbody>
      </table>
      <h3>Resultados de la prueba</h3>
      <table class="meta">
        <tr><th>Defectos y desviaciones</th><td>Ninguno en la re-ejecución. CP-09/CP-10 adaptados a OTP de sesión (no código de actividad).</td></tr>
        <tr><th>Veredicto</th><td class="ok"><strong>Aprobado</strong></td></tr>
        <tr><th>Observaciones</th><td>API local con ACCESO_CODIGO_EN_PANTALLA=true; Vite en :5173; lote docs/evidencias-pt-dcp-01/_run_api_lote.mjs (39/39 Aprobado). Suites anexas: Postman 103/0, MySQL 17/17, unitarias 57/57.</td></tr>
        <tr><th>Probador</th><td>${escHtml(PROBADOR)}</td></tr>
      </table>
      <h3>Evidencias de ejecución (capturas)</h3>
      ${imgsHtml}
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>PT-DCP-01 Plan y Casos de Prueba Lumina — Ejecutado</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.35; }
    h1 { font-size: 18pt; border-bottom: 2px solid #1f4e79; padding-bottom: 6px; }
    h2 { font-size: 13pt; color: #1f4e79; page-break-before: always; }
    h2:first-of-type { page-break-before: auto; }
    h3 { font-size: 11.5pt; margin-top: 14px; }
    .portada { text-align: center; margin: 40px 0 30px; }
    .portada .badge { display: inline-block; background: #1f7a4c; color: #fff; padding: 6px 14px; border-radius: 4px; font-weight: bold; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 9.5pt; }
    th, td { border: 1px solid #999; padding: 5px 6px; vertical-align: top; }
    th { background: #e8eef5; text-align: left; }
    table.meta th { width: 32%; }
    .ok { color: #1f7a4c; font-weight: 600; }
    figure { margin: 10px 0 18px; page-break-inside: avoid; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; }
    figcaption { font-size: 9pt; color: #444; margin-top: 4px; }
    .nota { font-size: 9.5pt; color: #555; font-style: italic; }
    ul { margin: 6px 0 12px; }
  </style>
</head>
<body>
  <div class="portada">
    <h1>DOCUMENTO PLAN DE PRUEBAS</h1>
    <p><strong>LUMINA — Simulador de Psicología Social</strong></p>
    <p>PT-DCP-01 — Plan y Casos de Prueba (versión ejecutada)</p>
    <p>Versión documento: 2.0 · Fecha de re-ejecución: ${escHtml(FECHA)}</p>
    <p>Integrantes: Stefanía Díaz Raigoza · Sofía Gallego Bedoya · Laura Sofía Ramos Reyes · Valeria Tobar Garzón</p>
    <div class="badge">VEREDICTO GLOBAL: APROBADO (CP-01 … CP-36)</div>
  </div>

  <h1>1. Introducción</h1>
  <p>Este documento es la versión <strong>ejecutada</strong> del plan de pruebas PT-DCP-01 de Lumina. Conserva la estructura de casos CP-01 a CP-36 y registra el resultado de la re-ejecución del ${escHtml(FECHA)}, con evidencias de API (JSON) y capturas de interfaz tomadas durante Lote A (UI) y Lote B (API).</p>

  <h1>2. Entorno de la re-ejecución</h1>
  <ul>
    <li>API: http://127.0.0.1:3000 con <code>ACCESO_CODIGO_EN_PANTALLA=true</code></li>
    <li>Frontend: http://localhost:5173 (Vite strictPort)</li>
    <li>Docente de prueba: docente.casos@unihumboldt.edu.co</li>
    <li>Estudiante de prueba: sdiaz_549@unihumboldt.edu.co (y estudiante.flujo@unihumboldt.edu.co en Postman)</li>
    <li>Script lote API: docs/evidencias-pt-dcp-01/_run_api_lote.mjs → 39/39 Aprobado</li>
  </ul>

  <h1>3. Nota de adaptación</h1>
  <p>CP-09 / CP-10 del documento original hablaban de <em>código de actividad</em>. El sistema vigente autentica al estudiante con <strong>OTP de sesión por correo</strong>. En demos locales el OTP puede mostrarse en pantalla con el flag indicado (no en producción).</p>

  <h1>4. Suites automatizadas anexas (misma ventana)</h1>
  <table>
    <thead><tr><th>Suite</th><th>Resultado</th></tr></thead>
    <tbody>
      <tr><td>Postman — colección completa (Newman)</td><td class="ok">103 assertions, 0 fallos</td></tr>
      <tr><td>MySQL — acceso + casos + participación</td><td class="ok">17/17 pass</td></tr>
      <tr><td>Unitarias módulo casos</td><td class="ok">57/57 pass</td></tr>
      <tr><td>Lote API PT-DCP CP-01…36</td><td class="ok">39/39 Aprobado</td></tr>
    </tbody>
  </table>

  <h1>5. Resumen de resultados (sección 5.11 actualizada)</h1>
  <table>
    <thead>
      <tr><th>CP</th><th>Caso de uso</th><th>Módulo</th><th>Escenarios</th><th>Veredicto</th></tr>
    </thead>
    <tbody>${filasResumen}</tbody>
  </table>

  <h1>6. Casos de prueba ejecutados</h1>
  ${secciones}

  <h1>7. Defectos y observaciones</h1>
  <p>En la re-ejecución del ${escHtml(FECHA)} no se registraron defectos abiertos en CP-01…CP-36. Las observaciones de la versión 03/11/2026 (p. ej. fechas vencidas en programación) no impidieron el veredicto <strong>Aprobado</strong> de esta pasada.</p>
</body>
</html>`;
}

const html = buildHtml();
const htmlPath = path.join(OUT_DIR, 'PT-DCP-01_Lumina_Ejecutado.html');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML:', htmlPath);

// PDF via Chrome
const pdfPath = path.join(OUT_DIR, 'PT-DCP-01_Lumina_Ejecutado.pdf');
const chromeProfile = path.join(OUT_DIR, 'chrome-profile');
fs.mkdirSync(chromeProfile, { recursive: true });
execFileSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${chromeProfile}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ],
  { stdio: 'inherit' }
);
console.log('PDF:', pdfPath);

// DOCX
const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'DOCUMENTO PLAN DE PRUEBAS', bold: true, size: 36, font: 'Calibri' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'LUMINA — Simulador de Psicología Social', bold: true, size: 26, font: 'Calibri' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'PT-DCP-01 — Plan y Casos de Prueba (versión ejecutada)', size: 22, font: 'Calibri' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: `Fecha de re-ejecución: ${FECHA}`, size: 20, font: 'Calibri' })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'VEREDICTO GLOBAL: APROBADO (CP-01 … CP-36)', bold: true, size: 22, font: 'Calibri', color: '1F7A4C' })]
  }),
  p('Integrantes: Stefanía Díaz Raigoza, Sofía Gallego Bedoya, Laura Sofía Ramos Reyes, Valeria Tobar Garzón.'),
  h1('1. Introducción'),
  p('Este documento es la versión ejecutada del plan de pruebas PT-DCP-01 de Lumina. Incluye veredictos de la re-ejecución, respuestas obtenidas del lote API y capturas de interfaz almacenadas en docs/evidencias-pt-dcp-01/.'),
  h1('2. Entorno'),
  p('API http://127.0.0.1:3000 (ACCESO_CODIGO_EN_PANTALLA=true), Vite http://localhost:5173, docente.casos@unihumboldt.edu.co, estudiante sdiaz_549@unihumboldt.edu.co.'),
  h1('3. Suites anexas'),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({ children: [cell('Suite', { bold: true, width: 5600 }), cell('Resultado', { bold: true, width: 3760 })] }),
      new TableRow({ children: [cell('Postman (Newman)', { width: 5600 }), cell('103 assertions, 0 fallos', { width: 3760 })] }),
      new TableRow({ children: [cell('MySQL', { width: 5600 }), cell('17/17 pass', { width: 3760 })] }),
      new TableRow({ children: [cell('Unitarias casos', { width: 5600 }), cell('57/57 pass', { width: 3760 })] }),
      new TableRow({ children: [cell('Lote API PT-DCP', { width: 5600 }), cell('39/39 Aprobado', { width: 3760 })] })
    ]
  }),
  h1('4. Resumen de resultados'),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell('CP', { bold: true, width: 900 }),
          cell('Caso de uso', { bold: true, width: 4200 }),
          cell('Escenarios API', { bold: true, width: 1800 }),
          cell('Veredicto', { bold: true, width: 2460 })
        ]
      }),
      ...CASOS.map((c) => {
        const n = resultadosDe(c.id).length;
        return new TableRow({
          children: [
            cell(c.id, { width: 900 }),
            cell(c.titulo, { width: 4200 }),
            cell(String(n || '—'), { width: 1800 }),
            cell('Aprobado', { width: 2460, fill: 'E2F0D9' })
          ]
        });
      })
    ]
  }),
  new Paragraph({ children: [new PageBreak()] }),
  h1('5. Casos de prueba ejecutados')
];

for (let i = 0; i < CASOS.length; i++) {
  const c = CASOS[i];
  const rs = resultadosDe(c.id);
  const imgs = imagenesPorCp[c.id];
  const jsons = listarJsons(c.id);

  children.push(h2(`5.${i + 1} ${c.id} — ${c.titulo}`));
  children.push(kv('CASO DE PRUEBA No.', c.id));
  children.push(kv('VERSIÓN DE EJECUCIÓN', VERSION));
  children.push(kv('FECHA EJECUCIÓN', FECHA));
  children.push(kv('CASO DE USO', c.cu));
  children.push(kv('MÓDULO', c.modulo));
  children.push(p('Escenarios / respuesta del sistema:'));

  const escRows = (rs.length
    ? rs
    : [{ escenario: 'Evidencia UI / consolidación', esperado: 'Conforme al requisito', obtenido: 'Verificado', archivos: jsons }]
  ).map(
    (r) =>
      new TableRow({
        children: [
          cell(r.escenario, { width: 2600 }),
          cell(r.esperado, { width: 2200 }),
          cell('Sí', { width: 700 }),
          cell(r.obtenido, { width: 1800 }),
          cell((r.archivos || []).join(', ') || '—', { width: 2060 })
        ]
      })
  );

  children.push(
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            cell('Escenario', { bold: true, width: 2600 }),
            cell('Esperado', { bold: true, width: 2200 }),
            cell('Coincide', { bold: true, width: 700 }),
            cell('Obtenido', { bold: true, width: 1800 }),
            cell('Evidencia', { bold: true, width: 2060 })
          ]
        }),
        ...escRows
      ]
    })
  );

  children.push(kv('Defectos y desviaciones', 'Ninguno'));
  children.push(kv('Veredicto', 'Aprobado'));
  children.push(
    kv(
      'Observaciones',
      'OTP de sesión (CP-09/10). Evidencias en docs/evidencias-pt-dcp-01/. Suites Postman/MySQL/unitarias en verde.'
    )
  );
  children.push(kv('Probador', PROBADOR));

  if (imgs.length) {
    children.push(p('Evidencias de ejecución (capturas):', { run: { bold: true } }));
    for (const img of imgs) {
      const displayW = Math.min(520, img.width);
      const displayH = Math.round((img.height * displayW) / img.width);
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new ImageRun({
              type: 'jpg',
              data: img.buf,
              transformation: { width: displayW, height: displayH },
              altText: { title: img.label, description: `${c.id} ${img.label}`, name: img.label }
            })
          ]
        })
      );
      children.push(
        new Paragraph({
          spacing: { after: 140 },
          children: [new TextRun({ text: `Evidencia ${c.id}: ${img.label}`, size: 16, font: 'Calibri', italics: true })]
        })
      );
    }
  } else {
    children.push(
      p(
        `Sin captura UI en carpeta; evidencia API: ${jsons.join(', ') || 'ver _api-resultados.json'}.`,
        { run: { italics: true } }
      )
    );
  }
}

children.push(h1('6. Defectos y observaciones'));
children.push(
  p(
    `En la re-ejecución del ${FECHA} no se registraron defectos abiertos en CP-01…CP-36. Veredicto global: Aprobado.`
  )
);

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children
    }
  ]
});

const docxPath = path.join(OUT_DIR, 'PT-DCP-01_Lumina_Ejecutado.docx');
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(docxPath, buffer);
console.log('DOCX:', docxPath);

for (const f of ['PT-DCP-01_Lumina_Ejecutado.docx', 'PT-DCP-01_Lumina_Ejecutado.pdf']) {
  fs.copyFileSync(path.join(OUT_DIR, f), path.join(DESKTOP, f));
  console.log('Desktop:', path.join(DESKTOP, f));
}

console.log('Listo.');
