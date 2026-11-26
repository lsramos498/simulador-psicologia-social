import GameDecor from '../GameDecor';
import { pillEstado } from '../../utils/casoHelpers';

function minutos(segundos) {
  if (!Number.isFinite(Number(segundos))) return '—';
  return `${Math.round(Number(segundos) / 60)} min`;
}

export default function CasosListaOrganizada({
  casos = [],
  onVer,
  onEditar,
  onCrear,
  titulo = 'Todos los casos',
  subtitulo = 'Busca, organiza y abre cada caso por estado.'
}) {
  const vacio = !casos.length;

  return (
    <section className="casos-lista-org">
      <header className="crear-head" style={{ marginBottom: '0.85rem' }}>
        <div>
          <p className="kicker">Gestión de casos</p>
          <h2>{titulo}</h2>
          <p className="muted-light">{subtitulo}</p>
        </div>
        {onCrear ? (
          <button type="button" className="btn-play" onClick={onCrear}>
            Crear caso
          </button>
        ) : null}
      </header>

      {vacio ? (
        <div className="game-empty-wrap">
          <GameDecor
            variant="empty"
            title="No hay casos en esta vista"
            text="Crea un caso o ajusta búsqueda y filtros."
          />
          {onCrear ? (
            <button type="button" className="btn-play" onClick={onCrear}>
              Crear caso
            </button>
          ) : null}
        </div>
      ) : (
        <div className="casos-tabla-wrap">
          <table className="casos-tabla">
            <thead>
              <tr>
                <th>Nombre del caso</th>
                <th>Estado</th>
                <th>Tiempo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {casos.map((caso) => {
                const editable = caso.estado === 'Borrador';
                return (
                  <tr key={caso.id}>
                    <td>
                      <strong>{caso.titulo || `Caso #${caso.id}`}</strong>
                      <small className="muted-light"> #{caso.id}</small>
                    </td>
                    <td>
                      <span className={pillEstado(caso.estado)}>{caso.estado}</span>
                    </td>
                    <td>{minutos(caso.tiempoEstimadoSegundos)}</td>
                    <td className="casos-tabla-acciones">
                      <button type="button" className="btn-ghost-dark" onClick={() => onVer?.(caso)}>
                        Ver
                      </button>
                      {editable ? (
                        <button type="button" className="btn-ghost-dark" onClick={() => onEditar?.(caso)}>
                          Editar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
