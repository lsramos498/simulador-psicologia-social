/**
 * Smoke test rápido del sistema Lumina (docente + flujos clave).
 * Uso: node scripts/smoke-sistema.mjs
 */
const API = process.env.API_BASE || 'http://127.0.0.1:3000';

async function pedir(ruta, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await res.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = { raw: texto };
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status} ${ruta}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function ok(nombre) {
  console.log(`✔ ${nombre}`);
}

function fail(nombre, err) {
  console.error(`✖ ${nombre}: ${err.message || err}`);
}

async function main() {
  const resultados = { ok: 0, fail: 0 };

  async function check(nombre, fn) {
    try {
      await fn();
      ok(nombre);
      resultados.ok += 1;
    } catch (err) {
      fail(nombre, err);
      resultados.fail += 1;
    }
  }

  let token;
  let docenteId;

  await check('API viva (acceso ingreso responde)', async () => {
    const res = await fetch(`${API}/api/acceso/ingreso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'x', contrasena: 'y' })
    });
    if (res.status === 404) throw new Error('Ruta de ingreso no encontrada');
  });

  await check('Login docente', async () => {
    const data = await pedir('/api/acceso/ingreso', {
      method: 'POST',
      body: {
        correo: 'docente.casos@unihumboldt.edu.co',
        contrasena: 'Docente1234'
      }
    });
    token = data.token;
    docenteId = data.usuario?.id;
    if (!token) throw new Error('Sin token');
  });

  await check('Listar casos', async () => {
    const data = await pedir('/api/casos', { token });
    if (!Array.isArray(data.data)) throw new Error('Listado inválido');
  });

  await check('Listar actividades con autorizados', async () => {
    const data = await pedir('/api/actividades', { token });
    if (!Array.isArray(data.data)) throw new Error('Listado inválido');
  });

  await check('Listar espacios', async () => {
    const data = await pedir('/api/espacios', { token });
    if (!Array.isArray(data.data)) throw new Error('Listado inválido');
  });

  let casoImportadoId;
  await check('Importar caso desde texto', async () => {
    const texto = `
Título: Smoke test — mediación en sala de espera
Desarrollo situacional: Dos familias discuten en la sala de espera de un centro de salud. Hay tensión por turnos y privacidad.
Contexto: Práctica de psicología social. El estudiante debe contener y orientar.
Personajes: Camila, Mateo, Laura
Escena 1: Sala de espera
En la sala hay ruido y familias mirando. Camila y Mateo elevan la voz.
Pregunta: ¿Cuál es tu primera intervención?
Escena 2: Pasillo de orientación
Ya bajó un poco la tensión. Hay que cerrar con un acuerdo claro.
Pregunta: ¿Cómo cierras la intervención?
`.trim();
    const data = await pedir('/api/casos/importar-texto', {
      method: 'POST',
      token,
      body: { texto, publicar: false }
    });
    casoImportadoId = data.data?.id;
    if (!casoImportadoId) throw new Error('No devolvió id de caso');
    if (!(data.data?.escenas?.length >= 1)) throw new Error('Sin escenas');
  });

  await check('Consultar caso importado', async () => {
    const data = await pedir(`/api/casos/${casoImportadoId}`, { token });
    if (Number(data.data?.id) !== Number(casoImportadoId)) {
      throw new Error('Caso no coincide');
    }
  });

  await check('Listar grupos', async () => {
    const data = await pedir('/api/grupos', { token });
    if (!Array.isArray(data.data)) throw new Error('Listado inválido');
  });

  // Si hay sesión finalizada del docente, probar respuestas (puede no existir)
  await check('Participación: acceso docente a respuestas (si hay sesión)', async () => {
    const acts = await pedir('/api/actividades', { token });
    const act = (acts.data || [])[0];
    if (!act) {
      console.log('  (sin actividades; se omite monitor)');
      return;
    }
    const mon = await pedir(`/api/sesiones/actividades/${act.id}/monitor`, { token });
    const ses = (mon.data || []).find((s) => s.estado === 'Finalizado') || (mon.data || [])[0];
    if (!ses) {
      console.log('  (sin sesiones; se omite)');
      return;
    }
    const resp = await pedir(`/api/participacion/sesiones/${ses.id}/respuestas`, { token });
    if (!Array.isArray(resp.data)) throw new Error('Respuestas inválidas');
  });

  console.log('\n---');
  console.log(`Smoke: ${resultados.ok} ok · ${resultados.fail} fallos`);
  if (docenteId) console.log(`Docente id: ${docenteId}`);
  if (casoImportadoId) console.log(`Caso importado de prueba: #${casoImportadoId}`);
  process.exit(resultados.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
