import { useEffect, useState } from 'react';
import { estadoAsistenteIa, generarCasoConIa } from '../../api/client';
import { BANCO_PERSONAJES } from '../../data/bancoPersonajes';
import { BANCO_ESCENARIOS } from '../../data/bancoEscenarios';
import { mensajeError } from '../../utils/casoHelpers';

const LUGARES = [
  'Calle del barrio',
  'Recepción de la comisaría',
  'Sala de espera del hospital',
  'Orientación escolar',
  'Sede de la ONG',
  'Oficina laboral',
  'Plaza principal',
  'Café del barrio'
];

const EJEMPLOS = [
  'Conflicto de vecinos por ruido en el barrio El Roble',
  'Adolescente en crisis y familia en sala de espera del hospital',
  'Denuncia de violencia intrafamiliar en la comisaría',
  'Acoso escolar: rumores y exclusión en el colegio'
];

function normalizar(texto) {
  return String(texto || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** Elige personajes del banco según nombres sugeridos por la IA. */
export function emparejarPersonajes(nombres = [], cantidadObjetivo = 6) {
  const meta = Math.min(12, Math.max(2, Number(cantidadObjetivo) || nombres.length || 6));
  const banco = [...BANCO_PERSONAJES];
  const elegidos = [];
  const usados = new Set();

  for (const crudo of nombres) {
    const q = normalizar(crudo);
    if (!q) continue;
    const exacto = banco.find(
      (p) => !usados.has(p.id) && normalizar(p.nombre) === q
    );
    const porRol = banco.find(
      (p) =>
        !usados.has(p.id) &&
        (normalizar(p.rolSocial).includes(q) || q.includes(normalizar(p.nombre)))
    );
    const pick = exacto || porRol;
    if (pick) {
      elegidos.push(pick);
      usados.add(pick.id);
    }
    if (elegidos.length >= meta) break;
  }

  for (const p of banco) {
    if (elegidos.length >= meta) break;
    if (usados.has(p.id)) continue;
    elegidos.push(p);
    usados.add(p.id);
  }

  return elegidos.slice(0, meta);
}

/** Empareja un lugar sugerido con un escenario real del banco. */
export function emparejarEscenario(nombreSugerido = '') {
  const q = normalizar(nombreSugerido);
  if (!q) return BANCO_ESCENARIOS[0] || null;

  const exacto = BANCO_ESCENARIOS.find((e) => normalizar(e.titulo) === q);
  if (exacto) return exacto;

  const contiene = BANCO_ESCENARIOS.find(
    (e) => normalizar(e.titulo).includes(q) || q.includes(normalizar(e.titulo))
  );
  if (contiene) return contiene;

  const mapa = [
    ['comisaria', 'comisaría'],
    ['denuncia', 'comisaría'],
    ['policia', 'comisaría'],
    ['hospital', 'hospital'],
    ['urgencia', 'hospital'],
    ['enfermer', 'hospital'],
    ['barrio', 'barrio'],
    ['vecino', 'barrio'],
    ['calle', 'barrio'],
    ['colegio', 'colegio'],
    ['escolar', 'colegio'],
    ['aula', 'colegio'],
    ['orientacion', 'colegio'],
    ['ong', 'ong'],
    ['comunidad', 'ong'],
    ['trabajo', 'trabajo'],
    ['oficina', 'trabajo'],
    ['laboral', 'trabajo'],
    ['plaza', 'plaza'],
    ['cafe', 'café'],
    ['hogar', 'hogar'],
    ['casa', 'hogar']
  ];
  for (const [clave, categoria] of mapa) {
    if (!q.includes(clave)) continue;
    const porCat = BANCO_ESCENARIOS.find(
      (e) =>
        normalizar(e.categoriaNombre).includes(normalizar(categoria)) ||
        normalizar(e.categoria).includes(normalizar(categoria)) ||
        normalizar(e.titulo).includes(clave)
    );
    if (porCat) return porCat;
  }

  const token = q.split(/\s+/).find((t) => t.length > 3) || q.slice(0, 5);
  const porToken = BANCO_ESCENARIOS.find((e) => normalizar(e.titulo).includes(token));
  return porToken || BANCO_ESCENARIOS[0] || null;
}

/** Completa cada escena IA con un escenario del banco y campos listos para crear. */
export function enriquecerEscenasIa(escenas = [], escenarioPrincipal = null) {
  const lista = Array.isArray(escenas) && escenas.length ? escenas : [];
  return lista.map((esc, idx) => {
    const ref =
      (idx === 0 && escenarioPrincipal) ||
      emparejarEscenario(esc?.nombre || esc?.escenarioSugerido || '');
    return {
      nombre: ref?.titulo || esc?.nombre || `Lugar ${idx + 1}`,
      contexto:
        String(esc?.contexto || '').trim() ||
        ref?.descripcion ||
        'Observa el lugar, escucha a las personas y decide cómo intervenir.',
      pregunta:
        String(esc?.pregunta || '').trim() ||
        '¿Cuál es la intervención más adecuada en este momento?',
      opcionBuena:
        String(esc?.opcionBuena || '').trim() ||
        'Escuchar, contrastar versiones y proponer un paso ético',
      opcionMala:
        String(esc?.opcionMala || '').trim() ||
        'Imponer una conclusión rápida sin escuchar',
      explicacionBuena:
        String(esc?.explicacionBuena || '').trim() ||
        'Favorece contención, escucha y criterio profesional.',
      explicacionMala:
        String(esc?.explicacionMala || '').trim() ||
        'Debilita el proceso y puede escalar el conflicto.',
      escenarioRef: ref
    };
  });
}

export default function AsistenteIACasos({
  token,
  onAplicar,
  disabled,
  promptInicial = '',
  botonAplicar = 'Usar en el formulario',
  compacto = false
}) {
  const [prompt, setPrompt] = useState(promptInicial);
  const [lugar, setLugar] = useState('');
  const [nivel, setNivel] = useState('pregrado');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [borrador, setBorrador] = useState(null);
  const [modo, setModo] = useState({ openaiConfigurado: false });

  useEffect(() => {
    if (promptInicial) setPrompt(promptInicial);
  }, [promptInicial]);

  useEffect(() => {
    let vivo = true;
    estadoAsistenteIa(token)
      .then((res) => {
        if (vivo) setModo(res.data || {});
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [token]);

  async function generar(evento) {
    evento.preventDefault();
    setCargando(true);
    setError('');
    setBorrador(null);
    try {
      const respuesta = await generarCasoConIa(token, {
        prompt: prompt.trim(),
        lugar: lugar || undefined,
        nivel
      });
      setBorrador(respuesta.data);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  function usarBorrador() {
    if (!borrador || !onAplicar) return;
    const metaPj = Math.max(
      2,
      (borrador.personajesSugeridos || []).length || 6
    );
    const personajes = emparejarPersonajes(borrador.personajesSugeridos, metaPj);
    const escenario = emparejarEscenario(
      borrador.escenarioSugerido || borrador.escenaSugerida?.nombre || lugar
    );
    const escenasBase =
      Array.isArray(borrador.escenasSugeridas) && borrador.escenasSugeridas.length
        ? borrador.escenasSugeridas
        : borrador.escenaSugerida
          ? [borrador.escenaSugerida]
          : [
              {
                nombre: borrador.escenarioSugerido,
                contexto: borrador.contextoHistoria,
                pregunta: borrador.pregunta,
                opcionBuena: borrador.opcionBuena,
                opcionMala: borrador.opcionMala,
                explicacionBuena: borrador.explicacionBuena,
                explicacionMala: borrador.explicacionMala
              }
            ];
    const escenas = enriquecerEscenasIa(escenasBase, escenario);
    const primera = escenas[0] || {};
    onAplicar({
      form: {
        titulo: borrador.titulo || '',
        desarrolloSituacional: borrador.desarrolloSituacional || '',
        contextoHistoria: borrador.contextoHistoria || '',
        tiempoEstimadoSegundos: borrador.tiempoEstimadoSegundos || 800,
        pregunta: primera.pregunta || borrador.pregunta || '',
        opcionBuena: primera.opcionBuena || borrador.opcionBuena || '',
        opcionMala: primera.opcionMala || borrador.opcionMala || '',
        modo: 'completo'
      },
      personajes,
      escenario: primera.escenarioRef || escenario,
      escenaSugerida: primera,
      escenasSugeridas: escenas,
      rubricaSugerida: borrador.rubricaSugerida || null,
      borrador: {
        ...borrador,
        escenasSugeridas: escenas,
        escenaSugerida: primera
      }
    });
  }

  return (
    <section className={compacto ? 'asistente-ia compacto' : 'asistente-ia'}>
      <header className="asistente-ia-head">
        <div>
          <p className="kicker">Asistente para docentes</p>
          <h3>{compacto ? 'Mejorar con IA' : 'IA para armar el caso'}</h3>
          {!compacto ? (
            <p className="muted-light">
              Describe la situación y genera un borrador editable (título, contexto, pregunta y
              opciones).
            </p>
          ) : (
            <p className="muted-light">
              Genera o mejora el contenido y aplícalo a esta historia en borrador.
            </p>
          )}
        </div>
        <span className="asistente-badge">
          {modo.openaiConfigurado ? 'OpenAI activa' : 'Modo local listo'}
        </span>
      </header>

      <form className="asistente-ia-form" onSubmit={generar}>
        <div className="field">
          <label htmlFor="ia-prompt">¿De qué trata el caso?</label>
          <textarea
            id="ia-prompt"
            rows={compacto ? 2 : 3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Conflicto escolar con 6 involucrados y 4 escenas…"
            required
            minLength={8}
            maxLength={2000}
            disabled={disabled || cargando}
          />
          <p className="muted-light">
            Indica cantidades si las necesitas: «6 involucrados» y «4 escenas». La IA las respeta.
          </p>
        </div>

        {!compacto ? (
          <div className="asistente-ejemplos" aria-label="Ejemplos">
            {EJEMPLOS.map((ej) => (
              <button
                key={ej}
                type="button"
                className="chip-ejemplo"
                disabled={disabled || cargando}
                onClick={() => setPrompt(ej)}
              >
                {ej}
              </button>
            ))}
          </div>
        ) : null}

        <div className="crear-grid">
          <div className="field">
            <label htmlFor="ia-lugar">Lugar preferido (opcional)</label>
            <select
              id="ia-lugar"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              disabled={disabled || cargando}
            >
              <option value="">Que lo sugiera la IA</option>
              {LUGARES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ia-nivel">Nivel</label>
            <select
              id="ia-nivel"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              disabled={disabled || cargando}
            >
              <option value="pregrado">Pregrado</option>
              <option value="practica">Práctica profesional</option>
              <option value="posgrado">Posgrado</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn-ia"
          disabled={disabled || cargando || prompt.trim().length < 8}
        >
          {cargando ? 'Generando borrador…' : 'Generar con IA'}
        </button>
      </form>

      {error ? <div className="alert fade">{error}</div> : null}

      {borrador ? (
        <div className="asistente-resultado fade">
          <div className="asistente-resultado-top">
            <strong>{borrador.titulo}</strong>
            <em>
              {borrador.fuente === 'openai'
                ? 'Generado con OpenAI'
                : 'Borrador del asistente local'}
            </em>
          </div>
          <p>{borrador.desarrolloSituacional}</p>
          <p className="muted-light">{borrador.tipDocente}</p>
          <ul className="asistente-meta">
            <li>Escenario: {borrador.escenarioSugerido}</li>
            <li>Personajes: {(borrador.personajesSugeridos || []).join(', ')}</li>
            <li>
              Escenas: {(borrador.escenasSugeridas || [borrador.escenaSugerida]).filter(Boolean).length}
            </li>
            <li>Pregunta: {borrador.pregunta}</li>
            <li>
              Opciones: {borrador.opcionBuena ? 'correcta + incorrecta' : 'pendientes'}
            </li>
            <li>Tiempo: {borrador.tiempoEstimadoSegundos}s</li>
          </ul>
          <button type="button" className="btn-play" onClick={usarBorrador} disabled={disabled}>
            <span className="play-tri" aria-hidden="true" />
            {botonAplicar}
          </button>
        </div>
      ) : null}
    </section>
  );
}
