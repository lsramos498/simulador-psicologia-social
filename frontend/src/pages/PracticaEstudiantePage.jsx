import { useEffect, useMemo, useState } from 'react';
import {
  consultarProgresoSesion,
  consultarRetroalimentacionSesion,
  consultarSesionActividad,
  finalizarSesion,
  iniciarSesionActividad,
  obtenerCaso,
  registrarRespuesta
} from '../api/client';
import SimulacionPlayer from '../components/casos/SimulacionPlayer';
import PracticaInicio from '../components/practica/PracticaInicio';
import PracticaResultado from '../components/practica/PracticaResultado';
import PracticaShell from '../components/practica/PracticaShell';
import EstudiantePanel from '../components/practica/EstudiantePanel';
import GameDecor from '../components/GameDecor';
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
  const [actividadId, setActividadId] = useState(
    () => (usuario?.actividadId != null ? Number(usuario.actividadId) : null)
  );
  const [vista, setVista] = useState('panel'); // panel | practica | jugar | resultados
  const [caso, setCaso] = useState(null);
  const [actividad, setActividad] = useState(null);
  const [sesionData, setSesionData] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [retro, setRetro] = useState(null);
  const [evaluacion, setEvaluacion] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
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
        '',
      esCorrecta: item.esCorrecta
    }));
  }, [retro, caso]);

  async function cargarCasoDesdeIds(casoId) {
    if (!casoId) return null;
    const casoRes = await obtenerCaso(token, casoId);
    setCaso(casoRes.data);
    return casoRes.data;
  }

  async function refrescarProgreso(sesionId) {
    try {
      const res = await consultarProgresoSesion(token, sesionId);
      setProgreso(res.data);
    } catch {
      /* progreso opcional */
    }
  }

  async function prepararActividad(id, { silencioso = false, destino = null } = {}) {
    if (!id) {
      setSesionData(null);
      setActividad(null);
      setCaso(null);
      setVista('panel');
      return;
    }

    if (!silencioso) setCargando(true);
    setError('');
    try {
      const ya = await consultarSesionActividad(token, id);
      const s = ya.data?.sesion || null;
      const act = ya.data?.actividad || null;
      setSesionData(s);
      setActividad(act);
      setEvaluacion(ya.data?.evaluacion || null);

      const estadoAct = act?.estado;
      const casoId = s?.casoId || act?.casoId;

      // Contenido del caso solo si la actividad ya fue iniciada por el docente
      // o el estudiante ya tiene sesión en curso / finalizada.
      const puedeVerContenido =
        estadoAct === 'Iniciada' ||
        s?.estado === 'En curso' ||
        s?.estado === 'Finalizado';

      if (puedeVerContenido && casoId) {
        try {
          await cargarCasoDesdeIds(casoId);
        } catch {
          /* título puede venir de actividad.casoTitulo */
        }
      } else {
        setCaso(null);
      }

      if (destino === 'resultados' || s?.estado === 'Finalizado') {
        if (s?.estado === 'Finalizado') {
          try {
            const r = await consultarRetroalimentacionSesion(token, s.id);
            setRetro(r.data);
          } catch {
            setRetro(null);
          }
        }
        setVista(destino === 'resultados' || s?.estado === 'Finalizado' ? 'resultados' : 'panel');
        setMensaje('');
      } else if (destino === 'jugar' || s?.estado === 'En curso') {
        setVista('jugar');
        setMensaje('');
        if (casoId) await cargarCasoDesdeIds(casoId);
        if (s?.id) await refrescarProgreso(s.id);
      } else if (destino === 'practica' || estadoAct === 'Iniciada') {
        setVista('practica');
        setMensaje(
          estadoAct === 'Iniciada'
            ? 'Tu docente ya inició la actividad. Cuando quieras, empieza la práctica.'
            : 'Cuando tu docente inicie la actividad vas a poder practicar.'
        );
      } else {
        setVista('panel');
        setMensaje('La actividad sigue programada. Solo ves el título y la hora hasta que el docente la inicie.');
      }
    } catch (err) {
      setSesionData(null);
      setVista('panel');
      if (err?.status === 409) {
        setError(
          mensajeError(err) ||
            'La actividad aún está programada. Espera a que tu docente la inicie.'
        );
      } else if (err?.status === 403) {
        setError(
          mensajeError(err) ||
            'No estás autorizado para esta actividad. Pídele a tu docente que te convoque.'
        );
      } else if (err?.status === 401) {
        setError('Tu sesión expiró. Vuelve a ingresar con tu correo y el código de sesión.');
      } else if (err?.status === 404) {
        setError('No encontramos tu convocatoria. Pídele a tu docente que te convoque de nuevo.');
      } else {
        setError(mensajeError(err) || 'No se pudo consultar la actividad.');
      }
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  useEffect(() => {
    if (actividadId) {
      prepararActividad(actividadId, { destino: 'panel' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function elegirActividad(item, destino) {
    const id = Number(item?.id);
    if (!id) return;
    if (item.soloVistaPrevia || item.estado === 'Programada') {
      setActividadId(id);
      setActividad({
        id,
        estado: item.estado,
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin,
        lugar: item.lugar,
        casoId: item.casoId,
        casoTitulo: item.casoTitulo
      });
      setCaso(null);
      setSesionData(null);
      setError('');
      setMensaje(
        'Esta actividad está programada. Vas a poder ver el contenido y practicar cuando tu docente la inicie.'
      );
      setVista('panel');
      return;
    }
    setActividadId(id);
    await prepararActividad(id, { destino });
  }

  async function empezar() {
    if (!actividadId) return;
    setCargando(true);
    setError('');
    setMensaje('');
    setErrorLive('');
    try {
      const res = await iniciarSesionActividad(token, actividadId);
      const s = res.data;
      setSesionData(s);
      const casoId = s.casoId || actividad?.casoId;
      let casoCargado = null;
      try {
        casoCargado = await cargarCasoDesdeIds(casoId);
      } catch (errCaso) {
        throw new Error(
          mensajeError(errCaso) ||
            'Se abrió la sesión pero no se pudo cargar el caso. Pídele al docente que publique el caso.'
        );
      }
      if (!casoCargado) {
        throw new Error('La actividad no tiene un caso asociado. Pídele ayuda a tu docente.');
      }
      setVista('jugar');
      await refrescarProgreso(s.id);
    } catch (err) {
      setVista('practica');
      setError(mensajeError(err) || 'No se pudo iniciar la práctica.');
      await prepararActividad(actividadId, { silencioso: true, destino: 'practica' });
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
      setVista('resultados');
    } catch (err) {
      setError(mensajeError(err));
      setErrorLive(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  const tabs = [
    { id: 'panel', label: 'Misiones' },
    { id: 'practica', label: 'Jugar' },
    { id: 'resultados', label: 'Resultados' }
  ];

  const hayResultados =
    sesionData?.estado === 'Finalizado' || evaluacion != null;
  const puedeAbrirPractica =
    actividadId && actividad?.estado !== 'Programada' && (caso || sesionData);

  return (
    <PracticaShell usuario={usuario} onSalir={onSalir}>
      {vista !== 'jugar' ? (
        <nav className="estudiante-tabs" aria-label="Secciones estudiante">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={vista === t.id ? 'estudiante-tab activo' : 'estudiante-tab'}
              disabled={t.disabled}
              onClick={() => setVista(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}

      {error && vista === 'panel' ? <div className="alert estudiante-hub-alerta">{error}</div> : null}

      {vista === 'jugar' ? (
        !caso || !sesionData ? (
          <section className="crear-caso practica-panel">
            {error ? <div className="alert">{error}</div> : null}
            <p className="muted-light">
              {cargando ? 'Abriendo la simulación…' : 'No se pudo abrir el caso de la práctica.'}
            </p>
            <div className="practica-resultado-acciones">
              <button
                type="button"
                className="login-btn-game green practica-btn-uniforme"
                disabled={cargando}
                onClick={() => {
                  setVista('practica');
                  prepararActividad(actividadId, { destino: 'practica' });
                }}
              >
                Volver
              </button>
            </div>
          </section>
        ) : (
          <>
            {progreso ? (
              <div className="practica-progreso">
                Progreso: {progreso.preguntasRespondidas ?? progreso.respondidas ?? 0}
                {progreso.totalPreguntas != null ? ` de ${progreso.totalPreguntas}` : ''} preguntas
                {progreso.preguntasPendientes != null
                  ? ` - pendientes ${progreso.preguntasPendientes}`
                  : ''}
              </div>
            ) : null}
            {errorLive || error ? (
              <div className="alert practica-alerta">{errorLive || error}</div>
            ) : null}
            <SimulacionPlayer
              key={`live-${sesionData.id}`}
              caso={caso}
              modoLive
              onResponder={alResponder}
              onTerminar={alTerminar}
              onSalir={() => setVista('panel')}
            />
          </>
        )
      ) : null}

      {vista === 'resultados' ? (
        hayResultados ? (
          <PracticaResultado
            caso={caso}
            evaluacion={evaluacion}
            retroItems={retroItems}
            onSalir={() => setVista('panel')}
          />
        ) : (
          <section className="estudiante-hub">
            <GameDecor
              variant="empty"
              munecos={2}
              title="Aún no hay resultados"
              text="Cuando termines una misión, tus resultados aparecen aquí. También puedes tocar Ver resultados en una misión hecha."
            />
            <div className="practica-resultado-acciones" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="mision-btn play"
                style={{ maxWidth: 260 }}
                onClick={() => setVista('panel')}
              >
                Ir a misiones
              </button>
            </div>
          </section>
        )
      ) : null}

      {vista === 'practica' ? (
        puedeAbrirPractica ? (
          <PracticaInicio
            actividadId={actividadId}
            actividad={actividad}
            caso={caso}
            error={error}
            cargando={cargando}
            bloqueada={actividad?.estado === 'Programada'}
            onEmpezar={empezar}
          />
        ) : (
          <EstudiantePanel
            token={token}
            usuario={usuario}
            actividadActivaId={actividadId}
            cargando={cargando}
            soloJugables
            tituloHub="Listas para jugar"
            textoHub="Estas misiones ya fueron iniciadas por tu docente. Elige una para entrar."
            onElegirActividad={elegirActividad}
          />
        )
      ) : null}

      {vista === 'panel' ? (
        <EstudiantePanel
          token={token}
          usuario={usuario}
          actividadActivaId={actividadId}
          cargando={cargando}
          onElegirActividad={elegirActividad}
        />
      ) : null}
    </PracticaShell>
  );
}
