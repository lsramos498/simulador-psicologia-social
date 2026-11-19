import { useEffect, useState } from 'react';
import {
  cerrarSesionDocente,
  consultarProgresoSesion,
  consultarRespuestasSesion,
  consultarRetroalimentacionSesion,
  listarActividades,
  monitorearSesionesActividad,
  obtenerSesion
} from '../api/client';
import { mensajeError } from '../utils/casoHelpers';

export default function SeguimientoPage({ sesion }) {
  const { token } = sesion;
  const [actividades, setActividades] = useState([]);
  const [actividadId, setActividadId] = useState('');
  const [sesiones, setSesiones] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

  async function cargarActividades() {
    setCargando(true);
    setError('');
    try {
      const res = await listarActividades(token);
      const lista = res.data || [];
      setActividades(lista);
      if (!actividadId && lista[0]) {
        setActividadId(String(lista[0].id));
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function cargarSesiones(id = actividadId) {
    if (!id) {
      setSesiones([]);
      return;
    }
    setTrabajando(true);
    setError('');
    try {
      const res = await monitorearSesionesActividad(token, id);
      setSesiones(res.data || []);
      setDetalle(null);
    } catch (err) {
      setError(mensajeError(err));
      setSesiones([]);
    } finally {
      setTrabajando(false);
    }
  }

  useEffect(() => {
    cargarActividades();
  }, []);

  useEffect(() => {
    if (actividadId) cargarSesiones(actividadId);
  }, [actividadId]);

  async function verDetalle(sesionId) {
    setTrabajando(true);
    setError('');
    try {
      const [ses, prog, resp, retro] = await Promise.all([
        obtenerSesion(token, sesionId),
        consultarProgresoSesion(token, sesionId).catch(() => null),
        consultarRespuestasSesion(token, sesionId).catch(() => null),
        consultarRetroalimentacionSesion(token, sesionId).catch(() => null)
      ]);
      setDetalle({
        sesion: ses.data?.sesion || ses.data,
        evaluacion: ses.data?.evaluacion || null,
        progreso: prog?.data || null,
        respuestas: resp?.data || [],
        retro: Array.isArray(retro?.data) ? retro.data : retro?.data || []
      });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function cerrar(sesionId) {
    if (!window.confirm('¿Cerrar la sesión de este estudiante?')) return;
    setTrabajando(true);
    setError('');
    try {
      await cerrarSesionDocente(token, sesionId);
      setMensaje(`Sesión #${sesionId} cerrada.`);
      await cargarSesiones();
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
          <p className="kicker">Docente</p>
          <h2>Seguimiento en vivo</h2>
          <p className="muted-light">
            Monitorea sesiones, progreso y respuestas (Laura · Valeria).
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost-dark"
          disabled={trabajando || !actividadId}
          onClick={() => cargarSesiones()}
        >
          Actualizar
        </button>
      </header>

      {mensaje ? <div className="alert alert-ok">{mensaje}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando actividades…</p> : null}

      <div className="field">
        <label>Actividad</label>
        <select value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
          <option value="">Elegir actividad</option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>
              #{a.id} · {a.estado} · caso {a.casoId}
            </option>
          ))}
        </select>
      </div>

      <div className="panel-editor">
        <h3>Sesiones ({sesiones.length})</h3>
        {sesiones.length === 0 ? (
          <p className="muted-light">
            No hay sesiones aún. Iniciá la actividad para preparar las de los convocados.
          </p>
        ) : (
          <div className="arbol-escenas">
            {sesiones.map((s) => (
              <article key={s.id} className="nodo-escena">
                <header>
                  <strong>
                    #{s.id} · {s.nombres} {s.apellidos}
                  </strong>
                  <p className="muted-light">
                    {s.correo || `Estudiante #${s.estudianteId}`} · {s.estado}
                    {s.numeroIntento ? ` · intento ${s.numeroIntento}` : ''}
                  </p>
                </header>
                <div className="ficha-acciones">
                  <button
                    type="button"
                    className="btn-play"
                    disabled={trabajando}
                    onClick={() => verDetalle(s.id)}
                  >
                    Ver detalle
                  </button>
                  {s.estado !== 'Finalizado' ? (
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      disabled={trabajando}
                      onClick={() => cerrar(s.id)}
                    >
                      Cerrar sesión
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {detalle ? (
        <div className="panel-editor">
          <h3>
            Detalle sesión #{detalle.sesion?.id} · {detalle.sesion?.estado}
          </h3>
          {detalle.evaluacion?.resultado != null ? (
            <p className="sim-nota">
              Nota oficial: <strong>{detalle.evaluacion.resultado}</strong>
            </p>
          ) : null}
          {detalle.progreso ? (
            <p className="muted-light">
              Progreso: {detalle.progreso.preguntasRespondidas ?? detalle.progreso.respondidas ?? 0}
              {detalle.progreso.totalPreguntas != null
                ? ` / ${detalle.progreso.totalPreguntas}`
                : ''}
              {detalle.progreso.preguntasPendientes != null
                ? ` · pendientes ${detalle.progreso.preguntasPendientes}`
                : ''}
            </p>
          ) : null}
          <h4>Respuestas</h4>
          {(detalle.respuestas || []).length === 0 ? (
            <p className="muted-light">Sin respuestas registradas.</p>
          ) : (
            <ul className="asistente-meta">
              {(Array.isArray(detalle.respuestas) ? detalle.respuestas : []).map((r, idx) => (
                <li key={r.id || idx}>
                  Decisión {r.decisionId}: opción {r.opcionId}
                  {r.esCorrecta != null ? (r.esCorrecta ? ' · correcta' : ' · incorrecta') : ''}
                </li>
              ))}
            </ul>
          )}
          {(Array.isArray(detalle.retro) ? detalle.retro : []).length > 0 ? (
            <>
              <h4>Retroalimentación</h4>
              <ul className="asistente-meta">
                {detalle.retro.map((item, idx) => (
                  <li key={item.id || idx}>
                    {item.pregunta || `Decisión ${item.decisionId}`}:{' '}
                    {item.explicacion || item.texto || item.opcionTexto || '—'}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
