import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CID_PORTADA = 'lumina-portada';

/** Portada del login (biblioteca) embebida en el correo vía CID. */
export function resolverAdjuntoPortada() {
  const candidatos = [
    path.resolve(__dirname, '../../../../frontend/public/login-bg-libreria.jpg'),
    path.resolve(process.cwd(), 'frontend/public/login-bg-libreria.jpg'),
    path.resolve(process.cwd(), '../frontend/public/login-bg-libreria.jpg')
  ];

  for (const archivo of candidatos) {
    if (fs.existsSync(archivo)) {
      return {
        filename: 'lumina-portada.jpg',
        path: archivo,
        cid: CID_PORTADA,
        contentDisposition: 'inline'
      };
    }
  }

  return null;
}

function bloquePortada(tieneImagen) {
  if (tieneImagen) {
    return `
      <tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <img
            src="cid:${CID_PORTADA}"
            alt="Lumina — biblioteca"
            width="560"
            style="display:block;width:100%;max-width:560px;height:auto;border:0;"
          />
        </td>
      </tr>`;
  }

  // Fallback sin imagen: franja con la misma atmósfera del login.
  return `
    <tr>
      <td style="padding:36px 28px 28px;background:linear-gradient(160deg,#1a1428 0%,#2a1c14 45%,#3d2818 100%);text-align:center;">
        <div style="font-size:42px;line-height:1;">🔍</div>
        <div style="margin-top:10px;font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:0.06em;color:#f3d27a;font-weight:700;">
          LUMINA
        </div>
        <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,236,200,0.72);">
          Simulador de psicología social
        </div>
      </td>
    </tr>`;
}

/**
 * Sobre HTML table-based (clientes de correo).
 * Paleta alineada al login: navy/violeta, oro #f3d27a, ámbar fuego.
 */
export function envolverCorreoLumina({
  tituloHero,
  kicker = '✨ Convocatoria académica',
  cuerpoHtml,
  pieHtml,
  ctaUrl,
  ctaTexto = 'Entrar a Lumina',
  conPortada = true
}) {
  const adjunto = conPortada ? resolverAdjuntoPortada() : null;
  const portada = bloquePortada(Boolean(adjunto));

  const boton = ctaUrl
    ? `
      <tr>
        <td style="padding:8px 28px 28px;text-align:center;">
          <a href="${ctaUrl}"
             style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(180deg,#f3d27a,#c9a24a);color:#2a1c14;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 8px 20px rgba(0,0,0,0.35);">
            ${ctaTexto} →
          </a>
        </td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lumina</title>
</head>
<body style="margin:0;padding:0;background:#0f0c18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0c18;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#161222;border-radius:18px;overflow:hidden;border:1px solid rgba(243,210,122,0.28);box-shadow:0 24px 60px rgba(0,0,0,0.45);">
          ${portada}
          <tr>
            <td style="padding:22px 28px 6px;background:#161222;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,236,200,0.65);">
                ${kicker}
              </div>
              <h1 style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#fff8e8;font-weight:700;">
                ${tituloHero}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#e8dcc8;">
              ${cuerpoHtml}
            </td>
          </tr>
          ${boton}
          <tr>
            <td style="padding:8px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:rgba(255,236,200,0.55);border-top:1px solid rgba(243,210,122,0.18);">
              ${pieHtml}
            </td>
          </tr>
        </table>
        <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,236,200,0.4);">
          Lumina · Universidad
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    attachments: adjunto ? [adjunto] : []
  };
}

export { CID_PORTADA };
