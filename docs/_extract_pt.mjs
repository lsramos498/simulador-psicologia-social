import { mkdirSync, readFileSync, writeFileSync, createReadStream } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createUnzip } from 'zlib';
import { execFileSync } from 'child_process';
import path from 'path';

const docx = 'C:\\Users\\sdiaz\\Downloads\\PT-DCP-01_Plan_y_Casos_de_Prueba_Lumina.docx';
const outDir = path.resolve('docs/_pt_extract');
mkdirSync(outDir, { recursive: true });

// Copy as zip and expand with tar (Windows 10+)
const zipCopy = path.join(outDir, 'pt.zip');
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Copy-Item -LiteralPath '${docx}' -Destination '${zipCopy}' -Force; if (Test-Path '${outDir}\\docx') { Remove-Item -Recurse -Force '${outDir}\\docx' }; Expand-Archive -LiteralPath '${zipCopy}' -DestinationPath '${outDir}\\docx' -Force`
], { stdio: 'inherit' });

const xml = readFileSync(path.join(outDir, 'docx', 'word', 'document.xml'), 'utf8');
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'"));

// Rebuild paragraphs roughly by splitting on paragraph ends
const paras = xml
  .split(/<\/w:p>/)
  .map((chunk) => {
    const parts = [...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) =>
      m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    );
    return parts.join('').trim();
  })
  .filter(Boolean);

writeFileSync(path.join(outDir, 'plan.txt'), paras.join('\n'), 'utf8');
console.log('PARAS', paras.length);
console.log(paras.slice(0, 120).join('\n'));
