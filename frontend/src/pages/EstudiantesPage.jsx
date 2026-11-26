import { useEffect, useMemo, useState } from 'react';
import {
  agregarEstudianteActividad,
  crearEstudiante,
  listarActividades,
  listarEstudiantes,
  obtenerActividad,
  retirarEstudianteActividad
} from '../api/client';
import { mensajeError } from '../utils/casoHelpers';

const formVacio = { nombres: '', apellidos: '', correo: '' };

export default function EstudiantesPage({ sesion }) {
  const { token } = sesion;
  const [estudiantes, setEstudiantes] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [actividadId, setActividadId] = useState('');
  const [convocados, setConvocados] = useState([]);
  const [form, setForm] = useState(formVacio);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    if (!q) return estudiantes;
    return estudiantes.filter((e) => {
      const texto = `${e.nombres || ''} ${e.apellidos || ''} ${e.correo || e.correoInstitucional || ''} ${e.id || ''}`
        .toLocaleLowerCase('es');
      return texto.includes(q);
    });
  }, [estudiantes, busqueda]);

  const actividadesAbiertas = useMemo(
    () =>
      (actividades || []).filter((a) =>
        ['Programada', 'Iniciada', 'EnCurso', 'En curso'].includes(a.estado)
      ),
    [actividades]
  );

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [est, acts] = await Promise.all([
        listarEstudiantes(token),
        listarActividades(token)
      ]);
      setEstudiantes(est.data || []);
      setActividades(acts.data || []);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cargarConvocados(id = actividadId) {
    if (!id) {
      setConvocados([]);
      return;
    }
    try {
      const res = await obtenerActividad(token, id);
      setConvocados(res.data?.estudiantesAutorizados || []);
    } catch {
      setConvocados([]);
    }
  }

  useEffect(() => {
    cargarConvocados(actividadId);
  }, [actividadId, token]);

  function toggle(id) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodosVisibles() {
    const ids = filtrados.map((e) => e.id);
    const todos = ids.length > 0 && ids.every((id) => seleccionados.has(id));
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todos) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function altaEstudiante(ev) {
    ev.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      await crearEstudiante(token, form);
      setForm(formVacio);
      setMensaje('Estudiante agregado al roster.');
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function convocarSeleccionados() {
    if (!actividadId) {
      setError('Elige una actividad para convocar.');
      return;
    }
    if (seleccionados.size === 0) {
      setError('Selecciona al menos un estudiante.');
      return;
    }
    setTrabajando(true);
    setError('');
    setMensaje('');
    const ids = [...seleccionados];
    let ok = 0;
    const fallos = [];
    for (const id of ids) {
      try {
        await agregarEstudianteActividad(token, actividadId, id);
        ok += 1;
      } catch (err) {
        fallos.push(`#${id}: ${mensajeError(err)}`);
      }
    }
    await cargarConvocados(actividadId);
    setTrabajando(false);
    if (ok) setMensaje(`Convocados ${ok} estudiante(s). Revisa el correo.`);
    if (fallos.length) setError(fallos.join(' - '));
  }

  async function retirar(estudianteId) {
    if (!actividadId) return;
    setTrabajando(true);
    setError('');
    try {
      await retirarEstudianteActividad(token, actividadId, estudianteId);
      await cargarConvocados(actividadId);
      setMensaje('Estudiante retirado de la convocatoria.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  const idsConvocados = useMemo(
    () => new Set((convocados || []).map((c) => Number(c.estudianteId ?? c.id))),
    [convocados]
  );

  return (
    <section className="estudiantes-page">
      <header className="crear-head" style={{ marginBottom: '1rem' }}>
        <div>
          <p className="kicker">Módulo estudiantes</p>
          <h2>Estudiantes</h2>
          <p className="muted-light">
            Agrega al roster, busca y elige quién convocar a una actividad.
          </p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={cargar} disabled={cargando}>
          Actualizar
        </button>
      </header>

      {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
      {error ? <div className="alert fade">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando estudiantes…</p> : null}

      <div className="estudiantes-grid-layout">
        <form className="panel-card estudiantes-alta" onSubmit={altaEstudiante}>
          <h3>Agregar estudiante</h3>
          <p className="muted-light">Entra solo con correo + código de convocatoria.</p>
          <label>
            Nombres
            <input
              required
              value={form.nombres}
              onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
              placeholder="Nombres"
            />
          </label>
          <label>
            Apellidos
            <input
              required
              value={form.apellidos}
              onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
              placeholder="Apellidos"
            />
          </label>
          <label>
            Correo institucional
            <input
              required
              type="email"
              value={form.correo}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
              placeholder="estudiante@institucion.edu.co"
            />
          </label>
          <button type="submit" className="btn-play" disabled={trabajando}>
            {trabajando ? 'Guardando…' : 'Agregar al roster'}
          </button>
        </form>

        <div className="panel-card estudiantes-convocar">
          <h3>Convocar a actividad</h3>
          <label>
            Actividad
            <select
              value={actividadId}
              onChange={(e) => setActividadId(e.target.value)}
            >
              <option value="">Selecciona una actividad</option>
              {actividadesAbiertas.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id} - {a.estado} - caso {a.casoId}
                </option>
              ))}
            </select>
          </label>
          <div className="estudiantes-acciones-fila">
            <button
              type="button"
              className="btn-play"
              disabled={trabajando || !actividadId || seleccionados.size === 0}
              onClick={convocarSeleccionados}
            >
              Agregar seleccionados
            </button>
            <span className="muted-light">{seleccionados.size} seleccionados</span>
          </div>

          {actividadId ? (
            <div className="estudiantes-convocados">
              <h4>Ya convocados ({convocados.length})</h4>
              {convocados.length === 0 ? (
                <p className="muted-light">Todavía no hay estudiantes en esta actividad.</p>
              ) : (
                <ul className="estudiantes-convocados-lista">
                  {convocados.map((c) => {
                    const id = Number(c.estudianteId ?? c.id);
                    const nombre = [c.nombres, c.apellidos].filter(Boolean).join(' ')
                      || c.correo
                      || `Estudiante #${id}`;
                    return (
                      <li key={id}>
                        <span>{nombre}</span>
                        <button
                          type="button"
                          className="btn-ghost-dark"
                          disabled={trabajando}
                          onClick={() => retirar(id)}
                        >
                          Retirar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel-card" style={{ marginTop: '1rem' }}>
        <div className="estudiantes-toolbar">
          <label className="estudiantes-buscar">
            Buscar estudiante
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o correo institucional"
            />
          </label>
          <button type="button" className="btn-ghost-dark" onClick={toggleTodosVisibles}>
            {filtrados.length && filtrados.every((e) => seleccionados.has(e.id))
              ? 'Quitar selección visible'
              : 'Seleccionar visibles'}
          </button>
        </div>

        <div className="casos-tabla-wrap">
          <table className="casos-tabla">
            <thead>
              <tr>
                <th>Selección</th>
                <th>Estudiante</th>
                <th>Correo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="muted-light" style={{ margin: '0.6rem 0' }}>
                      {busqueda.trim() ? 'Sin coincidencias.' : 'Aún no hay estudiantes. Agrega el primero arriba.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtrados.map((e) => {
                  const correo = e.correo || e.correoInstitucional || '—';
                  const nombre = [e.nombres, e.apellidos].filter(Boolean).join(' ') || `Estudiante #${e.id}`;
                  const ya = idsConvocados.has(Number(e.id));
                  return (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccionados.has(e.id)}
                          onChange={() => toggle(e.id)}
                          aria-label={`Seleccionar ${nombre}`}
                        />
                      </td>
                      <td>
                        <strong>{nombre}</strong>
                        <small className="muted-light"> #{e.id}</small>
                      </td>
                      <td>{correo}</td>
                      <td>{ya ? 'En la actividad' : e.activo === 0 ? 'Inactivo' : 'En roster'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
