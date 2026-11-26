import { calcularResultadoSimulacion } from '../../utils/rubricaArchivo';
import { tituloCasoLimpio } from '../../utils/tituloCaso';
import GuiaBurbuja, { mensajeNovaPorFraccion } from '../GuiaBurbuja';
import GameDecor from '../GameDecor';

const EQUIPO = [
  '/personajes/game-pj-01.jpg',
  '/personajes/game-pj-02.jpg',
  '/personajes/game-pj-03.jpg',
  '/personajes/game-pj-04.jpg',
  '/personajes/game-pj-05.jpg',
  '/personajes/game-pj-06.jpg',
  '/personajes/game-pj-07.jpg',
  '/personajes/game-pj-08.jpg'
];

export default function SimResultadoFin({
  caso,
  escenas,
  visitados,
  respuestas,
  totalPreguntasCaso,
  totalDecisiones,
  modoLive,
  onTerminar,
  onSalir
}) {
  const titulo = tituloCasoLimpio(caso?.titulo, 'Simulación terminada');

  if (modoLive) {
    return (
      <section className="sim-player sim-fin sim-fin-juego">
        <GameDecor variant="ambient" munecos={2} />
        <GuiaBurbuja
          tono="mid"
          titulo="Cerrando práctica"
          texto="La calificación oficial se calcula en el servidor. ¡Vamos a ver tus resultados!"
          className="guia-burbuja-destacada"
        />
        <div className="sim-fin-hero">
          <div>
            <p className="sim-fin-kicker">Cerrando práctica</p>
            <h2 className="sim-fin-titulo">{titulo}</h2>
            <p className="sim-fin-texto">
              Visitaste {visitados.size} de {escenas.length} lugares.
            </p>
          </div>
        </div>
        <div className="sim-fin-equipo" aria-hidden="true">
          {EQUIPO.slice(0, 5).map((img, i) => (
            <span
              key={img}
              className="sim-fin-muneco sim-fin-bob"
              style={{ backgroundImage: `url('${img}')`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <div className="practica-resultado-acciones">
          <button
            type="button"
            className="login-btn-game green practica-btn-uniforme"
            onClick={() => (onTerminar ? onTerminar() : onSalir?.())}
          >
            Ver resultados oficiales
          </button>
        </div>
      </section>
    );
  }

  const evaluacion = calcularResultadoSimulacion({ caso, respuestas });
  const totalPreguntas = evaluacion.total || totalPreguntasCaso || totalDecisiones;
  const msg = mensajeNovaPorFraccion(evaluacion.fraccion);
  const celebracion = msg.tono === 'ok';

  return (
    <section className={`sim-player sim-fin sim-fin-juego tono-${msg.tono}`}>
      <GameDecor variant="ambient" munecos={celebracion ? 3 : 2} />

      <GuiaBurbuja fraccion={evaluacion.fraccion} className="guia-burbuja-destacada" />

      <div className="sim-fin-hero">
        <div className="sim-fin-hero-texto">
          <p className="sim-fin-kicker">Simulación terminada</p>
          <h2 className="sim-fin-titulo">{titulo}</h2>
          <p className="sim-fin-texto">
            Visitaste {visitados.size} de {escenas.length} lugares. Aciertos: {evaluacion.correctas} de{' '}
            {totalPreguntas}.
          </p>
        </div>
        <div className={`sim-fin-score ${celebracion ? 'ok' : 'mid'}`} aria-label={`Nota ${evaluacion.resultado} de 5`}>
          <span className="sim-fin-score-label">Nota</span>
          <strong className="sim-fin-score-valor">
            {evaluacion.resultado}
            <span>/5</span>
          </strong>
          <span className="sim-fin-score-sub">
            {evaluacion.correctas}/{totalPreguntas || 0}
          </span>
        </div>
      </div>

      <div className="sim-fin-equipo" aria-hidden="true">
        {EQUIPO.map((img, i) => (
          <span
            key={img}
            className={`sim-fin-muneco sim-fin-bob ${celebracion ? 'fiesta' : ''}`}
            style={{ backgroundImage: `url('${img}')`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      <div className="sim-fin-panel">
        <h3 className="sim-fin-subtitulo">{evaluacion.rubricaNombre || 'Resultado de la práctica'}</h3>
        <p className="sim-fin-texto">{evaluacion.retroalimentacion}</p>
        {evaluacion.criterios.length > 0 ? (
          <ul className="sim-fin-criterios">
            {evaluacion.criterios.map((c, i) => (
              <li key={c.nombre} className={`sim-fin-criterio tono-${(i % 4) + 1}`}>
                <strong>{c.nombre}</strong>
                <span>
                  {c.puntuacion} / {c.puntajeMaximo} - peso {c.ponderacion}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sim-fin-texto">
            Esta historia aún no tiene rúbrica guardada; se muestra solo el conteo de aciertos.
          </p>
        )}
      </div>

      <div className="practica-resultado-acciones">
        <button type="button" className="login-btn-game blue practica-btn-uniforme" onClick={onSalir}>
          Volver a historias
        </button>
      </div>
    </section>
  );
}
