import { useEffect, useState } from 'react';
import { crearEspacio, listarEspacios } from '../api/client';
import { mensajeError } from '../utils/casoHelpers';

export default function EspaciosPage({ sesion }) {
  const { token } = sesion;
  const [espacios, setEspacios] = useState([]);
  const [form, setForm] = useState({ nombre: '', codigo: '' });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const res = await listarEspacios(token);
      setEspacios(res.data || []);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e) {
    e.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const res = await crearEspacio(token, {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || undefined
      });
      setMensaje(`Espacio creado: ${res.data?.nombre || form.nombre}`);
      setForm({ nombre: '', codigo: '' });
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section className="crear-caso">
      <header className="crear-head">
        <div>
          <p className="kicker">Espacios</p>
          <h2>Espacios académicos</h2>
          <p className="muted-light">Aulas / prácticas asociadas a las actividades (Laura).</p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={cargar}>
          Actualizar
        </button>
      </header>
      {mensaje ? <div className="alert alert-ok">{mensaje}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando…</p> : null}

      <form className="crear-form" onSubmit={crear}>
        <div className="crear-grid">
          <div className="field">
            <label>Nombre</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Práctica clínica"
            />
          </div>
          <div className="field">
            <label>Código (opcional)</label>
            <input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="PRA-01"
            />
          </div>
        </div>
        <button className="btn-play" type="submit" disabled={trabajando}>
          Crear espacio
        </button>
      </form>

      <div className="panel-editor">
        <h3>Registrados ({espacios.length})</h3>
        {espacios.length === 0 ? (
          <p className="muted-light">Todavía no hay espacios.</p>
        ) : (
          <ul className="asistente-meta">
            {espacios.map((e) => (
              <li key={e.id}>
                #{e.id} · {e.nombre} {e.codigo ? `(${e.codigo})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
