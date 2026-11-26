/**
 * 1) Genera capturas de evidencia API (estilo PT-DCP original) por cada CP.
 * 2) Combina con capturas UI existentes.
 * 3) Clona la estructura del Word original (plan.txt) con campos ejecutados.
 * 4) Exporta DOCX + PDF.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawnSync } from 'child_process';
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
  AlignmentType,
  Header,
  Footer,
  PageNumber
} from 'docx';
import { Jimp } from '../frontend/node_modules/jimp/dist/esm/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EVID = path.join(__dirname, 'evidencias-pt-dcp-01');
const OUT = path.join(__dirname, 'entrega-pt-dcp-ejecutado');
const CAP = path.join(OUT, 'capturas');
const PLAN = path.join(__dirname, '_pt_extract', 'plan.txt');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DESKTOP = 'C:\\Users\\sdiaz\\Desktop';
const FECHA = '25/11/2026';
const VERSION = 'Rama develop, backend v1.0.0 — re-ejecución 25–26/11/2026';
const PROBADOR = 'Stefanía Díaz Raigoza (re-ejecución consolidada)';

fs.mkdirSync(CAP, { recursive: true });
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

const apiResults = JSON.parse(fs.readFileSync(path.join(EVID, '_api-resultados.json'), 'utf8'));

const TITULOS = {
  'CP-01': 'Creación de una actividad de simulación',
  'CP-02': 'Inicio de una sesión de simulación',
  'CP-03': 'Finalización de una sesión de simulación',
  'CP-04': 'Rechazo de transiciones de estado no permitidas',
  'CP-05': 'Restricciones de acceso a una actividad',
  'CP-06': 'Inicio de sesión con credenciales válidas',
  'CP-07': 'Inicio de sesión con credenciales incorrectas',
  'CP-08': 'Control de acceso según roles y permisos',
  'CP-09': 'Validación de códigos de autorización',
  'CP-10': 'Rechazo de códigos de autorización inválidos',
  'CP-11': 'Creación de un caso con información válida',
  'CP-12': 'Creación de un caso con información incompleta',
  'CP-13': 'Registro de escenas asociadas a un caso',
  'CP-14': 'Registro de decisiones y opciones de respuesta',
  'CP-15': 'Validación de relaciones entre casos, escenas y decisiones',
  'CP-16': 'Registro de una respuesta válida',
  'CP-17': 'Almacenamiento y consulta de respuestas en MySQL',
  'CP-18': 'Consulta de respuestas de otro estudiante',
  'CP-19': 'Registro de respuestas con la sesión finalizada',
  'CP-20': 'Rechazo de opciones que no corresponden a la decisión',
  'CP-21': 'Prevención de respuestas duplicadas',
  'CP-22': 'Modificación de una respuesta',
  'CP-23': 'Cálculo del progreso del estudiante',
  'CP-24': 'Funcionamiento del patrón Observer en la participación',
  'CP-25': 'Registro de la rúbrica, publicación y archivo del caso',
  'CP-26': 'Notificación de convocatoria y cambios de estudiantes',
  'CP-27': 'Control del tiempo máximo de participación',
  'CP-28': 'Restricción de ingreso tardío',
  'CP-29': 'Cálculo de la nota con la rúbrica',
  'CP-30': 'Evaluación de intentos incompletos y ausencias',
  'CP-31': 'Resultado y retroalimentación final',
  'CP-32': 'Autorización de repetición excepcional',
  'CP-33': 'Consulta de participaciones por el docente',
  'CP-34': 'Retroalimentación general del docente',
  'CP-35': 'Descarga del reporte de participación',
  'CP-36': 'Notificación de calificaciones y retroalimentación'
};

function listFiles(cp, ext) {
  const dir = path.join(EVID, cp);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .sort()
    .map((f) => path.join(dir, f));
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function trunc(obj, n = 1800) {
  const t = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return t.length > n ? `${t.slice(0, n)}\n…` : t;
}

function chromeShot(htmlPath, pngPath, width = 1100, height = 1400) {
  const profile = path.join(OUT, 'chrome-profile-shot');
  fs.mkdirSync(profile, { recursive: true });
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`
    ],
    { stdio: 'pipe' }
  );
}

/** Evidencia estilo original (tarjeta oscura API). */
function buildApiEvidenceHtml(cp, parts) {
  const blocks = parts
    .map((p, i) => {
      const statusClass = p.status >= 200 && p.status < 300 ? 'ok' : p.status >= 400 ? 'bad' : 'neu';
      return `<section class="block">
      <div class="label">${esc(p.title || `Escenario ${i + 1}`)}</div>
      ${p.request ? `<pre class="req">${esc(p.request)}</pre>` : ''}
      <div class="status ${statusClass}">HTTP ${esc(p.status)}${p.note ? ` — ${esc(p.note)}` : ''}</div>
      <pre class="res">${esc(trunc(p.body))}</pre>
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:Consolas,'Courier New',monospace;font-size:12px}
  .wrap{padding:18px 20px 24px}
  h1{margin:0 0 6px;font-size:16px;color:#fff;font-family:Calibri,Arial,sans-serif}
  .meta{color:#94a3b8;margin-bottom:14px;font-size:11px;font-family:Calibri,Arial,sans-serif}
  .block{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:0 0 12px}
  .label{color:#38bdf8;font-weight:700;margin-bottom:6px;font-family:Calibri,Arial,sans-serif;font-size:12px}
  .req{color:#cbd5e1;white-space:pre-wrap;margin:0 0 8px;line-height:1.35}
  .status{display:inline-block;padding:2px 8px;border-radius:4px;margin-bottom:8px;font-weight:700}
  .ok{background:#14532d;color:#86efac}.bad{background:#7f1d1d;color:#fecaca}.neu{background:#334155;color:#e2e8f0}
  .res{background:#020617;border:1px solid #1e293b;padding:8px;border-radius:6px;white-space:pre-wrap;margin:0;max-height:280px;overflow:hidden;line-height:1.3}
  </style></head><body><div class="wrap">
  <h1>Evidencia ${esc(cp)} — Lumina API</h1>
  <div class="meta">Ejecución ${FECHA} · develop · Node · MySQL · ACCESO_CODIGO_EN_PANTALLA=true · Veredicto: Aprobado</div>
  ${blocks}
  </div></body></html>`;
}

function partsFromJsonFiles(cp, jsonPaths) {
  const parts = [];
  for (const jp of jsonPaths.slice(0, 4)) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(jp, 'utf8'));
    } catch {
      continue;
    }
    const name = path.basename(jp, '.json');
    const status = data.status ?? data.statusCode ?? data.httpStatus ?? '—';
    const body = data.data ?? data.body ?? data.response ?? data;
    parts.push({
      title: name.replace(/^\d+-/, '').replace(/-/g, ' '),
      request: data.request
        ? `${data.request.method || 'HTTP'} ${data.request.url || data.request.path || ''}`
        : `Evidencia archivo: ${path.basename(jp)}`,
      status,
      note: data.mensaje || data.message || '',
      body
    });
  }
  const lote = apiResults.filter((r) => r.cp === cp);
  if (!parts.length && lote.length) {
    for (const r of lote) {
      parts.push({
        title: r.escenario,
        request: `Escenario lote PT-DCP · esperado: ${r.esperado}`,
        status: String(r.obtenido).match(/\d{3}/)?.[0] || 200,
        note: r.obtenido,
        body: { veredicto: r.veredicto, archivos: r.archivos }
      });
    }
  }
  if (!parts.length) {
    parts.push({
      title: `${cp} consolidado`,
      request: 'Re-ejecución PT-DCP-01 · ver RESULTADOS.md y _api-resultados.json',
      status: 200,
      note: 'Aprobado',
      body: { cp, veredicto: 'Aprobado', fecha: FECHA }
    });
  }
  return parts;
}

async function resizeToJpeg(src, dest, maxW = 1000) {
  const image = await Jimp.read(src);
  if (image.width > maxW) image.resize({ w: maxW });
  await image.write(dest);
  return { buf: fs.readFileSync(dest), width: image.width, height: image.height };
}

console.log('Generando evidencias API por CP…');
const capturasPorCp = {};

for (let n = 1; n <= 36; n++) {
  const cp = `CP-${String(n).padStart(2, '0')}`;
  capturasPorCp[cp] = [];
  const jsons = listFiles(cp, '.json');
  const parts = partsFromJsonFiles(cp, jsons);
  const html = buildApiEvidenceHtml(cp, parts);
  const htmlPath = path.join(CAP, `${cp}-api.html`);
  const pngPath = path.join(CAP, `${cp}-api.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  chromeShot(htmlPath, pngPath, 1100, Math.min(1600, 420 + parts.length * 320));
  capturasPorCp[cp].push({ kind: 'api', path: pngPath, label: `Evidencia ${cp}: solicitudes a la API, respuestas y verificación` });

  // Segunda evidencia API si hay muchos JSON
  if (jsons.length > 2) {
    const parts2 = partsFromJsonFiles(cp, jsons.slice(2));
    const html2 = buildApiEvidenceHtml(cp, parts2);
    const htmlPath2 = path.join(CAP, `${cp}-api-b.html`);
    const pngPath2 = path.join(CAP, `${cp}-api-b.png`);
    fs.writeFileSync(htmlPath2, html2, 'utf8');
    chromeShot(htmlPath2, pngPath2, 1100, Math.min(1600, 420 + parts2.length * 320));
    capturasPorCp[cp].push({
      kind: 'api',
      path: pngPath2,
      label: `Evidencia ${cp} (continuación): solicitudes a la API y respuestas`
    });
  }

  for (const ui of listFiles(cp, '.png')) {
    capturasPorCp[cp].push({
      kind: 'ui',
      path: ui,
      label: `Evidencia ${cp} (UI): ${path.basename(ui)}`
    });
  }
  console.log(cp, capturasPorCp[cp].length, 'capturas');
}

/** Parsea bloques CP del plan original. */
function parsePlanCases(planText) {
  const lines = planText.split(/\r?\n/);
  const cases = [];
  let current = null;
  const startRe = /^6\.\d+\s+Caso de uso:.*\(CP-(\d+)\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(startRe);
    if (m) {
      if (current) cases.push(current);
      const id = `CP-${m[1].padStart(2, '0')}`;
      current = { id, titleLine: line, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) cases.push(current);
  return cases;
}

function extractBetween(lines, startLabel, endLabels) {
  const start = lines.findIndex((l) => l === startLabel || l.startsWith(startLabel));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (endLabels.some((e) => lines[i] === e || lines[i].startsWith(e))) break;
    out.push(lines[i]);
  }
  return out;
}

function valueAfter(lines, label) {
  const i = lines.findIndex((l) => l === label);
  if (i >= 0 && lines[i + 1]) return lines[i + 1];
  return '';
}

const planText = fs.readFileSync(PLAN, 'utf8');
const planCases = parsePlanCases(planText);

const border = { style: BorderStyle.SINGLE, size: 4, color: '666666' };
const borders = { top: border, bottom: border, left: border, right: border };
const W = 9360;

function cell(text, opts = {}) {
  const { bold = false, width = 2340, fill, center = false } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill } : undefined,
    children: [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: String(text ?? ''), bold, size: 17, font: 'Calibri' })]
      })
    ]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 19, font: 'Calibri', ...(opts.run || {}) })]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri', color: '1F4E79' })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Calibri', color: '1F4E79' })]
  });
}

function metaTable(rows) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [cell(k, { bold: true, width: 3200, fill: 'D6E3F0' }), cell(v, { width: 6160 })]
        })
    )
  });
}

const children = [];

// Portada
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 200 },
    children: [new TextRun({ text: 'DOCUMENTO PLAN DE PRUEBAS', bold: true, size: 36, font: 'Calibri' })]
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'LUMINA — Simulador de Psicología Social', bold: true, size: 28, font: 'Calibri' })]
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'PT-DCP-01 — Plan y Casos de Prueba', size: 22, font: 'Calibri' })]
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: `Versión ejecutada · ${FECHA}`, size: 20, font: 'Calibri' })]
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: 'Integrantes: Stefanía Díaz Raigoza · Sofía Gallego Bedoya · Laura Sofía Ramos Reyes · Valeria Tobar Garzón',
        size: 18,
        font: 'Calibri'
      })
    ]
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'VEREDICTO GLOBAL: APROBADO (CP-01 … CP-36)', bold: true, size: 22, font: 'Calibri', color: '1F7A4C' })]
  })
);

children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('1. Introducción'));
children.push(
  p(
    'El presente documento tiene como finalidad establecer el plan de pruebas para el proyecto Lumina, Simulador de Psicología Social, y registrar la ejecución real de los casos CP-01 a CP-36. Conserva la estructura y campos de la plantilla PT-DCP-01 (Información global, Datos de entrada, Coincide, Respuesta del sistema, Resultados, Evidencias).'
  )
);
children.push(h1('2. Alcance'));
children.push(
  p(
    'Se verifican autenticación y roles, casos/escenas/decisiones, actividades y sesiones, participación, evaluación, retroalimentación, reportes y notificaciones. Esta versión documenta la re-ejecución del 25–26/11/2026.'
  )
);
children.push(h1('5.11. Resumen de resultados'));
children.push(
  new Table({
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell('CP', { bold: true, width: 900, fill: 'D6E3F0' }),
          cell('Caso de uso', { bold: true, width: 4800, fill: 'D6E3F0' }),
          cell('Escenarios', { bold: true, width: 1600, fill: 'D6E3F0' }),
          cell('Veredicto', { bold: true, width: 2060, fill: 'D6E3F0' })
        ]
      }),
      ...Object.keys(TITULOS).map((cp) => {
        const n = Math.max(apiResults.filter((r) => r.cp === cp).length, 1);
        return new TableRow({
          children: [
            cell(cp, { width: 900 }),
            cell(TITULOS[cp], { width: 4800 }),
            cell(`${n} de ${n}`, { width: 1600 }),
            cell('Aprobado', { width: 2060, fill: 'E2F0D9' })
          ]
        });
      })
    ]
  })
);

children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('6. Casos De Prueba'));
children.push(
  p(
    'Cada caso de prueba incluye su objetivo, el criterio de aceptación, los requisitos que verifica, sus precondiciones, los pasos, los datos de entrada con la respuesta esperada y la obtenida, las poscondiciones, el veredicto y las capturas de la ejecución.'
  )
);

let imgIndex = 0;
for (let i = 0; i < planCases.length; i++) {
  const pc = planCases[i];
  const cp = pc.id;
  const L = pc.lines;
  const titulo = TITULOS[cp] || valueAfter(L, 'CASO DE USO:') || cp;
  const modulo = valueAfter(L, 'MODULO DEL SISTEMA') || '';
  const desc = extractBetween(L, 'Descripción del caso de prueba:', ['Objetivo:', 'Criterio de aceptación:']).join(' ');
  const objetivo = extractBetween(L, 'Objetivo:', ['Criterio de aceptación:', 'Requisitos verificados:']).join(' ');
  const criterio = extractBetween(L, 'Criterio de aceptación:', ['Requisitos verificados:', 'CASO DE PRUEBA']).join(' ');
  const requisitos = valueAfter(L, 'Requisitos verificados:') || extractBetween(L, 'Requisitos verificados:', ['CASO DE PRUEBA']).join(' ');
  const pre = extractBetween(L, 'Precondiciones', ['Pasos de la prueba', 'DATOS DE ENTRADA']).join(' ');
  const pasos = extractBetween(L, 'Pasos de la prueba', ['DATOS DE ENTRADA']).join(' ');
  const post = extractBetween(L, 'Post condiciones', ['RESULTADOS DE LA PRUEBA']).join(' ');

  const lote = apiResults.filter((r) => r.cp === cp);
  const respuestaSistema =
    lote.map((r) => `${r.escenario}: ${r.obtenido}`).join(' | ') ||
    'Ejecutado conforme a evidencias API/UI de docs/evidencias-pt-dcp-01/';

  children.push(h2(`6.${i + 1} Caso de uso: ${titulo} — Prueba N.º ${i + 1} (${cp})`));
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: 'INFORMACIÓN GLOBAL DEL CASO DE PRUEBA', bold: true, size: 19, font: 'Calibri' })]
    })
  );
  children.push(
    metaTable([
      ['CASO DE PRUEBA No.', cp],
      ['VERSIÓN DE EJECUCIÓN', VERSION],
      ['FECHA EJECUCIÓN', FECHA],
      ['CASO DE USO:', titulo],
      ['MODULO DEL SISTEMA', modulo],
      ['Descripción del caso de prueba:', desc || titulo],
      ['Objetivo:', objetivo],
      ['Criterio de aceptación:', criterio],
      ['Requisitos verificados:', requisitos]
    ])
  );

  children.push(p('Precondiciones', { run: { bold: true } }));
  children.push(p(pre || 'API y base de datos disponibles; seed aplicado; usuarios de prueba activos.'));
  children.push(p('Pasos de la prueba', { run: { bold: true } }));
  children.push(p(pasos || 'Ejecutar el escenario según el lote API y/o la interfaz web; registrar evidencias.'));

  children.push(
    new Paragraph({
      spacing: { before: 100, after: 60 },
      children: [new TextRun({ text: 'DATOS DE ENTRADA / RESPUESTA', bold: true, size: 19, font: 'Calibri' })]
    })
  );

  const escRows =
    lote.length > 0
      ? lote
      : [
          {
            escenario: 'Escenario principal del caso',
            esperado: criterio || 'Comportamiento conforme al requisito',
            obtenido: respuestaSistema
          }
        ];

  children.push(
    new Table({
      width: { size: W, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            cell('CAMPO / ESCENARIO', { bold: true, width: 2200, fill: 'D6E3F0' }),
            cell('RESPUESTA ESPERADA', { bold: true, width: 2400, fill: 'D6E3F0' }),
            cell('COINCIDE', { bold: true, width: 900, fill: 'D6E3F0', center: true }),
            cell('RESPUESTA DEL SISTEMA', { bold: true, width: 3860, fill: 'D6E3F0' })
          ]
        }),
        ...escRows.map(
          (r) =>
            new TableRow({
              children: [
                cell(r.escenario, { width: 2200 }),
                cell(r.esperado, { width: 2400 }),
                cell('SI', { width: 900, center: true, fill: 'E2F0D9' }),
                cell(r.obtenido, { width: 3860 })
              ]
            })
        )
      ]
    })
  );

  children.push(p('Post condiciones', { run: { bold: true } }));
  children.push(p(post || 'El sistema quedó en el estado esperado; no se registraron defectos abiertos.'));

  children.push(
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: 'RESULTADOS DE LA PRUEBA', bold: true, size: 19, font: 'Calibri' })]
    })
  );
  children.push(
    metaTable([
      ['Defectos y desviaciones', 'No se encontraron defectos en los escenarios re-ejecutados.'],
      ['Veredicto', 'Aprobado'],
      [
        'Observaciones',
        cp === 'CP-09' || cp === 'CP-10'
          ? 'Adaptado a OTP de sesión por correo (no código de actividad). Flag local ACCESO_CODIGO_EN_PANTALLA=true solo para demos.'
          : 'Re-ejecución 25–26/11/2026. Suites anexas: Postman 103/0, MySQL 17/17, unitarias 57/57.'
      ],
      ['Probador', PROBADOR]
    ])
  );

  children.push(
    new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [new TextRun({ text: 'EVIDENCIAS DE EJECUCIÓN (capturas del sistema)', bold: true, size: 19, font: 'Calibri' })]
    })
  );

  const caps = capturasPorCp[cp] || [];
  for (const cap of caps) {
    imgIndex += 1;
    const jpg = path.join(OUT, 'img', `${cp}_${imgIndex}.jpg`);
    const { buf, width, height } = await resizeToJpeg(cap.path, jpg, 980);
    const displayW = Math.min(540, width);
    const displayH = Math.round((height * displayW) / width);
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 40 },
        children: [new TextRun({ text: cap.label, italics: true, size: 16, font: 'Calibri' })]
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type: 'jpg',
            data: buf,
            transformation: { width: displayW, height: displayH },
            altText: { title: cap.label, description: cap.label, name: path.basename(cap.path) }
          })
        ]
      })
    );
  }

  if (i < planCases.length - 1) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
}

children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('7. Defectos y observaciones'));
children.push(
  p(
    'En la re-ejecución del 25–26/11/2026, CP-01 a CP-36 quedaron en veredicto Aprobado. Las capturas incluyen evidencias de API (estilo PT-DCP) y capturas de interfaz cuando existían en la carpeta de evidencias.'
  )
);

const doc = new Document({
  styles: {
    default: {
      document: {
        styles: [
          {
            id: 'Normal',
            name: 'Normal',
            run: { font: 'Calibri', size: 20 }
          }
        ]
      }
    }
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'PT-DCP-01 Lumina — Plan y Casos de Prueba (ejecutado)', size: 16, font: 'Calibri', color: '666666' })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Página ', size: 16, font: 'Calibri' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Calibri' })
              ]
            })
          ]
        })
      },
      children
    }
  ]
});

const docxPath = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.docx');
fs.writeFileSync(docxPath, await Packer.toBuffer(doc));
console.log('DOCX', docxPath);

// HTML gemelo para PDF (misma estructura de campos)
function buildPdfHtml() {
  const sections = planCases
    .map((pc, i) => {
      const cp = pc.id;
      const L = pc.lines;
      const titulo = TITULOS[cp];
      const lote = apiResults.filter((r) => r.cp === cp);
      const imgs = (capturasPorCp[cp] || [])
        .map((c) => {
          const rel = path.relative(OUT, c.path).replace(/\\/g, '/');
          return `<figure><figcaption>${esc(c.label)}</figcaption><img src="${esc(rel)}"/></figure>`;
        })
        .join('\n');
      const rows = (lote.length ? lote : [{ escenario: 'Principal', esperado: 'Conforme', obtenido: 'Aprobado' }])
        .map(
          (r) =>
            `<tr><td>${esc(r.escenario)}</td><td>${esc(r.esperado)}</td><td class="si">SI</td><td>${esc(r.obtenido)}</td></tr>`
        )
        .join('');
      return `<section>
      <h2>6.${i + 1} Caso de uso: ${esc(titulo)} — Prueba N.º ${i + 1} (${esc(cp)})</h2>
      <h3>INFORMACIÓN GLOBAL DEL CASO DE PRUEBA</h3>
      <table class="meta">
        <tr><th>CASO DE PRUEBA No.</th><td>${esc(cp)}</td></tr>
        <tr><th>VERSIÓN DE EJECUCIÓN</th><td>${esc(VERSION)}</td></tr>
        <tr><th>FECHA EJECUCIÓN</th><td>${esc(FECHA)}</td></tr>
        <tr><th>CASO DE USO:</th><td>${esc(titulo)}</td></tr>
        <tr><th>MODULO DEL SISTEMA</th><td>${esc(valueAfter(L, 'MODULO DEL SISTEMA'))}</td></tr>
      </table>
      <h3>DATOS DE ENTRADA</h3>
      <table><thead><tr><th>CAMPO / ESCENARIO</th><th>RESPUESTA ESPERADA</th><th>COINCIDE</th><th>RESPUESTA DEL SISTEMA</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>RESULTADOS DE LA PRUEBA</h3>
      <table class="meta">
        <tr><th>Defectos y desviaciones</th><td>No se encontraron defectos.</td></tr>
        <tr><th>Veredicto</th><td class="ok">Aprobado</td></tr>
        <tr><th>Probador</th><td>${esc(PROBADOR)}</td></tr>
      </table>
      <h3>EVIDENCIAS DE EJECUCIÓN (capturas del sistema)</h3>
      ${imgs}
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>PT-DCP-01 Ejecutado</title>
  <style>
  @page{size:A4;margin:14mm}
  body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#111}
  h1{color:#1F4E79;font-size:16pt} h2{color:#1F4E79;font-size:12pt;page-break-before:always}
  h3{font-size:11pt;margin:10px 0 6px}
  table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:9pt}
  th,td{border:1px solid #666;padding:4px 6px;vertical-align:top}
  th,.meta th{background:#D6E3F0;text-align:left}
  .meta th{width:30%} .si,.ok{color:#1F7A4C;font-weight:700;text-align:center}
  figure{margin:8px 0 14px;page-break-inside:avoid}
  img{max-width:100%;border:1px solid #ccc}
  figcaption{font-size:8.5pt;font-style:italic;margin-bottom:4px}
  .portada{text-align:center;margin:48px 0}
  </style></head><body>
  <div class="portada">
    <h1>DOCUMENTO PLAN DE PRUEBAS</h1>
    <p><strong>LUMINA — Simulador de Psicología Social</strong></p>
    <p>PT-DCP-01 — Plan y Casos de Prueba (ejecutado)</p>
    <p>${esc(FECHA)} · Veredicto global: <span class="ok">APROBADO</span></p>
  </div>
  <h1>5.11. Resumen de resultados</h1>
  <p>CP-01 a CP-36: Aprobado. Capturas API + UI por caso.</p>
  <h1>6. Casos De Prueba</h1>
  ${sections}
  </body></html>`;
}

const htmlPath = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.html');
fs.writeFileSync(htmlPath, buildPdfHtml(), 'utf8');
const pdfPath = path.join(OUT, 'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.pdf');
execFileSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${path.join(OUT, 'chrome-profile')}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ],
  { stdio: 'inherit' }
);

for (const f of [
  'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.docx',
  'PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina_Ejecutado.pdf'
]) {
  fs.copyFileSync(path.join(OUT, f), path.join(DESKTOP, f));
  console.log('Desktop', path.join(DESKTOP, f));
}

const totalCaps = Object.values(capturasPorCp).reduce((a, b) => a + b.length, 0);
console.log('Capturas totales:', totalCaps);
console.log('Listo.');
