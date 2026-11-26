import { pinDeIndice } from '../../data/mapaPines';
import { portadaEscena } from '../../utils/escenasLocal';
import { tituloCasoLimpio } from '../../utils/tituloCaso';

const GUIA = {
  nombre: 'Nova',
  imagen: '/personajes/game-guia.jpg',
  rol: 'Tu guía'
};

export default function SimMapa({
  caso,
  escenas,
  visitados,
  resueltos,
  sugeridoIdx,
  consejo,
  guiaAbierta,
  setGuiaAbierta,
  hoverLugar,
  setHoverLugar,
  modoLive,
  onElegirLugar,
  onTerminar,
  onFinLocal,
  onSalir
}) {
  const previewIdx = hoverLugar ?? sugeridoIdx;
  const preview = escenas[previewIdx];
  const previewImg =
    (preview && portadaEscena(caso, preview)?.imagen) || '/escenarios/game-esc-plaza.jpg';
  const guiaPin = pinDeIndice(sugeridoIdx);

  return (
    <section className="sim-player sim-player-mapa">
      <header className="sim-top sim-top-compacto">
        <div>
          <p className="kicker">Mapa de la práctica</p>
          <h2>Elige a dónde ir</h2>
          <p className="muted-light">{tituloCasoLimpio(caso.titulo)}</p>
        </div>
      </header>

      <div className="sim-mapa-board">
        <div
          className="sim-mapa-mundo"
          style={{ backgroundImage: `url('/escenarios/game-mapa.jpg')` }}
          onMouseLeave={() => setHoverLugar(null)}
        >
          <svg className="sim-mapa-rutas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {escenas.slice(0, -1).map((item, idx) => {
              const a = pinDeIndice(idx);
              const b = pinDeIndice(idx + 1);
              const activo =
                visitados.has(item.orden) || visitados.has(escenas[idx + 1]?.orden);
              return (
                <line
                  key={`ruta-${item.id || idx}`}
                  x1={a.left}
                  y1={a.top}
                  x2={b.left}
                  y2={b.top}
                  className={activo ? 'ruta activa' : 'ruta'}
                />
              );
            })}
          </svg>

          {escenas.map((item, idx) => {
            const pin = pinDeIndice(idx);
            const hecho = resueltos.has(item.orden);
            const visitado = visitados.has(item.orden);
            const sugerido = idx === sugeridoIdx && !hecho;
            const activo = hoverLugar === idx;
            return (
              <button
                key={item.id || item.orden}
                type="button"
                className={[
                  'sim-pin',
                  sugerido ? 'sugerido' : '',
                  hecho ? 'hecho' : '',
                  visitado ? 'visitado' : '',
                  activo ? 'activo' : ''
                ].join(' ')}
                style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
                onMouseEnter={() => setHoverLugar(idx)}
                onFocus={() => setHoverLugar(idx)}
                onClick={() => onElegirLugar(idx)}
                aria-label={`Ir a ${item.nombre}`}
              >
                <span className="sim-pin-pulse" aria-hidden="true" />
                <span className="sim-pin-dot">{idx + 1}</span>
                <span className="sim-pin-label">{item.nombre}</span>
              </button>
            );
          })}

          <div
            className="sim-guia-mapa"
            style={{
              left: `${Math.min(guiaPin.left + 8, 88)}%`,
              top: `${Math.max(guiaPin.top - 14, 8)}%`
            }}
          >
            <span className="sim-guia-foto" style={{ backgroundImage: `url('${GUIA.imagen}')` }} />
            <span className="sim-guia-mapa-tag">{GUIA.nombre}</span>
          </div>
        </div>

        <aside className="sim-mapa-panel">
          <div className="sim-mapa-preview">
            <div
              className="sim-mapa-preview-foto"
              style={{ backgroundImage: `url('${previewImg}')` }}
              aria-hidden="true"
            />
            <div className="sim-mapa-preview-copy">
              <p className="kicker">Lugar seleccionado</p>
              <h3>{preview?.nombre || 'Elige un punto'}</h3>
              <p>{preview?.contexto || 'Pasa el cursor o toca un pin del mapa.'}</p>
            </div>
          </div>

          <div className={`sim-guia ${guiaAbierta ? 'abierta' : ''}`}>
            <button
              type="button"
              className="sim-guia-toggle"
              onClick={() => setGuiaAbierta((v) => !v)}
            >
              <span className="sim-guia-foto" style={{ backgroundImage: `url('${GUIA.imagen}')` }} />
              <span>
                <strong>{GUIA.nombre}</strong>
                <em>{GUIA.rol}</em>
              </span>
            </button>
            {guiaAbierta ? (
              <div className="sim-guia-globo">
                <p>{consejo}</p>
                <button type="button" className="btn-play" onClick={() => onElegirLugar(sugeridoIdx)}>
                  Ir a donde me sugiere
                </button>
              </div>
            ) : null}
          </div>

          <div className="sim-mapa-acciones">
            <div className="sim-mapa-leyenda">
              <span>
                <i className="ley sugerido" /> Sugerido
              </span>
              <span>
                <i className="ley visitado" /> Visitado
              </span>
              <span>
                <i className="ley hecho" /> Hecho
              </span>
            </div>
            <p className="sim-mapa-progreso sim-nivel-badge">
              Progreso {resueltos.size}/{escenas.length}
            </p>
            {resueltos.size >= escenas.length ? (
              <button
                type="button"
                className="btn-play"
                onClick={() => {
                  if (modoLive && onTerminar) onTerminar();
                  else onFinLocal();
                }}
              >
                {modoLive ? 'Finalizar caso' : 'Terminar simulación'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-play"
                onClick={() => onElegirLugar(previewIdx)}
                disabled={previewIdx == null}
              >
                Entrar aquí
              </button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
