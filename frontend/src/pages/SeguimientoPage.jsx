import { useEffect, useState } from 'react';
import {
  autorizarRepeticion,
  cerrarSesionDocente,
  consultarProgresoSesion,
  consultarRespuestasSesion,
  consultarRetroalimentacionSesion,
  descargarReporteParticipacion,
  guardarComentarioDocente,
  listarActividades,
  monitorearSesionesActividad,
  obtenerActividad,
  obtenerCaso,
  obtenerSesion
} from '../api/client';
import GameDecor from '../components/GameDecor';
import { mensajeError } from '../utils/casoHelpers';
import { enriquecerRespuestas } from '../utils/casoPreguntas';
import { esAdministrador, esDocente } from '../utils/roles';

export default function SeguimientoPage({ sesion, onIrActividades }) {
  const { token } = sesion;
  const [actividades, setActividades] = useState([]);
  const [actividadId, setActividadId] = useState('');
  const [actividadDetalle, setActividadDetalle] = useState(null);
  const [casoTitulo, setCasoTitulo] = useState('');
  const [sesiones, setSesiones] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [comentario, setComentario] = useState('');

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

  async function cargarSesiones(id = actividadId, { silencioso = false } = {}) {
    if (!id) {
      setSesiones([]);
      setActividadDetalle(null);
      setCasoTitulo('');
      return;
    }
    if (!silencioso) setTrabajando(true);
    if (!silencioso) setError('');
    try {
      const [mon, act] = await Promise.all([
        monitorearSesionesActividad(token, id),
        obtenerActividad(token, id).catch(() => null)
      ]);
      setSesiones(mon.data || []);
      const detalleAct = act?.data || null;
      setActividadDetalle(detalleAct);
      if (detalleAct?.casoId) {
        try {
          const c = await obtenerCaso(token, detalleAct.casoId);
          setCasoTitulo(c.data?.titulo || '');
        } catch {
          setCasoTitulo('');
        }
      } else {
        setCasoTitulo('');
      }
      if (!silencioso) setDetalle(null);
    } catch (err) {
      if (!silencioso) {
        setError(mensajeError(err));
        setSesiones([]);
      }
    } finally {
      if (!silencioso) setTrabajando(false);
    }
  }

  useEffect(() => {
    cargarActividades();
  }, []);

  useEffect(() => {
    if (actividadId) cargarSesiones(actividadId);
  }, [actividadId]);

  useEffect(() => {
    if (!actividadId) return undefined;
    const timer = setInterval(() => {
      cargarSesiones(actividadId, { silencioso: true });
    }, 12_000);
    return () => clearInterval(timer);
  }, [actividadId]);

  async function verDetalle(sesionId) {
    setTrabajando(true);
    setError('');
    try {
      const [ses, prog, resp, retro] = await Promise.all([
        obtenerSesion(token, sesionId),
        consultarProgresoSesion(token, sesionId).catch(() => null),
        consultarRespuestasSesion(token, sesionId),
        consultarRetroalimentacionSesion(token, sesionId).catch(() => null)
      ]);
      const sesionData = ses.data?.sesion || ses.data;
      let caso = null;
      const casoId = sesionData?.casoId || actividadDetalle?.casoId;
      if (casoId) {
        try {
          const c = await obtenerCaso(token, casoId);
          caso = c.data;
        } catch {
          caso = null;
        }
      }
      const crudas = Array.isArray(resp?.data) ? resp.data : [];
      setComentario(ses.data?.evaluacion?.comentarioDocente ?? '');
      setDetalle({
        sesion: sesionData,
        evaluacion: ses.data?.evaluacion || null,
        progreso: prog?.data || null,
        respuestas: enriquecerRespuestas(crudas, caso),
        retro: Array.isArray(retro?.data) ? retro.data : retro?.data || []
      });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function guardarComentario(evento) {
    evento.preventDefault();
    const sesionId = detalle.sesion.id;
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const { data } = await guardarComentarioDocente(token, sesionId, comentario);
      setDetalle((actual) => actual?.sesion.id === sesionId ? {
        ...actual,
        evaluacion: { ...actual.evaluacion, comentarioDocente: data.comentarioDocente }
      } : actual);
      setComentario(data.comentarioDocente);
      const aviso = data?.notificacion;
      if (aviso?.estado === 'Fallida') {
        setMensaje(
          `Comentario enviado. El correo no se pudo entregar${aviso.error ? `: ${aviso.error}` : '.'}`
        );
      } else if (aviso?.destinatario) {
        setMensaje(`Comentario enviado al estudiante (${aviso.destinatario}).`);
      } else {
        setMensaje('Comentario enviado.');
      }
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

  async function descargarReporte() {
    setDescargando(true);
    setError('');
    try {
      const archivo = await descargarReporteParticipacion(token, actividadId);
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `participacion-actividad-${actividadId}.csv`;
      document.body.append(enlace);
      try {
        enlace.click();
      } finally {
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setDescargando(false);
    }
  }

  const enCurso = sesiones.filter((s) => s.estado === 'En curso').length;
  const puedeDescargar = esDocente(sesion.usuario) && !esAdministrador(sesion.usuario);
  const puedeComentar = esDocente(sesion.usuario) && detalle?.sesion?.estado === 'Finalizado'
    && detalle.sesion.actividadId === actividadDetalle?.id
    && Number(actividadDetalle?.docenteId) === Number(sesion.usuario?.id)
    && Boolean(detalle.evaluacion);

  return (
    <section className="crear-caso">
      <GameDecor variant="ambient" munecos={2} />
      <header className="crear-head">
        <div>
          <p className="kicker">Docente</p>
          <h2>Seguimiento y resultados</h2>
          <p className="muted-light">
            Ves quién entró, progreso, respuestas, nota y retroalimentación. Se actualiza cada 12 s.
            {enCurso ? ` - ${enCurso} en curso` : ''}
          </p>
        </div>
        <div className="ficha-acciones">
          <button
            type="button"
            className="btn-ghost-dark"
            disabled={trabajando || !actividadId}
            onClick={() => cargarSesiones()}
          >
            Actualizar
          </button>
          {puedeDescargar ? (
            <button
              type="button"
              className="btn-ghost-dark"
              disabled={descargando || !actividadId}
              onClick={descargarReporte}
            >
              {descargando ? 'Descargando…' : 'Descargar reporte CSV'}
            </button>
          ) : null}
        </div>
      </header>

      {mensaje ? <div className="alert alert-ok">{mensaje}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando actividades…</p> : null}

      {actividades.length === 0 && !cargando ? (
        <div className="game-empty-wrap">
          <GameDecor
            variant="empty"
            title="No hay actividades para monitorear"
            text="Crea e inicia una actividad para ver las sesiones de los estudiantes."
          />
          {onIrActividades ? (
            <button type="button" className="btn-play" onClick={onIrActividades}>
              Ir a Actividades
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="field">
            <label>Actividad</label>
            <select value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
              <option value="">Elegir actividad</option>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id} - {a.estado} - caso {a.casoId}
                </option>
              ))}
            </select>
          </div>

          {actividadDetalle ? (
            <div className="asistente-resultado" style={{ marginBottom: '1rem' }}>
              <strong>
                {casoTitulo || `Caso #${actividadDetalle.casoId}`} - {actividadDetalle.estado}
              </strong>
              <p className="muted-light" style={{ margin: '0.35rem 0 0' }}>
                {actividadDetalle.fechaInicio} → {actividadDetalle.fechaFin}
                {actividadDetalle.estudiantesAutorizados?.length != null
                  ? ` - ${actividadDetalle.estudiantesAutorizados.length} convocados`
                  : ''}
              </p>
              <div className="estudiantes-acciones-fila" style={{ marginTop: '0.75rem' }}>
                <span className="chip-ejemplo">Sesiones {sesiones.length}</span>
                <span className="chip-ejemplo">En curso {enCurso}</span>
                <span className="chip-ejemplo">
                  Finalizadas {sesiones.filter((s) => s.estado === 'Finalizado').length}
                </span>
                <span className="chip-ejemplo">
                  Sin iniciar {sesiones.filter((s) => s.estado === 'Sin iniciar' || s.estado === 'Programada').length}
                </span>
              </div>
            </div>
          ) : null}

          <div className="panel-editor">
            <h3>Sesiones ({sesiones.length})</h3>
            {sesiones.length === 0 ? (
              <GameDecor
                variant="empty"
                munecos={2}
                title="No hay sesiones aún"
                text="Si la actividad está Programada, iniciala en Actividades para preparar las de los convocados."
              />
            ) : (
              <div className="arbol-escenas">
                {sesiones.map((s) => (
                  <article key={s.id} className="nodo-escena">
                    <header>
                      <strong>
                        #{s.id} - {s.nombres} {s.apellidos}
                        {s.estado === 'En curso' ? ' - 🟢' : ''}
                      </strong>
                      <p className="muted-light">
                        {s.correo || `Estudiante #${s.estudianteId}`} - {s.estado}
                        {s.numeroIntento ? ` - intento ${s.numeroIntento}` : ''}
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
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost-dark"
                          disabled={trabajando || !actividadId}
                          onClick={async () => {
                            setTrabajando(true);
                            setError('');
                            setMensaje('');
                            try {
                              await autorizarRepeticion(token, Number(actividadId), {
                                estudianteId: s.estudianteId,
                                motivo: 'Repetición excepcional autorizada desde Seguimiento (CP-32).'
                              });
                              setMensaje(
                                `Repetición autorizada para ${s.nombres || 'el estudiante'}.`
                              );
                            } catch (err) {
                              setError(mensajeError(err));
                            } finally {
                              setTrabajando(false);
                            }
                          }}
                        >
                          Autorizar repetición
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {detalle ? (
        <div className="panel-editor">
          <h3>
            Detalle sesión #{detalle.sesion?.id} - {detalle.sesion?.estado}
          </h3>
          {detalle.evaluacion?.resultado != null ? (
            <p className="sim-nota">
              Nota oficial: <strong>{detalle.evaluacion.resultado}</strong> / 5
            </p>
          ) : null}
          {detalle.evaluacion?.comentarioDocente ? (
            <div className="alert alert-ok">
              <strong>Comentario enviado</strong>
              <p style={{ whiteSpace: 'pre-wrap', margin: '0.5rem 0 0' }}>
                {detalle.evaluacion.comentarioDocente}
              </p>
            </div>
          ) : puedeComentar ? (
            <form onSubmit={guardarComentario}>
              <div className="field">
                <label htmlFor="comentario-docente">Comentario docente</label>
                <textarea
                  id="comentario-docente"
                  rows={4}
                  value={comentario}
                  disabled={trabajando}
                  onChange={(evento) => setComentario(evento.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn-play"
                disabled={trabajando || !comentario.trim()}
              >
                {trabajando ? 'Enviando…' : 'Enviar comentario'}
              </button>
            </form>
          ) : null}
          {detalle.progreso ? (
            <p className="muted-light">
              Progreso: {detalle.progreso.preguntasRespondidas ?? detalle.progreso.respondidas ?? 0}
              {detalle.progreso.totalPreguntas != null
                ? ` / ${detalle.progreso.totalPreguntas}`
                : ''}
              {detalle.progreso.preguntasPendientes != null
                ? ` - pendientes ${detalle.progreso.preguntasPendientes}`
                : ''}
            </p>
          ) : null}
          <h4>Respuestas</h4>
          {(detalle.respuestas || []).length === 0 ? (
            <p className="muted-light">Sin respuestas registradas.</p>
          ) : (
            <ul className="asistente-meta">
              {detalle.respuestas.map((r) => (
                <li key={r.key}>
                  {r.escena ? <em className="muted-light">{r.escena} - </em> : null}
                  <strong>{r.pregunta}</strong>
                  <br />
                  Elegió: {r.opcionTexto}
                  {r.esCorrecta != null ? (r.esCorrecta ? ' - correcta' : ' - incorrecta') : ''}
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
