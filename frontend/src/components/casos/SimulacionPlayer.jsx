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
    return 'Ya recorriste todos los lugares. Si quieres, revisa alguno otra vez o termina la simulación.';
  }
  const sugerida = escenas[indiceSugerido] || pendientes[0];
  if (!visitados.size) {
    return `Si fuera tú, empezaría por «${sugerida.nombre}». Ahí sueles encontrar la primera versión oficial del conflicto.`;
  }
  if (pendientes[0]) {
    return `Si fuera tú, ahora iría a «${pendientes[0].nombre}». Todavía te falta contrastar lo que pasa ahí.`;
  }
  return `Si fuera tú, volvería a «${sugerida.nombre}» para preguntar lo que quedó pendiente.`;
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

  const [fase, setFase] = useState('mapa'); // mapa | lugar | dialogo | decision | feedback | fin
  const [indiceEscena, setIndiceEscena] = useState(null);
  const [indiceDecision, setIndiceDecision] = useState(0);
  const [personajeActivo, setPersonajeActivo] = useState(null);
  const [dialogoIdx, setDialogoIdx] = useState(0);
  const [preguntados, setPreguntados] = useState(() => new Set());
  const [opcionElegida, setOpcionElegida] = useState(null);
  const [totalDecisiones, setTotalDecisiones] = useState(0);
  const [respuestas, setRespuestas] = useState([]);
  const [visitados, setVisitados] = useState(() => new Set());
  const [resueltos, setResueltos] = useState(() => new Set());
  const [guiaAbierta, setGuiaAbierta] = useState(true);
  const [hoverLugar, setHoverLugar] = useState(null);
  const [errorLive, setErrorLive] = useState('');
  const [guardando, setGuardando] = useState(false);

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

  const dialogos = personajeActivo
    ? dialogosDePersonaje(caso, personajeActivo.nombre, escena)
    : [];

  const sugeridoIdx = useMemo(() => {
    const pendiente = escenas.findIndex((e) => !visitados.has(e.orden));
    return pendiente >= 0 ? pendiente : 0;
  }, [escenas, visitados]);

  const consejo = consejoGuia(escenas, visitados, sugeridoIdx);

  function irAlMapa() {
    setFase('mapa');
    setIndiceEscena(null);
    setPersonajeActivo(null);
    setDialogoIdx(0);
    setPreguntados(new Set());
    setOpcionElegida(null);
    setGuiaAbierta(true);
  }

  function elegirLugar(idx) {
    const elegida = escenas[idx];
    if (!elegida) return;
    setIndiceEscena(idx);
    setIndiceDecision(0);
    setVisitados((prev) => new Set([...prev, elegida.orden]));
    setFase('lugar');
    setPersonajeActivo(null);
    setDialogoIdx(0);
    setPreguntados(new Set());
    setOpcionElegida(null);
    setGuiaAbierta(false);
  }

  function preguntarA(personaje) {
    setPersonajeActivo(personaje);
    setDialogoIdx(0);
    setFase('dialogo');
    setPreguntados((prev) => new Set([...prev, personaje.nombre]));
  }

  function siguienteDialogo() {
    if (dialogoIdx < dialogos.length - 1) {
      setDialogoIdx((i) => i + 1);
      return;
    }
    setFase('lugar');
    setPersonajeActivo(null);
  }

  function irADecision() {
    setIndiceDecision(0);
    setFase('decision');
    setOpcionElegida(null);
  }

  async function elegirOpcion(opcion) {
    if (guardando) return;
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
        setErrorLive(err?.message || 'No se pudo guardar la respuesta. Intentá de nuevo.');
        setGuardando(false);
        return;
      }
      setGuardando(false);
    }

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
    setFase(modoLive ? 'lugar' : 'feedback');
    if (modoLive && escena) {
      if (indiceDecision + 1 >= decisionesEscena.length) {
        setResueltos((prev) => new Set([...prev, escena.orden]));
      } else {
        setIndiceDecision((i) => i + 1);
        setOpcionElegida(null);
        setFase('decision');
      }
    }
  }

  function despuesDeFeedback() {
    if (indiceDecision + 1 < decisionesEscena.length) {
      setIndiceDecision((i) => i + 1);
      setOpcionElegida(null);
      setFase('decision');
      return;
    }
    if (escena) {
      const next = new Set([...resueltos, escena.orden]);
      setResueltos(next);
      if (next.size >= escenas.length) {
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
        <p>Este caso aún no tiene lugares para visitar.</p>
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
      <header className="sim-top">
        <div>
          <p className="kicker">
            Estás en · lugar {indiceEscena + 1} de {escenas.length}
          </p>
          <h2>{escena.nombre}</h2>
          <p className="muted-light">{escena.contexto}</p>
        </div>
        <div className="ficha-acciones">
          <button type="button" className="btn-ghost-dark" onClick={irAlMapa}>
            Volver al mapa
          </button>
          <button type="button" className="btn-ghost-dark" onClick={onSalir}>
            Salir
          </button>
        </div>
      </header>

      <div className="sim-stage" style={{ backgroundImage: `url('${fondo}')` }}>
        <div className="sim-stage-shade" />

        <div className="sim-personajes">
          {(escena.personajes || []).map((pj) => {
            const foto = imagenDePersonaje(pj.nombre);
            const ya = preguntados.has(pj.nombre);
            return (
              <button
                key={pj.id || pj.nombre}
                type="button"
                className={ya ? 'sim-pj ya' : 'sim-pj'}
                onClick={() => preguntarA(pj)}
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
                <em>{ya ? 'Ya hablaste' : 'Preguntar'}</em>
              </button>
            );
          })}
        </div>

        {fase === 'dialogo' && personajeActivo ? (
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
                <em>te responde</em>
              </div>
            </div>
            <p className="sim-dialogo-texto">{dialogos[dialogoIdx]}</p>
            <button type="button" className="btn-play" onClick={siguienteDialogo}>
              {dialogoIdx < dialogos.length - 1 ? 'Seguir escuchando' : 'Cerrar diálogo'}
            </button>
          </div>
        ) : null}
      </div>

      <aside className="sim-guia compacta">
        <span className="sim-guia-foto" style={{ backgroundImage: `url('${GUIA.imagen}')` }} />
        <p>
          <strong>{GUIA.nombre}:</strong> Pregunta a quienes estén aquí. Cuando tengas pistas,
          decide. Si te trabas, vuelve al mapa y te oriento.
        </p>
      </aside>

      {fase === 'lugar' ? (
        <div className="sim-acciones">
          <p className="muted-light">
            Pregunta a las personas del lugar. Cuando tengas información, toma una decisión.
          </p>
          <div className="ficha-acciones">
            <button type="button" className="btn-ghost-dark" onClick={irAlMapa}>
              Elegir otro lugar
            </button>
            <button type="button" className="btn-play" onClick={irADecision} disabled={!decision}>
              Decidir en este lugar
            </button>
          </div>
        </div>
      ) : null}

      {fase === 'decision' && decision ? (
        <div className="sim-decision">
          {decisionesEscena.length > 1 ? (
            <p className="muted-light">
              Pregunta {indiceDecision + 1} de {decisionesEscena.length} en este lugar
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
                className="sim-op"
                disabled={guardando}
                onClick={() => elegirOpcion(op)}
              >
                {op.texto}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {fase === 'feedback' && opcionElegida ? (
        <div className={`sim-feedback ${opcionElegida.esCorrecta ? 'ok' : 'no'}`}>
          <h3>{opcionElegida.esCorrecta ? 'Buena intervención' : 'Hay una mejor opción'}</h3>
          <p>
            {opcionElegida.explicacion ||
              'Sigue practicando la escucha y el contraste de versiones.'}
          </p>
          <button type="button" className="btn-play" onClick={despuesDeFeedback}>
            Volver al mapa
          </button>
        </div>
      ) : null}
    </section>
  );
}
