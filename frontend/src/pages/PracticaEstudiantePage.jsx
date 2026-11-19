import { useEffect, useMemo, useState } from 'react';
import {
  consultarProgresoSesion,
  consultarRetroalimentacionSesion,
  consultarSesionActividad,
  finalizarSesion,
  iniciarSesionActividad,
  listarNotificaciones,
  marcarNotificacionLeida,
  obtenerCaso,
  registrarRespuesta
} from '../api/client';
import SimulacionPlayer from '../components/casos/SimulacionPlayer';
import PracticaInicio from '../components/practica/PracticaInicio';
import PracticaResultado from '../components/practica/PracticaResultado';
import PracticaShell from '../components/practica/PracticaShell';
import { mensajeError } from '../utils/casoHelpers';

function preguntaDeCaso(caso, decisionId) {
  if (!caso?.escenas || decisionId == null) return null;
  for (const escena of caso.escenas) {
    for (const d of escena.decisiones || []) {
      if (Number(d.id) === Number(decisionId)) {
        return d.pregunta || null;
      }
    }
  }
  return null;
}

export default function PracticaEstudiantePage({ sesion, onSalir }) {
  const { token, usuario } = sesion;
  const actividadId = Number(usuario?.actividadId);
  const [fase, setFase] = useState('inicio'); // inicio | jugar | fin
  const [caso, setCaso] = useState(null);
  const [sesionData, setSesionData] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [retro, setRetro] = useState(null);
  const [evaluacion, setEvaluacion] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [errorLive, setErrorLive] = useState('');

  const retroItems = useMemo(() => {
    const lista = Array.isArray(retro) ? retro : retro?.data || [];
    return lista.map((item, idx) => ({
      key: item.id || item.decisionId || idx,
      titulo:
        item.pregunta ||
        preguntaDeCaso(caso, item.decisionId) ||
        (item.decisionId != null ? `Pregunta #${item.decisionId}` : `Ítem ${idx + 1}`),
      detalle:
        item.explicacion ||
        item.fundamentoTeorico ||
        item.opcionTexto ||
        item.texto ||
        ''
    }));
  }, [retro, caso]);

  async function cargarCasoDesdeSesion(s) {
    const casoId = s?.casoId;
    if (!casoId) {
      throw new Error('La sesión no trae el caso asociado. Pedile al docente que reinicie la actividad.');
    }
    const casoRes = await obtenerCaso(token, casoId);
    setCaso(casoRes.data);
  }

  async function refrescarProgreso(sesionId) {
    try {
      const res = await consultarProgresoSesion(token, sesionId);
      setProgreso(res.data);
    } catch {
      /* progreso opcional mientras juega */
    }
  }

  async function cargarNotificaciones() {
    try {
      const res = await listarNotificaciones(token);
      setNotificaciones(res.data || []);
    } catch {
      setNotificaciones([]);
    }
  }

  async function marcarLeida(id) {
    try {
      await marcarNotificacionLeida(token, id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, estado: 'Leida' } : n))
      );
    } catch {
      /* no bloquea */
    }
  }

  async function preparar({ silencioso = false } = {}) {
    if (!silencioso) setCargando(true);
    setError('');
    try {
      await cargarNotificaciones();
      if (!actividadId) {
        throw new Error('No hay actividad asociada a tu ingreso. Usa el código de convocatoria.');
      }

      try {
        const ya = await consultarSesionActividad(token, actividadId);
        const s = ya.data?.sesion || ya.data;
        setSesionData(s);
        setEvaluacion(ya.data?.evaluacion || null);
        if (s?.casoId) {
          await cargarCasoDesdeSesion(s);
        }
        if (s?.estado === 'Finalizado') {
          setFase('fin');
          setMensaje('');
          try {
            const r = await consultarRetroalimentacionSesion(token, s.id);
            setRetro(r.data);
          } catch {
            setRetro(null);
          }
        } else if (s?.estado === 'En curso') {
          setFase('jugar');
          setMensaje('');
          await refrescarProgreso(s.id);
        } else {
          setFase('inicio');
          setMensaje('Tu sesión está lista. Cuando el docente haya iniciado la actividad, pulsá Empezar.');
        }
      } catch (err) {
        setSesionData(null);
        if (err?.status === 404) {
          setMensaje(
            'Todavía no hay sesión preparada. Cuando el docente inicie la actividad, pulsá Actualizar o Empezar.'
          );
        } else if (err?.status === 403) {
          setError(
            mensajeError(err) ||
              'No estás autorizado para esta actividad. Verificá el código con tu docente.'
          );
        } else if (err?.status === 401) {
          setError('Tu sesión expiró. Volvé a ingresar con tu correo y código.');
        } else {
          setError(mensajeError(err) || 'No se pudo consultar la sesión.');
        }
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  useEffect(() => {
    preparar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fase !== 'inicio') return undefined;
    const timer = setInterval(() => {
      preparar({ silencioso: true });
    }, 12_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  async function empezar() {
    setCargando(true);
    setError('');
    setMensaje('');
    setErrorLive('');
    try {
      const res = await iniciarSesionActividad(token, actividadId);
      const s = res.data;
      setSesionData(s);
      if (!caso) {
        await cargarCasoDesdeSesion(s);
      }
      setFase('jugar');
      setMensaje('Sesión en curso. Responde con cuidado.');
      await refrescarProgreso(s.id);
    } catch (err) {
      setError(mensajeError(err));
      await preparar({ silencioso: true });
    } finally {
      setCargando(false);
    }
  }

  async function alResponder({ decisionId, opcionId }) {
    if (!sesionData?.id) {
      throw new Error('No hay sesión activa para registrar la respuesta.');
    }
    setErrorLive('');
    try {
      await registrarRespuesta(token, {
        sesionId: sesionData.id,
        decisionId,
        opcionId
      });
      await refrescarProgreso(sesionData.id);
    } catch (err) {
      const texto = mensajeError(err) || 'No se pudo guardar la respuesta.';
      setErrorLive(texto);
      throw err;
    }
  }

  async function alTerminar() {
    if (!sesionData?.id) return;
    if (progreso?.preguntasPendientes > 0) {
      const ok = window.confirm(
        `Todavía hay ${progreso.preguntasPendientes} pregunta(s) sin responder. ¿Finalizar igual?`
      );
      if (!ok) return;
    }
    setCargando(true);
    setError('');
    setErrorLive('');
    try {
      const cierre = await finalizarSesion(token, sesionData.id);
      setSesionData(cierre.data?.sesion || { ...sesionData, estado: 'Finalizado' });
      setEvaluacion(cierre.data?.evaluacion || cierre.data || null);
      try {
        const r = await consultarRetroalimentacionSesion(token, sesionData.id);
        setRetro(r.data);
      } catch {
        setRetro(null);
      }
      setFase('fin');
    } catch (err) {
      setError(mensajeError(err));
      setErrorLive(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  if (cargando && !caso && fase !== 'fin' && fase !== 'inicio') {
    return (
      <PracticaShell usuario={usuario} onSalir={onSalir}>
        <section className="crear-caso">
          <p className="muted-light">Preparando tu práctica…</p>
        </section>
      </PracticaShell>
    );
  }

  if (fase === 'jugar' && caso && sesionData) {
    return (
      <PracticaShell usuario={usuario} onSalir={onSalir}>
        {progreso ? (
          <div className="alert alert-ok" style={{ margin: '0.8rem 1rem' }}>
            Progreso: {progreso.preguntasRespondidas ?? progreso.respondidas ?? 0}
            {progreso.totalPreguntas != null ? ` de ${progreso.totalPreguntas}` : ''} preguntas
            {progreso.preguntasPendientes != null
              ? ` · pendientes ${progreso.preguntasPendientes}`
              : ''}
          </div>
        ) : null}
        {errorLive || error ? <div className="alert">{errorLive || error}</div> : null}
        <SimulacionPlayer
          key={`live-${sesionData.id}`}
          caso={caso}
          modoLive
          onResponder={alResponder}
          onTerminar={alTerminar}
          onSalir={onSalir}
        />
      </PracticaShell>
    );
  }

  if (fase === 'fin') {
    return (
      <PracticaShell usuario={usuario} onSalir={onSalir}>
        <PracticaResultado
          caso={caso}
          evaluacion={evaluacion}
          retroItems={retroItems}
          onSalir={onSalir}
        />
      </PracticaShell>
    );
  }

  return (
    <PracticaShell usuario={usuario} onSalir={onSalir}>
      <PracticaInicio
        actividadId={actividadId}
        caso={caso}
        mensaje={mensaje}
        error={error}
        cargando={cargando}
        notificaciones={notificaciones}
        onActualizar={() => preparar()}
        onEmpezar={empezar}
        onMarcarLeida={marcarLeida}
      />
    </PracticaShell>
  );
}
