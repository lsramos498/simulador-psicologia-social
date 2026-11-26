import { useMemo, useState } from 'react';
import { imagenDePersonaje } from '../../data/bancoPersonajes';
import { portadaEscena } from '../../utils/escenasLocal';
import { dialogosDePersonaje } from '../../utils/dialogosLocal';
import SimMapa from './SimMapa';
import SimResultadoFin from './SimResultadoFin';

const GUIA = {
  nombre: 'Nova',
  imagen: '/personajes/game-guia.jpg'
};

function consejoGuia(escenas, visitados, indiceSugerido) {
  const pendientes = escenas.filter((e) => !visitados.has(e.orden));
  if (pendientes.length === 0) {
    return 'Ya recorriste todos los lugares. Puedes revisar alguno o terminar la simulación.';
  }
  const sugerida = escenas[indiceSugerido] || pendientes[0];
  if (!visitados.size) {
    return `Empieza por «${sugerida.nombre}»: lee el contexto, escucha las pistas y responde la pregunta de la escena.`;
  }
  if (pendientes[0]) {
    return `Te falta «${pendientes[0].nombre}». Ahí hay otra parte de la historia y otra pregunta.`;
  }
  return `Vuelve a «${sugerida.nombre}» si quieres contrastar otra vez las pistas.`;
}

export default function SimulacionPlayer({
  caso,
  onSalir,
  modoLive = false,
  onResponder,
  onTerminar
}) {
  const escenas = useMemo(
    () => [...(caso.escenas || [])].sort((a, b) => a.orden - b.orden),
    [caso.escenas]
  );

  const [fase, setFase] = useState('mapa'); // mapa | escena | pista | enviada | feedback | fin
  const [indiceEscena, setIndiceEscena] = useState(null);
  const [indiceDecision, setIndiceDecision] = useState(0);
  const [personajeActivo, setPersonajeActivo] = useState(null);
  const [dialogoIdx, setDialogoIdx] = useState(0);
  const [pistasVistas, setPistasVistas] = useState(() => new Set());
  const [opcionElegida, setOpcionElegida] = useState(null);
  const [totalDecisiones, setTotalDecisiones] = useState(0);
  const [respuestas, setRespuestas] = useState([]);
  const [visitados, setVisitados] = useState(() => new Set());
  const [resueltos, setResueltos] = useState(() => new Set());
  const [guiaAbierta, setGuiaAbierta] = useState(true);
  const [hoverLugar, setHoverLugar] = useState(null);
  const [errorLive, setErrorLive] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hayMasPreguntasAqui, setHayMasPreguntasAqui] = useState(false);
  const [opcionPendiente, setOpcionPendiente] = useState(null);
  const [casoCompleto, setCasoCompleto] = useState(false);

  const escena = indiceEscena == null ? null : escenas[indiceEscena];
  const decisionesEscena = useMemo(
    () => [...(escena?.decisiones || [])].sort((a, b) => a.orden - b.orden),
    [escena]
  );
  const decision = decisionesEscena[indiceDecision] || decisionesEscena[0] || null;
  const portada = escena ? portadaEscena(caso, escena) : null;
  const fondo = portada?.imagen || '/escenarios/game-esc-plaza.jpg';
  const totalPreguntasCaso = useMemo(
    () => escenas.reduce((n, e) => n + (e.decisiones?.length || 0), 0),
    [escenas]
  );

  const pistas = personajeActivo
    ? dialogosDePersonaje(caso, personajeActivo.nombre, escena)
    : [];

  const sugeridoIdx = useMemo(() => {
    const pendiente = escenas.findIndex((e) => !visitados.has(e.orden));
    return pendiente >= 0 ? pendiente : 0;
  }, [escenas, visitados]);

  const consejo = consejoGuia(escenas, visitados, sugeridoIdx);
  const contextoEscena =
    String(escena?.contexto || '').trim() ||
    String(caso?.contextoHistoria || '').trim() ||
    'Observa el lugar, escucha las pistas y responde la pregunta de esta escena.';

  function irAlMapa() {
    setFase('mapa');
    setIndiceEscena(null);
    setPersonajeActivo(null);
    setDialogoIdx(0);
    setPistasVistas(new Set());
    setOpcionElegida(null);
    setGuiaAbierta(true);
    setErrorLive('');
  }

  function elegirLugar(idx) {
    const elegida = escenas[idx];
    if (!elegida) return;
    setIndiceEscena(idx);
    setIndiceDecision(0);
    setVisitados((prev) => new Set([...prev, elegida.orden]));
    setFase('escena');
    setPersonajeActivo(null);
    setDialogoIdx(0);
    setPistasVistas(new Set());
    setOpcionElegida(null);
    setGuiaAbierta(false);
    setErrorLive('');
  }

  function abrirPista(personaje) {
    setPersonajeActivo(personaje);
    setDialogoIdx(0);
    setFase('pista');
    setPistasVistas((prev) => new Set([...prev, personaje.nombre]));
  }

  function siguientePista() {
    if (dialogoIdx < pistas.length - 1) {
      setDialogoIdx((i) => i + 1);
      return;
    }
    setFase('escena');
    setPersonajeActivo(null);
  }

  function elegirOpcion(opcion) {
    if (guardando || opcionPendiente) return;
    setErrorLive('');
    setOpcionPendiente(opcion);
  }

  function cancelarEnvio() {
    if (guardando) return;
    setOpcionPendiente(null);
  }

  async function confirmarEnvio() {
    const opcion = opcionPendiente;
    if (!opcion || guardando) return;

    setErrorLive('');
    setOpcionElegida(opcion);

    if (decision?.id != null && modoLive && onResponder) {
      setGuardando(true);
      try {
        await onResponder({
          decisionId: decision.id,
          opcionId: opcion.id
        });
      } catch (err) {
        setOpcionElegida(null);
        setOpcionPendiente(null);
        setErrorLive(err?.message || 'No se pudo guardar la respuesta. Intenta de nuevo.');
        setGuardando(false);
        return;
      }
      setGuardando(false);
    }

    setOpcionPendiente(null);
    setTotalDecisiones((n) => n + 1);
    if (decision?.id != null) {
      setRespuestas((prev) => {
        const sinEsta = prev.filter((r) => Number(r.decisionId) !== Number(decision.id));
        return [
          ...sinEsta,
          {
            decisionId: decision.id,
            opcionId: opcion.id,
            esCorrecta: Boolean(opcion.esCorrecta),
            texto: opcion.texto
          }
        ];
      });
    }

    const quedanMas = indiceDecision + 1 < decisionesEscena.length;
    setHayMasPreguntasAqui(quedanMas);

    if (!quedanMas && escena) {
      const next = new Set([...resueltos, escena.orden]);
      setResueltos(next);
      setCasoCompleto(next.size >= escenas.length);
    } else {
      setCasoCompleto(false);
    }

    if (modoLive) {
      setFase('enviada');
      return;
    }

    setFase('feedback');
  }

  function finalizarCaso() {
    setOpcionElegida(null);
    setHayMasPreguntasAqui(false);
    setCasoCompleto(false);
    if (modoLive && onTerminar) {
      onTerminar();
      return;
    }
    setFase('fin');
  }

  function continuarTrasEnviada() {
    if (hayMasPreguntasAqui) {
      setIndiceDecision((i) => i + 1);
      setOpcionElegida(null);
      setHayMasPreguntasAqui(false);
      setCasoCompleto(false);
      setFase('escena');
      return;
    }
    if (casoCompleto) {
      finalizarCaso();
      return;
    }
    setOpcionElegida(null);
    setHayMasPreguntasAqui(false);
    irAlMapa();
  }

  function despuesDeFeedback() {
    if (indiceDecision + 1 < decisionesEscena.length) {
      setIndiceDecision((i) => i + 1);
      setOpcionElegida(null);
      setFase('escena');
      return;
    }
    if (escena) {
      const next = new Set([...resueltos, escena.orden]);
      setResueltos(next);
      if (next.size >= escenas.length) {
        if (modoLive && onTerminar) {
          onTerminar();
          return;
        }
        setFase('fin');
      } else {
        irAlMapa();
      }
      return;
    }
    irAlMapa();
  }

  if (!escenas.length) {
    return (
      <section className="sim-player">
        <p>Este caso aún no tiene escenas para visitar.</p>
        <button type="button" className="btn-ghost-dark" onClick={onSalir}>
          Volver
        </button>
      </section>
    );
  }

  if (fase === 'fin') {
    return (
      <SimResultadoFin
        caso={caso}
        escenas={escenas}
        visitados={visitados}
        respuestas={respuestas}
        totalPreguntasCaso={totalPreguntasCaso}
        totalDecisiones={totalDecisiones}
        modoLive={modoLive}
        onTerminar={onTerminar}
        onSalir={onSalir}
      />
    );
  }

  if (fase === 'mapa') {
    return (
      <SimMapa
        caso={caso}
        escenas={escenas}
        visitados={visitados}
        resueltos={resueltos}
        sugeridoIdx={sugeridoIdx}
        consejo={consejo}
        guiaAbierta={guiaAbierta}
        setGuiaAbierta={setGuiaAbierta}
        hoverLugar={hoverLugar}
        setHoverLugar={setHoverLugar}
        modoLive={modoLive}
        onElegirLugar={elegirLugar}
        onTerminar={onTerminar}
        onFinLocal={() => setFase('fin')}
        onSalir={onSalir}
      />
    );
  }

  return (
    <section className="sim-player">
      <header className="sim-top sim-top-compacto">
        <div>
          <p className="sim-nivel-badge">
            Misión {indiceEscena + 1} / {escenas.length}
          </p>
          <h2>{escena.nombre}</h2>
        </div>
        <div className="ficha-acciones">
          <button type="button" className="btn-ghost-dark" onClick={irAlMapa}>
            Volver al mapa
          </button>
        </div>
      </header>

      <div className="sim-contexto-escena">
        <p className="kicker">Contexto de la escena</p>
        <p>{contextoEscena}</p>
      </div>

      <div className="sim-stage" style={{ backgroundImage: `url('${fondo}')` }}>
        <div className="sim-stage-shade" />

        <div className="sim-personajes">
          {(escena.personajes || []).map((pj) => {
            const foto = imagenDePersonaje(pj.nombre);
            const ya = pistasVistas.has(pj.nombre);
            return (
              <button
                key={pj.id || pj.nombre}
                type="button"
                className={ya ? 'sim-pj ya' : 'sim-pj'}
                onClick={() => abrirPista(pj)}
              >
                <span
                  className="sim-pj-foto"
                  style={{
                    backgroundImage: foto
                      ? `url('${foto}')`
                      : 'linear-gradient(135deg,#d7e6ef,#f7fafc)'
                  }}
                />
                <strong>{pj.nombre}</strong>
                <em>{ya ? 'Pista vista' : 'Ver pista'}</em>
              </button>
            );
          })}
        </div>

        {fase === 'pista' && personajeActivo ? (
          <div className="sim-dialogo">
            <div className="sim-dialogo-head">
              <span
                className="sim-dialogo-avatar"
                style={{
                  backgroundImage: imagenDePersonaje(personajeActivo.nombre)
                    ? `url('${imagenDePersonaje(personajeActivo.nombre)}')`
                    : undefined
                }}
              />
              <div>
                <strong>{personajeActivo.nombre}</strong>
                <em>comparte una pista de la historia</em>
              </div>
            </div>
            <p className="sim-dialogo-texto">{pistas[dialogoIdx]}</p>
            <button type="button" className="btn-play" onClick={siguientePista}>
              {dialogoIdx < pistas.length - 1 ? 'Siguiente pista' : 'Volver a la escena'}
            </button>
          </div>
        ) : null}
      </div>

      <aside className="sim-guia compacta">
        <span className="sim-guia-foto" style={{ backgroundImage: `url('${GUIA.imagen}')` }} />
        <p>
          <strong>{GUIA.nombre}:</strong> Lee el contexto, abre las pistas de cada persona y
          responde la pregunta de esta escena. Cada lugar suma un pedazo distinto de la historia.
        </p>
      </aside>

      {(fase === 'escena' || fase === 'pista') && decision ? (
        <div className="sim-decision">
          <p className="sim-nivel-badge">Desafío</p>
          {decisionesEscena.length > 1 ? (
            <p className="muted-light">
              Reto {indiceDecision + 1} de {decisionesEscena.length} en este lugar
            </p>
          ) : null}
          <h3>{decision.pregunta}</h3>
          {errorLive ? <p className="alert">{errorLive}</p> : null}
          {guardando ? <p className="muted-light">Guardando respuesta…</p> : null}
          <div className="sim-ops">
            {(decision.opciones || []).map((op) => (
              <button
                key={op.id || op.orden}
                type="button"
                className={`sim-op${
                  opcionPendiente && (opcionPendiente.id || opcionPendiente.orden) === (op.id || op.orden)
                    ? ' seleccionada'
                    : ''
                }`}
                disabled={guardando || fase === 'pista' || Boolean(opcionPendiente)}
                onClick={() => elegirOpcion(op)}
              >
                {op.texto}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {opcionPendiente ? (
        <div className="lumina-modal-backdrop" role="presentation" onClick={cancelarEnvio}>
          <div
            className="lumina-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-envio-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="kicker">Confirmación</p>
            <h3 id="confirmar-envio-titulo">¿Enviar esta respuesta?</h3>
            <p className="muted-light">
              Una vez enviada quedará registrada en tu sesión.
            </p>
            <blockquote className="lumina-modal-quote">{opcionPendiente.texto}</blockquote>
            <div className="ficha-acciones">
              <button
                type="button"
                className="btn-ghost-dark"
                onClick={cancelarEnvio}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-play"
                onClick={confirmarEnvio}
                disabled={guardando}
              >
                {guardando ? 'Enviando…' : 'Sí, enviar respuesta'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(fase === 'escena' || fase === 'pista') && !decision ? (
        <div className="sim-acciones">
          <p className="alert">
            Esta escena no tiene pregunta configurada. Pídele a tu docente que la complete.
          </p>
          <button type="button" className="btn-ghost-dark" onClick={irAlMapa}>
            Ir a otro lugar
          </button>
        </div>
      ) : null}

      {fase === 'enviada' ? (
        <div className="sim-feedback ok sim-enviada">
          <h3>Respuesta enviada</h3>
          <p>
            {hayMasPreguntasAqui
              ? 'Tu respuesta quedó registrada. Hay otra pregunta en esta misma escena.'
              : casoCompleto
                ? 'Recorriste todas las escenas. Puedes finalizar el caso y ver tus resultados.'
                : 'Tu respuesta quedó registrada. Puedes ir a otro lugar para seguir armando la historia.'}
          </p>
          {opcionElegida?.texto ? (
            <p className="muted-light">Elegiste: {opcionElegida.texto}</p>
          ) : null}
          <div className="ficha-acciones">
            {hayMasPreguntasAqui ? (
              <button type="button" className="btn-play" onClick={continuarTrasEnviada}>
                Siguiente pregunta
              </button>
            ) : casoCompleto ? (
              <button type="button" className="btn-play" onClick={continuarTrasEnviada}>
                Finalizar caso
              </button>
            ) : (
              <button type="button" className="btn-play" onClick={continuarTrasEnviada}>
                Ir a otro lugar
              </button>
            )}
          </div>
        </div>
      ) : null}

      {fase === 'feedback' && opcionElegida ? (
        <div className={`sim-feedback ${opcionElegida.esCorrecta ? 'ok' : 'no'}`}>
          <h3>{opcionElegida.esCorrecta ? 'Buena intervención' : 'Hay una mejor opción'}</h3>
          <p>
            {opcionElegida.explicacion ||
              'Sigue contrastando pistas y el contexto de cada escena.'}
          </p>
          <button type="button" className="btn-play" onClick={despuesDeFeedback}>
            Volver al mapa
          </button>
        </div>
      ) : null}
    </section>
  );
}
