import { useEffect, useMemo, useState } from 'react';
import {
  agregarEstudianteActividad,
  asignarEstudiantesGrupo,
  crearEstudiante,
  crearEstudiantesLote,
  crearGrupo,
  listarActividades,
  listarEstudiantes,
  listarGrupos,
  obtenerActividad,
  obtenerGrupo,
  retirarEstudianteActividad,
  retirarEstudianteGrupo
} from '../api/client';
import GameDecor from '../components/GameDecor';
import { mensajeError } from '../utils/casoHelpers';
import { extraerTextoPdf } from '../utils/pdfTexto';
import { limpiarNombreVisible } from '../utils/textoUtf8';

const formEst = { nombres: '', apellidos: '', correo: '' };
const formGrupo = { nombre: '', codigo: '', descripcion: '' };

export default function GruposEstudiantesPage({ sesion }) {
  const { token } = sesion;
  const [tab, setTab] = useState('grupos');
  const [estudiantes, setEstudiantes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState('');
  const [grupoDetalle, setGrupoDetalle] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [actividadId, setActividadId] = useState('');
  const [convocados, setConvocados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [form, setForm] = useState(formEst);
  const [nuevoGrupo, setNuevoGrupo] = useState(formGrupo);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    if (!q) return estudiantes;
    return estudiantes.filter((e) => {
      const texto = `${e.nombres || ''} ${e.apellidos || ''} ${e.correo || ''} ${e.id || ''}`
        .toLocaleLowerCase('es');
      return texto.includes(q);
    });
  }, [estudiantes, busqueda]);

  const actividadesAbiertas = useMemo(
    () => (actividades || []).filter((a) => ['Programada', 'Iniciada'].includes(a.estado)),
    [actividades]
  );

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [est, acts, gr] = await Promise.all([
        listarEstudiantes(token),
        listarActividades(token),
        listarGrupos(token)
      ]);
      setEstudiantes(est.data || []);
      setActividades(acts.data || []);
      setGrupos(gr.data || []);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!grupoId) {
      setGrupoDetalle(null);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const res = await obtenerGrupo(token, grupoId);
        if (vivo) setGrupoDetalle(res.data);
      } catch {
        if (vivo) setGrupoDetalle(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [grupoId, token]);

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

  async function altaUno(ev) {
    ev.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      await crearEstudiante(token, form);
      setForm(formEst);
      setMensaje('Estudiante agregado.');
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function altaPdf(ev) {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const texto = await extraerTextoPdf(archivo);
      const res = await crearEstudiantesLote(token, texto);
      const d = res.data || {};
      setMensaje(
        `Lista cargada: ${d.totalCreados || 0} creados` +
          (d.totalOmitidos ? `, ${d.totalOmitidos} omitidos (ya existían u error).` : '.')
      );
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function crearGrupoSubmit(ev) {
    ev.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const res = await crearGrupo(token, {
        ...nuevoGrupo,
        nombre: limpiarNombreVisible(nuevoGrupo.nombre)
      });
      setNuevoGrupo(formGrupo);
      setMensaje(`Grupo «${res.data?.nombre}» creado.`);
      await cargar();
      if (res.data?.id) setGrupoId(String(res.data.id));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function asignarSeleccionAlGrupo() {
    if (!grupoId) {
      setError('Elige un grupo.');
      return;
    }
    if (seleccionados.size === 0) {
      setError('Selecciona estudiantes del roster.');
      return;
    }
    setTrabajando(true);
    setError('');
    try {
      const res = await asignarEstudiantesGrupo(token, grupoId, [...seleccionados]);
      setGrupoDetalle(res.data);
      setMensaje('Estudiantes asignados al grupo.');
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function quitarDelGrupo(estudianteId) {
    setTrabajando(true);
    try {
      const res = await retirarEstudianteGrupo(token, grupoId, estudianteId);
      setGrupoDetalle(res.data);
      setMensaje('Estudiante retirado del grupo.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function convocarSeleccionados() {
    const ids = seleccionados.size
      ? [...seleccionados]
      : (grupoDetalle?.estudiantes || []).map((e) => e.id);
    if (!actividadId) {
      setError('Elige una actividad.');
      return;
    }
    if (!ids.length) {
      setError('Selecciona estudiantes o usa un grupo con miembros.');
      return;
    }
    setTrabajando(true);
    setError('');
    setMensaje('');
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
    if (ok) setMensaje(`Convocados ${ok}. Revisa correos.`);
    if (fallos.length) setError(fallos.slice(0, 3).join(' - '));
  }

  async function convocarGrupoCompleto() {
    if (!grupoId || !grupoDetalle?.estudiantes?.length) {
      setError('El grupo no tiene estudiantes.');
      return;
    }
    setSeleccionados(new Set(grupoDetalle.estudiantes.map((e) => e.id)));
    await convocarSeleccionados();
  }

  return (
    <section className="ge-page">
      <GameDecor variant="ambient" munecos={3} />
      <header className="crear-head ge-page-head">
        <div>
          <p className="kicker">Gestión académica</p>
          <h2>Grupos y estudiantes</h2>
          <p className="muted-light">
            Conforma grupos, carga listas por PDF y convoca a actividades.
          </p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={cargar} disabled={cargando}>
          Actualizar
        </button>
      </header>

      <div className="ge-tabs" role="tablist" aria-label="Secciones">
        <button type="button" role="tab" aria-selected={tab === 'grupos'} className={tab === 'grupos' ? 'ge-tab activo' : 'ge-tab'} onClick={() => setTab('grupos')}>
          Grupos
        </button>
        <button type="button" role="tab" aria-selected={tab === 'estudiantes'} className={tab === 'estudiantes' ? 'ge-tab activo' : 'ge-tab'} onClick={() => setTab('estudiantes')}>
          Estudiantes
        </button>
        <button type="button" role="tab" aria-selected={tab === 'convocar'} className={tab === 'convocar' ? 'ge-tab activo' : 'ge-tab'} onClick={() => setTab('convocar')}>
          Convocar
        </button>
      </div>

      {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
      {error ? <div className="alert fade">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando…</p> : null}

      {tab === 'grupos' ? (
        <div className="ge-grid">
          <form className="ge-card" onSubmit={crearGrupoSubmit}>
            <h3>Crear grupo</h3>
            <div className="field">
              <label htmlFor="ge-nombre">Nombre</label>
              <input
                id="ge-nombre"
                required
                value={nuevoGrupo.nombre}
                onChange={(e) => setNuevoGrupo((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Grupo A - Primer semestre"
              />
            </div>
            <div className="field">
              <label htmlFor="ge-codigo">Código (opcional)</label>
              <input
                id="ge-codigo"
                value={nuevoGrupo.codigo}
                onChange={(e) => setNuevoGrupo((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="PS-1A"
              />
            </div>
            <div className="field">
              <label htmlFor="ge-desc">Descripción</label>
              <textarea
                id="ge-desc"
                rows={3}
                value={nuevoGrupo.descripcion}
                onChange={(e) => setNuevoGrupo((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Espacio académico / cohorte"
              />
            </div>
            <button type="submit" className="btn-play ge-btn-block" disabled={trabajando}>
              Crear grupo
            </button>
          </form>

          <div className="ge-card">
            <h3>Tus grupos ({grupos.length})</h3>
            <div className="field">
              <label htmlFor="ge-activo">Grupo activo</label>
              <select id="ge-activo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="">Selecciona</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {limpiarNombreVisible(g.nombre)} - {g.totalEstudiantes || 0} est.
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-play ge-btn-block"
              disabled={trabajando || !grupoId || seleccionados.size === 0}
              onClick={asignarSeleccionAlGrupo}
            >
              Asignar seleccionados al grupo
            </button>
            <p className="muted-light ge-hint">
              {seleccionados.size
                ? `${seleccionados.size} estudiante(s) seleccionados en la pestaña Estudiantes.`
                : 'Marca estudiantes en la pestaña Estudiantes y asígnalos aquí.'}
            </p>

            {grupoDetalle ? (
              <div className="ge-miembros">
                <h4>Miembros de {grupoDetalle.nombre}</h4>
                {(grupoDetalle.estudiantes || []).length === 0 ? (
                  <GameDecor
                    variant="empty"
                    munecos={2}
                    title="Sin estudiantes aún"
                    text="Agrega alumnos o importa una lista para armar el grupo."
                  />
                ) : (
                  <ul className="ge-lista">
                    {grupoDetalle.estudiantes.map((e) => (
                      <li key={e.id}>
                        <div>
                          <strong>
                            {e.nombres} {e.apellidos}
                          </strong>
                          <small className="muted-light">{e.correo}</small>
                        </div>
                        <button type="button" className="btn-ghost-dark" onClick={() => quitarDelGrupo(e.id)}>
                          Sacar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'estudiantes' ? (
        <div className="ge-stack">
          <div className="ge-grid">
            <form className="ge-card" onSubmit={altaUno}>
              <h3>Agregar uno</h3>
              <div className="field">
                <label htmlFor="est-nombres">Nombres</label>
                <input id="est-nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="est-apellidos">Apellidos</label>
                <input id="est-apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="est-correo">Correo</label>
                <input id="est-correo" required type="email" value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} />
              </div>
              <button type="submit" className="btn-play ge-btn-block" disabled={trabajando}>
                Guardar
              </button>
            </form>

            <div className="ge-card ge-card-pdf">
              <h3>Subir lista PDF</h3>
              <p className="muted-light">
                El PDF debe incluir correos. Ejemplo: <em>Ana Pérez, ana@uni.edu.co</em>
              </p>
              <label className="ge-file-btn">
                {trabajando ? 'Procesando…' : 'Elegir PDF'}
                <input type="file" accept="application/pdf,.pdf" hidden onChange={altaPdf} disabled={trabajando} />
              </label>
            </div>
          </div>

          <div className="ge-card">
            <div className="ge-toolbar">
              <div className="field ge-buscar">
                <label htmlFor="est-buscar">Buscar</label>
                <input
                  id="est-buscar"
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o correo"
                />
              </div>
              <p className="muted-light ge-sel-count">{seleccionados.size} seleccionados</p>
            </div>
            <div className="casos-tabla-wrap">
              <table className="casos-tabla">
                <thead>
                  <tr>
                    <th>Sel.</th>
                    <th>Estudiante</th>
                    <th>Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <p className="muted-light" style={{ margin: '0.5rem 0' }}>
                          No hay estudiantes. Agrega uno o sube un PDF.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <input type="checkbox" checked={seleccionados.has(e.id)} onChange={() => toggle(e.id)} />
                        </td>
                        <td>
                          <strong>
                            {e.nombres} {e.apellidos}
                          </strong>{' '}
                          <small className="muted-light">#{e.id}</small>
                        </td>
                        <td>{e.correo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'convocar' ? (
        <div className="ge-card ge-card-wide">
          <h3>Convocar a actividad</h3>
          <div className="ge-grid ge-grid-inner">
            <div className="field">
              <label htmlFor="conv-act">Actividad</label>
              <select id="conv-act" value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
                <option value="">Selecciona</option>
                {actividadesAbiertas.map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.id} - {a.estado} - caso {a.casoId}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="conv-grupo">O usar grupo completo</label>
              <select id="conv-grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="">—</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ge-acciones">
            <button type="button" className="btn-play" disabled={trabajando} onClick={convocarSeleccionados}>
              Convocar seleccionados
            </button>
            <button type="button" className="btn-ghost-dark" disabled={trabajando} onClick={convocarGrupoCompleto}>
              Convocar grupo entero
            </button>
          </div>
          <div className="ge-miembros">
            <h4>Ya en la actividad ({convocados.length})</h4>
            {convocados.length === 0 ? (
              <GameDecor
                variant="empty"
                munecos={2}
                title="Todavía no hay convocados"
                text="Elige una actividad y suma estudiantes para la partida."
              />
            ) : (
              <ul className="ge-lista">
                {convocados.map((c) => {
                  const id = Number(c.estudianteId ?? c.id);
                  return (
                    <li key={id}>
                      <span>
                        {c.nombres} {c.apellidos}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost-dark"
                        disabled={trabajando}
                        onClick={async () => {
                          setTrabajando(true);
                          setError('');
                          try {
                            await retirarEstudianteActividad(token, actividadId, id);
                            setMensaje(`Estudiante #${id} retirado.`);
                            await cargarConvocados(actividadId);
                          } catch (err) {
                            setError(mensajeError(err));
                          } finally {
                            setTrabajando(false);
                          }
                        }}
                      >
                        Retirar
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
