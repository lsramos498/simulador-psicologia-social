import GuiaBurbuja, { mensajeNovaPorNota } from '../GuiaBurbuja';
import GameDecor from '../GameDecor';

const MUÑECOS = [
  '/personajes/game-pj-01.jpg',
  '/personajes/game-pj-02.jpg',
  '/personajes/game-pj-03.jpg',
  '/personajes/game-pj-04.jpg',
  '/personajes/game-pj-05.jpg',
  '/personajes/game-pj-06.jpg',
  '/personajes/game-pj-07.jpg',
  '/personajes/game-pj-08.jpg'
];

function etiquetaAcierto(ok) {
  if (ok === true) return 'Acierto';
  if (ok === false) return 'A mejorar';
  return 'Pista';
}

export default function PracticaResultado({ caso, evaluacion, retroItems, onSalir }) {
  const nota = evaluacion?.resultado;
  const correctas = Number(evaluacion?.correctas);
  const total = Number(evaluacion?.total);
  const msg = mensajeNovaPorNota(nota);
  const celebracion = msg.tono === 'ok';

  return (
    <section className={`sim-player sim-fin practica-panel practica-resultado tono-${msg.tono}`}>
      <GameDecor variant="ambient" munecos={celebracion ? 3 : 2} />

      <GuiaBurbuja nota={nota} className="guia-burbuja-destacada" />

      <div className="practica-resultado-hero">
        <div className="practica-resultado-hero-texto">
          <p className="practica-resultado-kicker">Partida terminada</p>
          <h2 className="practica-resultado-titulo">{caso?.titulo || 'Sesión terminada'}</h2>
        </div>
        {nota != null ? (
          <div
            className={`practica-resultado-score tono-${msg.tono}`}
            aria-label={`Nota ${nota} de 5`}
          >
            <span className="practica-resultado-score-label">Nota</span>
            <strong className="practica-resultado-score-valor">
              {nota}
              <span>/5</span>
            </strong>
            {Number.isFinite(correctas) && Number.isFinite(total) && total > 0 ? (
              <span className="practica-resultado-score-sub">
                {correctas}/{total} aciertos
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {evaluacion?.retroalimentacionGeneral ? (
        <p className="practica-resultado-texto practica-resultado-resumen">
          {evaluacion.retroalimentacionGeneral}
        </p>
      ) : null}

      {evaluacion?.comentarioDocente ? (
        <div className="practica-resultado-bloque">
          <div className="practica-resultado-bloque-head">
            <span
              className="practica-resultado-mini"
              style={{ backgroundImage: "url('/personajes/game-guia.jpg')" }}
              aria-hidden="true"
            />
            <h3 className="practica-resultado-subtitulo">Comentario docente</h3>
          </div>
          <p className="practica-resultado-texto" style={{ whiteSpace: 'pre-wrap' }}>
            {evaluacion.comentarioDocente}
          </p>
        </div>
      ) : (
        <p className="practica-resultado-texto">Aún no hay comentario del docente.</p>
      )}

      {retroItems.length > 0 ? (
        <div className="practica-resultado-bloque">
          <h3 className="practica-resultado-subtitulo">Retroalimentación de la partida</h3>
          <ul className="practica-resultado-lista">
            {retroItems.map((item, idx) => {
              const ok =
                item.esCorrecta === true || item.esCorrecta === 1
                  ? true
                  : item.esCorrecta === false || item.esCorrecta === 0
                    ? false
                    : null;
              const avatar = MUÑECOS[idx % MUÑECOS.length];
              return (
                <li
                  key={item.key}
                  className={
                    ok === true
                      ? 'practica-resultado-item ok'
                      : ok === false
                        ? 'practica-resultado-item fail'
                        : 'practica-resultado-item'
                  }
                >
                  <span
                    className="practica-resultado-mini"
                    style={{ backgroundImage: `url('${avatar}')` }}
                    aria-hidden="true"
                  />
                  <div className="practica-resultado-item-body">
                    <p className="practica-resultado-item-tag">{etiquetaAcierto(ok)}</p>
                    <p className="practica-resultado-texto practica-resultado-item-titulo">
                      {item.titulo}
                    </p>
                    {item.detalle ? (
                      <p className="practica-resultado-texto">{item.detalle}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="practica-resultado-texto">
          No hay detalle de retroalimentación para esta sesión.
        </p>
      )}

      <div className="practica-resultado-acciones">
        <button type="button" className="login-btn-game blue practica-btn-uniforme" onClick={onSalir}>
          Salir
        </button>
      </div>
    </section>
  );
}
