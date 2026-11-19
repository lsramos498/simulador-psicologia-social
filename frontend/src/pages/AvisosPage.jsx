import { useEffect, useState } from 'react';
import { listarNotificaciones, marcarNotificacionLeida } from '../api/client';
import { mensajeError } from '../utils/casoHelpers';

export default function AvisosPage({ sesion }) {
  const { token } = sesion;
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const res = await listarNotificaciones(token);
      setItems(res.data || []);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function marcar(id) {
    try {
      await marcarNotificacionLeida(token, id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, estado: 'Leida' } : n)));
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <section className="crear-caso">
      <header className="crear-head">
        <div>
          <p className="kicker">Avisos</p>
          <h2>Bandeja de notificaciones</h2>
          <p className="muted-light">Convocatorias y cambios de actividad (RF-21 · Laura).</p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={cargar}>
          Actualizar
        </button>
      </header>
      {error ? <div className="alert">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando avisos…</p> : null}
      <div className="panel-editor">
        {items.length === 0 ? (
          <p className="muted-light">No hay notificaciones.</p>
        ) : (
          <ul className="asistente-meta">
            {items.map((n) => (
              <li key={n.id}>
                <strong>{n.asunto || n.tipo}</strong>
                <span className="muted-light">
                  {' '}
                  · {n.estado} · {n.canal}
                </span>
                <p style={{ whiteSpace: 'pre-wrap', margin: '0.35rem 0' }}>
                  {(n.mensaje || '').slice(0, 500)}
                  {(n.mensaje || '').length > 500 ? '…' : ''}
                </p>
                {n.estado !== 'Leida' ? (
                  <button type="button" className="btn-ghost-dark" onClick={() => marcar(n.id)}>
                    Marcar leída
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
