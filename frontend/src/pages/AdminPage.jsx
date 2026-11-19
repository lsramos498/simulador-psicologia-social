import { useEffect, useState } from 'react';
import {
  adminAsignarPermiso,
  adminAsignarRol,
  adminCrearDocente,
  adminCrearEstudiante,
  adminListarPermisos,
  adminListarRoles,
  adminQuitarPermiso,
  adminQuitarRol,
  consultarSalud,
  listarActividades,
  listarCasos,
  listarEstudiantesAdmin
} from '../api/client';
import { mensajeError } from '../utils/casoHelpers';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'roles', label: 'Roles y permisos' }
];

export default function AdminPage({ sesion }) {
  const { token } = sesion;
  const [tab, setTab] = useState('resumen');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

  const [salud, setSalud] = useState(null);
  const [casos, setCasos] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);

  const [docenteForm, setDocenteForm] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    contrasena: ''
  });
  const [estForm, setEstForm] = useState({ nombres: '', apellidos: '', correo: '' });
  const [rolForm, setRolForm] = useState({ usuarioId: '', rol: 'Docente' });
  const [permForm, setPermForm] = useState({ rol: 'Docente', permiso: '' });

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const [rolesRes, permRes, estRes, casosRes, actsRes] = await Promise.all([
        adminListarRoles(token),
        adminListarPermisos(token),
        listarEstudiantesAdmin(token),
        listarCasos(token),
        listarActividades(token)
      ]);
      setRoles(rolesRes.data || []);
      setPermisos(permRes.data || []);
      setEstudiantes(estRes.data || []);
      setCasos(casosRes.data || []);
      setActividades(actsRes.data || []);
      try {
        setSalud(await consultarSalud());
      } catch {
        setSalud({ error: 'API no responde' });
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearDocente(e) {
    e.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const res = await adminCrearDocente(token, docenteForm);
      setMensaje(`Docente creado #${res.data?.id}: ${res.data?.correo}`);
      setDocenteForm({ nombres: '', apellidos: '', correo: '', contrasena: '' });
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function crearEstudiante(e) {
    e.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const res = await adminCrearEstudiante(token, estForm);
      setMensaje(`Estudiante creado #${res.data?.id}: ${res.data?.correo}`);
      setEstForm({ nombres: '', apellidos: '', correo: '' });
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function asignarRol(e) {
    e.preventDefault();
    setTrabajando(true);
    setError('');
    try {
      await adminAsignarRol(token, Number(rolForm.usuarioId), rolForm.rol);
      setMensaje(`Rol ${rolForm.rol} asignado al usuario #${rolForm.usuarioId}.`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function quitarRol() {
    setTrabajando(true);
    setError('');
    try {
      await adminQuitarRol(token, Number(rolForm.usuarioId), rolForm.rol);
      setMensaje(`Rol ${rolForm.rol} quitado del usuario #${rolForm.usuarioId}.`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function togglePermiso(rol, permiso, tiene) {
    setTrabajando(true);
    setError('');
    try {
      if (tiene) await adminQuitarPermiso(token, rol, permiso);
      else await adminAsignarPermiso(token, rol, permiso);
      setMensaje(`${tiene ? 'Quitado' : 'Asignado'} ${permiso} en ${rol}.`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  const publicados = casos.filter((c) => c.estado === 'Publicado').length;
  const iniciadas = actividades.filter((a) => a.estado === 'Iniciada').length;

  return (
    <section className="crear-caso">
      <header className="crear-head">
        <div>
          <p className="kicker">Administración</p>
          <h2>Consola del sistema</h2>
          <p className="muted-light">Usuarios, roles, permisos y vista global (RF-03 · Sofía).</p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={cargar} disabled={cargando}>
          Actualizar
        </button>
      </header>

      <div className="editor-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={tab === t.id ? 'tab activo' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
      {error ? <div className="alert fade">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando consola…</p> : null}

      {tab === 'resumen' ? (
        <div className="panel-editor">
          <div className="crear-grid">
            <article className="nodo-escena">
              <strong>API</strong>
              <p className="muted-light">
                {salud?.error || salud?.status || salud?.data?.status || 'ok'}
              </p>
            </article>
            <article className="nodo-escena">
              <strong>Casos</strong>
              <p>
                {casos.length} total · {publicados} publicados
              </p>
            </article>
            <article className="nodo-escena">
              <strong>Actividades</strong>
              <p>
                {actividades.length} total · {iniciadas} iniciadas
              </p>
            </article>
            <article className="nodo-escena">
              <strong>Estudiantes</strong>
              <p>{estudiantes.length} registrados</p>
            </article>
          </div>

          <h3>Últimas actividades</h3>
          {(actividades || []).length === 0 ? (
            <div className="empty-state soft">
              <strong>Sin actividades todavía</strong>
              <p className="muted-light">Cuando docentes programen prácticas, aparecerán aquí.</p>
            </div>
          ) : (
            (actividades || []).slice(0, 8).map((a) => (
              <article key={a.id} className="nodo-escena">
                <strong>
                  #{a.id} · {a.estado}
                </strong>
                <p className="muted-light">
                  Caso {a.casoId} · Docente {a.docenteId} · {a.fechaInicio} → {a.fechaFin}
                </p>
              </article>
            ))
          )}
        </div>
      ) : null}

      {tab === 'usuarios' ? (
        <div className="panel-editor">
          <form className="crear-form" onSubmit={crearDocente}>
            <h3>Crear docente</h3>
            <div className="crear-grid">
              <div className="field">
                <label>Nombres</label>
                <input
                  required
                  value={docenteForm.nombres}
                  onChange={(e) => setDocenteForm({ ...docenteForm, nombres: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Apellidos</label>
                <input
                  required
                  value={docenteForm.apellidos}
                  onChange={(e) => setDocenteForm({ ...docenteForm, apellidos: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Correo</label>
                <input
                  type="email"
                  required
                  value={docenteForm.correo}
                  onChange={(e) => setDocenteForm({ ...docenteForm, correo: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={docenteForm.contrasena}
                  onChange={(e) => setDocenteForm({ ...docenteForm, contrasena: e.target.value })}
                  placeholder="Mín. 8, letra y número"
                />
              </div>
            </div>
            <button className="btn-play" type="submit" disabled={trabajando}>
              Crear docente
            </button>
          </form>

          <form className="crear-form" onSubmit={crearEstudiante} style={{ marginTop: '1.5rem' }}>
            <h3>Crear estudiante</h3>
            <div className="crear-grid">
              <div className="field">
                <label>Nombres</label>
                <input
                  required
                  value={estForm.nombres}
                  onChange={(e) => setEstForm({ ...estForm, nombres: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Apellidos</label>
                <input
                  required
                  value={estForm.apellidos}
                  onChange={(e) => setEstForm({ ...estForm, apellidos: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Correo</label>
                <input
                  type="email"
                  required
                  value={estForm.correo}
                  onChange={(e) => setEstForm({ ...estForm, correo: e.target.value })}
                />
              </div>
            </div>
            <button className="btn-play" type="submit" disabled={trabajando}>
              Crear estudiante
            </button>
          </form>

          <h3 style={{ marginTop: '1.5rem' }}>Estudiantes ({estudiantes.length})</h3>
          {estudiantes.length === 0 ? (
            <div className="empty-state soft">
              <strong>Sin estudiantes</strong>
              <p className="muted-light">Creá uno arriba para poder convocar prácticas.</p>
            </div>
          ) : (
            <ul className="asistente-meta">
              {estudiantes.map((est) => (
                <li key={est.id}>
                  #{est.id} · {est.nombres} {est.apellidos} · {est.correo}
                  {est.activo === 0 || est.activo === false ? ' · inactivo' : ''}
                  {' · '}
                  <button
                    type="button"
                    className="btn-ghost-dark"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(est.id));
                        setMensaje(`ID ${est.id} copiado. Podés usarlo en Asignar rol.`);
                        setRolForm((prev) => ({ ...prev, usuarioId: String(est.id) }));
                      } catch {
                        setRolForm((prev) => ({ ...prev, usuarioId: String(est.id) }));
                      }
                    }}
                  >
                    Usar ID
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="crear-form" onSubmit={asignarRol} style={{ marginTop: '1.5rem' }}>
            <h3>Asignar / quitar rol</h3>
            <div className="crear-grid">
              <div className="field">
                <label>ID de usuario</label>
                <input
                  required
                  value={rolForm.usuarioId}
                  onChange={(e) => setRolForm({ ...rolForm, usuarioId: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Rol</label>
                <select
                  value={rolForm.rol}
                  onChange={(e) => setRolForm({ ...rolForm, rol: e.target.value })}
                >
                  <option>Administrador</option>
                  <option>Docente</option>
                  <option>Estudiante</option>
                </select>
              </div>
            </div>
            <div className="ficha-acciones">
              <button className="btn-play" type="submit" disabled={trabajando}>
                Asignar
              </button>
              <button
                className="btn-ghost-dark"
                type="button"
                disabled={trabajando}
                onClick={quitarRol}
              >
                Quitar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {tab === 'roles' ? (
        <div className="panel-editor">
          <h3>Matriz rol ↔ permiso</h3>
          {roles.map((rol) => {
            const tiene = new Set(rol.permisos || []);
            return (
              <article key={rol.nombre} className="nodo-escena">
                <strong>{rol.nombre}</strong>
                <div className="asistente-ejemplos" style={{ marginTop: '0.6rem' }}>
                  {permisos.map((p) => {
                    const nombre = p.nombre || p;
                    const activo = tiene.has(nombre);
                    return (
                      <button
                        key={nombre}
                        type="button"
                        className={activo ? 'chip-ejemplo tab activo' : 'chip-ejemplo'}
                        disabled={trabajando}
                        title={p.descripcion || nombre}
                        onClick={() => togglePermiso(rol.nombre, nombre, activo)}
                      >
                        {activo ? '✓ ' : ''}
                        {nombre}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}

          <form
            className="crear-form"
            style={{ marginTop: '1rem' }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!permForm.permiso) return;
              await togglePermiso(permForm.rol, permForm.permiso, false);
            }}
          >
            <h3>Asignar permiso manual</h3>
            <div className="crear-grid">
              <div className="field">
                <label>Rol</label>
                <select
                  value={permForm.rol}
                  onChange={(e) => setPermForm({ ...permForm, rol: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.nombre} value={r.nombre}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Permiso</label>
                <select
                  value={permForm.permiso}
                  onChange={(e) => setPermForm({ ...permForm, permiso: e.target.value })}
                >
                  <option value="">Elegir…</option>
                  {permisos.map((p) => (
                    <option key={p.nombre || p} value={p.nombre || p}>
                      {p.nombre || p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn-play" type="submit" disabled={trabajando || !permForm.permiso}>
              Asignar permiso
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
