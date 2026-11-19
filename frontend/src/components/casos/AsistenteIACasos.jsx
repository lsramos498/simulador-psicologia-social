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

export function emparejarPersonajes(nombres = []) {
  const lower = nombres.map((n) => String(n).toLocaleLowerCase('es'));
  const encontrados = BANCO_PERSONAJES.filter((p) =>
    lower.some(
      (n) =>
        p.nombre.toLocaleLowerCase('es') === n ||
        p.rolSocial.toLocaleLowerCase('es').includes(n)
    )
  );
  if (encontrados.length >= 2) return encontrados.slice(0, 4);
  return BANCO_PERSONAJES.slice(0, 3);
}

export function emparejarEscenario(nombreSugerido = '') {
  const q = String(nombreSugerido).toLocaleLowerCase('es');
  if (!q) return BANCO_ESCENARIOS[0] || null;
  const exacto = BANCO_ESCENARIOS.find((e) => e.titulo.toLocaleLowerCase('es') === q);
  if (exacto) return exacto;
  const porTitulo = BANCO_ESCENARIOS.find((e) =>
    e.titulo.toLocaleLowerCase('es').includes(q.split(' ')[0] || '')
  );
  if (porTitulo) return porTitulo;
  const claves = ['comisaría', 'hospital', 'barrio', 'colegio', 'ong', 'trabajo', 'plaza', 'café', 'cafe', 'hogar'];
  const clave = claves.find((c) => q.includes(c.replace('á', 'a')) || q.includes(c));
  if (clave) {
    const porCat = BANCO_ESCENARIOS.find((e) =>
      e.categoriaNombre.toLocaleLowerCase('es').includes(clave.replace('á', 'a').slice(0, 5)) ||
      e.titulo.toLocaleLowerCase('es').includes(clave.slice(0, 5))
    );
    if (porCat) return porCat;
  }
  return BANCO_ESCENARIOS[0] || null;
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
    const personajes = emparejarPersonajes(borrador.personajesSugeridos);
    const escenario = emparejarEscenario(borrador.escenarioSugerido);
    onAplicar({
      form: {
        titulo: borrador.titulo || '',
        desarrolloSituacional: borrador.desarrolloSituacional || '',
        contextoHistoria: borrador.contextoHistoria || '',
        tiempoEstimadoSegundos: borrador.tiempoEstimadoSegundos || 800,
        pregunta: borrador.pregunta || '',
        opcionBuena: borrador.opcionBuena || '',
        opcionMala: borrador.opcionMala || ''
      },
      personajes,
      escenario,
      escenaSugerida: borrador.escenaSugerida || null,
      rubricaSugerida: borrador.rubricaSugerida || null,
      borrador
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
            placeholder="Ej: Conflicto entre vecinos por el uso de la cancha comunal…"
            required
            minLength={8}
            maxLength={2000}
            disabled={disabled || cargando}
          />
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
            <li>Pregunta: {borrador.pregunta}</li>
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
