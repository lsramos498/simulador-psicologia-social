import { useEffect, useMemo, useState } from 'react';
import {
  agregarEstudianteActividad,
  crearActividad,
  crearEspacio,
  iniciarActividad,
  listarActividades,
  listarCasos,
  listarConvocatorias,
  listarEspacios,
  listarEstudiantes,
  listarEstudiantesAdmin,
  retirarEstudianteActividad,
  cerrarActividad
} from '../api/client';
import ActividadCrearForm from '../components/actividades/ActividadCrearForm';
import ActividadesLista from '../components/actividades/ActividadesLista';
import { mensajeError } from '../utils/casoHelpers';

function ahoraLocalInput(minutosOffset = 0) {
  const d = new Date(Date.now() + minutosOffset * 60_000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ActividadesPage({ sesion }) {
  const { token, usuario } = sesion;
  const esAdmin = (usuario?.roles || []).includes('Administrador');
  const [actividades, setActividades] = useState([]);
  const [casos, setCasos] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteRetiro, setEstudianteRetiro] = useState('');
  const [codigos, setCodigos] = useState([]);
  const [convocatorias, setConvocatorias] = useState([]);
  const [actividadConvocadaId, setActividadConvocadaId] = useState(null);
  const [estudianteExtra, setEstudianteExtra] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [form, setForm] = useState({
    casoId: '',
    espacioAcademicoId: '',
    rubricaId: '',
    fechaInicio: ahoraLocalInput(-5),
    fechaFin: ahoraLocalInput(120),
    tiempoLimiteSegundos: 900,
    intentosPermitidos: 1,
    lugar: 'Aula / práctica',
    mensajePersonalizado: 'Has sido convocado a una práctica en Lumina. Entrá con tu correo y este código.',
    estudiantesIds: []
  });

  const publicados = useMemo(
    () => (casos || []).filter((c) => c.estado === 'Publicado'),
    [casos]
  );

  const casoElegido = useMemo(
    () => publicados.find((c) => String(c.id) === String(form.casoId)) || null,
    [publicados, form.casoId]
  );

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const filtrosCasos = { estado: 'Publicado' };
      if (!esAdmin && usuario?.id) {
        filtrosCasos.creadorId = usuario.id;
      }
      const [acts, casosRes, esp] = await Promise.all([
        listarActividades(token),
        listarCasos(token, filtrosCasos),
        listarEspacios(token)
      ]);
      setActividades(acts.data || []);
      setCasos(casosRes.data || []);
      setEspacios(esp.data || []);
      try {
        const est = esAdmin
          ? await listarEstudiantesAdmin(token)
          : await listarEstudiantes(token);
        setEstudiantes(est.data || []);
      } catch {
        setEstudiantes([]);
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

  useEffect(() => {
    if (casoElegido?.rubricaId) {
      setForm((prev) => ({ ...prev, rubricaId: String(casoElegido.rubricaId) }));
    }
  }, [casoElegido?.rubricaId]);

  function toggleEstudiante(id) {
    setForm((prev) => {
      const set = new Set(prev.estudiantesIds.map(Number));
      const n = Number(id);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      return { ...prev, estudiantesIds: [...set] };
    });
  }

  async function crear(evento) {
    evento.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    setCodigos([]);
    setConvocatorias([]);
    try {
      if (!form.rubricaId) {
        throw new Error(
          'El caso elegido no tiene rúbrica activa. Abrí el editor del caso → pestaña Evaluación, subí o armá la rúbrica y guardala.'
        );
      }
      const ids = form.estudiantesIds.map(Number).filter((n) => n > 0);
      if (!ids.length) {
        throw new Error('Selecciona o escribe al menos un estudiante.');
      }
      const payload = {
        casoId: Number(form.casoId),
        espacioAcademicoId: Number(form.espacioAcademicoId),
        rubricaId: Number(form.rubricaId),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        tiempoLimiteSegundos: Number(form.tiempoLimiteSegundos),
        intentosPermitidos: Number(form.intentosPermitidos),
        lugar: form.lugar || null,
        mensajePersonalizado: form.mensajePersonalizado || null,
        estudiantesIds: ids
      };
      const res = await crearActividad(token, payload);
      const nuevosCodigos = res.data?.codigosDeAcceso || [];
      setCodigos(nuevosCodigos);
      const actividadId = res.data?.id;
      const avisos = res.data?.notificaciones || [];
      const enviadasCorreo = avisos.filter((n) => n.canal === 'Correo').length;
      const previews = avisos.map((n) => n.previewUrl).filter(Boolean);
      setMensaje(
        [
          'Actividad creada.',
          enviadasCorreo
            ? `Correo enviado a ${enviadasCorreo} estudiante(s).`
            : 'Aviso registrado en bandeja del sistema.',
          'Guardá los códigos: solo se muestran ahora.',
          previews[0] ? `Preview del correo: ${previews[0]}` : ''
        ]
          .filter(Boolean)
          .join(' ')
      );
      if (actividadId) {
        await verConvocatorias(actividadId);
      }
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function crearEspacioRapido() {
    setTrabajando(true);
    setError('');
    try {
      const res = await crearEspacio(token, {
        nombre: 'Práctica clínica',
        codigo: `PRA-${Date.now().toString().slice(-5)}`
      });
      const creado = res.data || res;
      setEspacios((prev) => [...prev, creado]);
      setForm((prev) => ({ ...prev, espacioAcademicoId: String(creado.id) }));
      setMensaje(`Espacio creado: ${creado.nombre}`);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function verConvocatorias(id) {
    setTrabajando(true);
    setError('');
    try {
      const res = await listarConvocatorias(token, id);
      setConvocatorias(res.data || []);
      setActividadConvocadaId(id);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function agregarExtra(actividadId) {
    const estudianteId = Number(estudianteExtra);
    if (!estudianteId) {
      setError('Indicá el ID del estudiante a convocar.');
      return;
    }
    setTrabajando(true);
    setError('');
    try {
      const res = await agregarEstudianteActividad(token, actividadId, estudianteId);
      const codigo = res.data?.codigoAutorizacion;
      setMensaje(
        codigo
          ? `Estudiante #${estudianteId} convocado y notificado. Código: ${codigo}`
          : `Estudiante #${estudianteId} convocado y notificado.`
      );
      if (codigo) {
        setCodigos((prev) => [...prev, { estudianteId, codigo }]);
      }
      setEstudianteExtra('');
      await verConvocatorias(actividadId);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function retirar(actividadId) {
    const idEst = Number(estudianteRetiro);
    if (!idEst) {
      setError('Indicá el ID a retirar.');
      return;
    }
    setTrabajando(true);
    try {
      await retirarEstudianteActividad(token, actividadId, idEst);
      setMensaje(`Estudiante #${idEst} retirado y notificado.`);
      setEstudianteRetiro('');
      await verConvocatorias(actividadId);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function iniciar(id) {
    setTrabajando(true);
    setError('');
    try {
      await iniciarActividad(token, id);
      setMensaje('Actividad iniciada. Los estudiantes ya pueden entrar.');
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function cerrar(id) {
    if (!window.confirm('¿Cerrar esta actividad?')) return;
    setTrabajando(true);
    try {
      await cerrarActividad(token, id);
      setMensaje('Actividad cerrada.');
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
          <p className="kicker">Docente</p>
          <h2>Actividades y convocatoria</h2>
          <p className="muted-light">
            Programa un caso con rúbrica, genera códigos y notifica a los estudiantes.
          </p>
        </div>
        <button type="button" className="btn-ghost-dark" onClick={cargar}>
          Actualizar
        </button>
      </header>

      {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
      {error ? <div className="alert fade">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando…</p> : null}

      <ActividadCrearForm
        form={form}
        setForm={setForm}
        publicados={publicados}
        espacios={espacios}
        estudiantes={estudiantes}
        casoElegido={casoElegido}
        trabajando={trabajando}
        onSubmit={crear}
        onCrearEspacio={crearEspacioRapido}
        onToggleEstudiante={toggleEstudiante}
      />

      {codigos.length > 0 ? (
        <div className="asistente-resultado">
          <strong>Códigos de acceso (guárdalos ahora)</strong>
          <ul className="asistente-meta">
            {codigos.map((c) => (
              <li key={`${c.estudianteId}-${c.codigo}`}>
                Estudiante #{c.estudianteId}: <code>{c.codigo}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actividadConvocadaId && convocatorias.length > 0 ? (
        <div className="panel-editor">
          <h3>Notificaciones de la actividad #{actividadConvocadaId}</h3>
          <ul className="asistente-meta">
            {convocatorias.map((n) => {
              const preview = String(n.mensaje || '').match(/https:\/\/ethereal\.email\/message\/\S+/);
              return (
                <li key={n.id}>
                  #{n.estudianteId} {n.nombres || ''} {n.apellidos || ''} · {n.estado}
                  {n.canal ? ` · ${n.canal}` : ''}
                  {n.asunto ? ` · ${n.asunto}` : ''}
                  {n.errorEnvio ? ` · aviso: ${n.errorEnvio}` : ''}
                  {preview ? (
                    <>
                      {' · '}
                      <a href={preview[0]} target="_blank" rel="noreferrer">
                        Ver correo enviado
                      </a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ActividadesLista
        actividades={actividades}
        trabajando={trabajando}
        estudianteExtra={estudianteExtra}
        setEstudianteExtra={setEstudianteExtra}
        estudianteRetiro={estudianteRetiro}
        setEstudianteRetiro={setEstudianteRetiro}
        onIniciar={iniciar}
        onCerrar={cerrar}
        onVerNotificaciones={verConvocatorias}
        onAgregarExtra={agregarExtra}
        onRetirar={retirar}
      />
    </section>
  );
}
