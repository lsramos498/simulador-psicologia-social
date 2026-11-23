export default function PracticaResultado({ caso, evaluacion, retroItems, onSalir }) {
  return (
    <section className="sim-player sim-fin practica-panel">
      <p className="kicker">Práctica finalizada</p>
      <h2>{caso?.titulo || 'Sesión terminada'}</h2>
      {evaluacion?.resultado != null ? (
        <p className="sim-nota">
          Nota: <strong>{evaluacion.resultado}</strong>
        </p>
      ) : null}
      {evaluacion?.retroalimentacionGeneral ? <p>{evaluacion.retroalimentacionGeneral}</p> : null}
      {evaluacion?.comentarioDocente ? (
        <div className="sim-resultado-rubrica">
          <h3>Comentario docente</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{evaluacion.comentarioDocente}</p>
        </div>
      ) : null}
      {retroItems.length > 0 ? (
        <div className="sim-resultado-rubrica">
          <h3>Retroalimentación</h3>
          <ul className="sim-criterios">
            {retroItems.map((item) => (
              <li key={item.key}>
                <strong>{item.titulo}</strong>
                <span>{item.detalle}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted-light">No hay detalle de retroalimentación para esta sesión.</p>
      )}
      <button type="button" className="login-btn-game blue" style={{ maxWidth: '16rem' }} onClick={onSalir}>
        Salir
      </button>
    </section>
  );
}
