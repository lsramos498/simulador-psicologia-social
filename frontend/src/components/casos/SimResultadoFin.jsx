import { calcularResultadoSimulacion } from '../../utils/rubricaArchivo';

const GUIA = {
  nombre: 'Nova',
  imagen: '/personajes/game-guia.jpg'
};

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
  if (modoLive) {
    return (
      <section className="sim-player sim-fin">
        <p className="kicker">Cerrando práctica…</p>
        <h2>{caso.titulo}</h2>
        <p className="muted-light">
          Visitaste {visitados.size} de {escenas.length} lugares. La calificación oficial se calcula en el
          servidor.
        </p>
        <button
          type="button"
          className="btn-play"
          onClick={() => (onTerminar ? onTerminar() : onSalir?.())}
        >
          Ver resultados oficiales
        </button>
      </section>
    );
  }

  const evaluacion = calcularResultadoSimulacion({ caso, respuestas });

  return (
    <section className="sim-player sim-fin">
      <p className="kicker">Simulación terminada</p>
      <h2>{caso.titulo}</h2>
      <p>
        Visitaste {visitados.size} de {escenas.length} lugares. Aciertos: {evaluacion.correctas} de{' '}
        {evaluacion.total || totalPreguntasCaso || totalDecisiones}.
      </p>

      <div className="sim-resultado-rubrica">
        <h3>{evaluacion.rubricaNombre || 'Resultado de la práctica'}</h3>
        <p className="sim-nota">
          Nota estimada (vista previa docente): <strong>{evaluacion.resultado}</strong>
        </p>
        <p className="muted-light">{evaluacion.retroalimentacion}</p>
        {evaluacion.criterios.length > 0 ? (
          <ul className="sim-criterios">
            {evaluacion.criterios.map((c) => (
              <li key={c.nombre}>
                <strong>{c.nombre}</strong>
                <span>
                  {c.puntuacion} / {c.puntajeMaximo} · peso {c.ponderacion}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-light">
            Esta historia aún no tiene rúbrica guardada; se muestra solo el conteo de aciertos.
          </p>
        )}
      </div>

      <div className="sim-guia-card">
        <span className="sim-guia-foto" style={{ backgroundImage: `url('${GUIA.imagen}')` }} />
        <div>
          <strong>{GUIA.nombre}</strong>
          <p>
            {evaluacion.fraccion >= 0.7
              ? 'Muy bien: contrastaste versiones y elegiste intervenciones cuidadas.'
              : 'Buen intento. La próxima vez pregunta más y contrasta antes de decidir.'}
          </p>
        </div>
      </div>
      <button type="button" className="btn-play" onClick={onSalir}>
        Volver a historias
      </button>
    </section>
  );
}
