import { portadaFondoCss } from '../data/portadas';

export default function CasosCarrusel({ titulo, casos, seleccionadoId, onSeleccionar }) {
  if (!casos?.length) {
    return (
      <section className="carrusel">
        <h2>{titulo}</h2>
        <p className="muted-light">No hay historias aquí todavía.</p>
      </section>
    );
  }

  return (
    <section className="carrusel">
      <h2>{titulo}</h2>
      <div className="carrusel-track" role="list">
        {casos.map((caso) => {
          const activo = caso.id === seleccionadoId;
          return (
            <button
              key={caso.id}
              type="button"
              role="listitem"
              className={activo ? 'caso-card activo' : 'caso-card'}
              style={{ backgroundImage: portadaFondoCss(caso) }}
              onClick={() => onSeleccionar(caso)}
            >
              {activo ? <span className="caso-check" aria-hidden="true">✓</span> : null}
              <span className="caso-card-shade" />
              <span className="caso-card-meta">
                <strong>{caso.titulo}</strong>
                <em>
                  {caso.estado === 'Publicado'
                    ? 'Lista'
                    : caso.estado === 'Archivado'
                      ? 'Archivada'
                      : 'En preparación'}
                </em>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
