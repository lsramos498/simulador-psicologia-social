import { useEffect, useMemo, useState } from 'react';
import { listarNotificaciones, marcarNotificacionLeida } from '../api/client';
import { mensajeError } from '../utils/casoHelpers';

export default function AvisosPage({ sesion }) {
  const { token } = sesion;
  const [items, setItems] = useState([]);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

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

  async function marcarTodas() {
    const pendientes = items.filter((n) => n.estado !== 'Leida');
    if (!pendientes.length) return;
    setTrabajando(true);
    setError('');
    try {
      await Promise.all(pendientes.map((n) => marcarNotificacionLeida(token, n.id)));
      setItems((prev) => prev.map((n) => ({ ...n, estado: 'Leida' })));
      setMensaje(`${pendientes.length} aviso(s) marcados como leídos.`);
    } catch (err) {
      setError(mensajeError(err));
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  const visibles = useMemo(
    () => (soloNoLeidas ? items.filter((n) => n.estado !== 'Leida') : items),
    [items, soloNoLeidas]
  );
  const noLeidas = items.filter((n) => n.estado !== 'Leida').length;

  return (
    <section className="crear-caso">
      <header className="crear-head">
        <div>
          <p className="kicker">Avisos</p>
          <h2>Bandeja de notificaciones</h2>
          <p className="muted-light">
            Convocatorias y cambios de actividad
            {noLeidas ? ` · ${noLeidas} sin leer` : ''}.
          </p>
        </div>
        <div className="ficha-acciones">
          <button
            type="button"
            className={soloNoLeidas ? 'btn-play' : 'btn-ghost-dark'}
            onClick={() => setSoloNoLeidas((v) => !v)}
          >
            {soloNoLeidas ? 'Ver todas' : 'Solo no leídas'}
          </button>
          {noLeidas > 0 ? (
            <button
              type="button"
              className="btn-ghost-dark"
              disabled={trabajando}
              onClick={marcarTodas}
            >
              Marcar todas leídas
            </button>
          ) : null}
          <button type="button" className="btn-ghost-dark" onClick={cargar}>
            Actualizar
          </button>
        </div>
      </header>
      {mensaje ? <div className="alert alert-ok">{mensaje}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando avisos…</p> : null}
      <div className="panel-editor">
        {visibles.length === 0 ? (
          <div className="empty-state">
            <strong>{soloNoLeidas ? 'No hay avisos sin leer' : 'Bandeja vacía'}</strong>
            <p className="muted-light">
              Cuando haya convocatorias o cambios de actividad, aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="asistente-meta">
            {visibles.map((n) => (
              <li key={n.id} className={n.estado !== 'Leida' ? 'aviso-nuevo' : undefined}>
                <strong>{n.asunto || n.tipo}</strong>
                <span className="muted-light">
                  {' '}
                  · {n.estado} · {n.canal}
                  {n.actividadId != null ? ` · actividad #${n.actividadId}` : ''}
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
