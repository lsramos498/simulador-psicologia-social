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
  listarGrupos,
  retirarEstudianteActividad,
  cerrarActividad,
  cerrarVencidasActividades,
  obtenerActividad
} from '../api/client';
import ActividadCrearForm from '../components/actividades/ActividadCrearForm';
import ActividadesLista from '../components/actividades/ActividadesLista';
import GameDecor from '../components/GameDecor';
import { mensajeError } from '../utils/casoHelpers';
import { formatearFecha } from '../utils/dateFormat';
import { portadaDeCaso } from '../data/portadas';

function ahoraLocalInput(minutosOffset = 0) {
  const d = new Date(Date.now() + minutosOffset * 60_000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ActividadesPage({ sesion, casoIdInicial = null, onCasoInicialConsumido }) {
  const { token, usuario } = sesion;
  const esAdmin = (usuario?.roles || []).includes('Administrador');
  const [actividades, setActividades] = useState([]);
  const [casos, setCasos] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [retiroPorActividad, setRetiroPorActividad] = useState({});
  const [extraPorActividad, setExtraPorActividad] = useState({});
  const [codigos, setCodigos] = useState([]);
  const [convocatorias, setConvocatorias] = useState([]);
  const [actividadConvocadaId, setActividadConvocadaId] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [detalleActividad, setDetalleActividad] = useState(null);
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [form, setForm] = useState({
    casoId: '',
    espacioAcademicoId: '',
    rubricaId: '',
    fechaInicio: ahoraLocalInput(-5),
    fechaFin: ahoraLocalInput(120),
    tiempoLimiteSegundos: 900,
    intentosPermitidos: 1,
    lugar: 'Aula / práctica',
    mensajePersonalizado: 'Te convocaron a una práctica en Lumina. Entra con tu correo y el código de inicio de sesión.',
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
      const listaEspacios = esp.data || [];
      setActividades(acts.data || []);
      setCasos(casosRes.data || []);
      setEspacios(listaEspacios);
      setForm((prev) =>
        prev.espacioAcademicoId || !listaEspacios[0]
          ? prev
          : { ...prev, espacioAcademicoId: String(listaEspacios[0].id) }
      );
      try {
        const est = esAdmin
          ? await listarEstudiantesAdmin(token)
          : await listarEstudiantes(token);
        setEstudiantes(est.data || []);
      } catch {
        setEstudiantes([]);
      }
      try {
        const gr = await listarGrupos(token);
        setGrupos(gr.data || []);
      } catch {
        setGrupos([]);
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
    if (!casoIdInicial) return;
    setForm((prev) => ({ ...prev, casoId: String(casoIdInicial) }));
    setMensaje('Caso listo para programar. Abre un grupo, selecciona estudiantes y toca Programar.');
    setError('');
    const t = setTimeout(() => {
      document.getElementById('programar-actividad')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 120);
    onCasoInicialConsumido?.();
    return () => clearTimeout(t);
  }, [casoIdInicial]);

  useEffect(() => {
    if (casoElegido?.rubricaId) {
      setForm((prev) => ({ ...prev, rubricaId: String(casoElegido.rubricaId) }));
    }
  }, [casoElegido?.rubricaId]);

  async function crear(evento) {
    evento.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    setCodigos([]);
    setConvocatorias([]);
    try {
      let espacioId = Number(form.espacioAcademicoId);
      if (!espacioId) {
        const resEsp = await crearEspacio(token, {
          nombre: 'Práctica clínica',
          codigo: `PRA-${Date.now().toString().slice(-5)}`
        });
        const creado = resEsp.data || resEsp;
        espacioId = Number(creado.id);
        setEspacios((prev) => [...prev, creado]);
        setForm((prev) => ({ ...prev, espacioAcademicoId: String(creado.id) }));
      }
      if (!form.rubricaId) {
        throw new Error(
          'El caso no tiene rúbrica. Abre el caso → Evaluación, arma la rúbrica y guárdala antes de publicar.'
        );
      }
      const ids = form.estudiantesIds.map(Number).filter((n) => n > 0);
      if (!ids.length) {
        throw new Error('Entra a un grupo y selecciona estudiantes (o usa Seleccionar todos).');
      }
      const payload = {
        casoId: Number(form.casoId),
        espacioAcademicoId: espacioId,
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
          'Actividad programada.',
          enviadasCorreo
            ? `Convocatoria enviada a ${enviadasCorreo} estudiante(s).`
            : 'Aviso registrado en bandeja.',
          'Abajo toca Iniciar cuando quieras abrir la práctica.',
          'Guarda los códigos (solo se muestran ahora).',
          previews[0] ? `Preview: ${previews[0]}` : ''
        ]
          .filter(Boolean)
          .join(' ')
      );
      setForm((prev) => ({ ...prev, estudiantesIds: [], casoId: '' }));
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

  function elegirCasoParaProgramar(casoId) {
    setForm((prev) => ({ ...prev, casoId: String(casoId) }));
    setMensaje('Caso elegido. Ahora abre un grupo y selecciona estudiantes.');
    setError('');
    const ancla = document.getElementById('programar-actividad');
    ancla?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  async function agregarExtra(actividadId, valorSelect) {
    const estudianteId = Number(valorSelect ?? extraPorActividad[actividadId]);
    if (!estudianteId) {
      setError('Indica el ID del estudiante a convocar.');
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
      setExtraPorActividad((prev) => ({ ...prev, [actividadId]: '' }));
      await verConvocatorias(actividadId);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function retirar(actividadId, valorSelect) {
    const idEst = Number(valorSelect ?? retiroPorActividad[actividadId]);
    if (!idEst) {
      setError('Indica el estudiante a retirar.');
      return;
    }
    setTrabajando(true);
    setError('');
    try {
      await retirarEstudianteActividad(token, actividadId, idEst);
      setMensaje(`Estudiante #${idEst} retirado y notificado.`);
      setRetiroPorActividad((prev) => ({ ...prev, [actividadId]: '' }));
      await verConvocatorias(actividadId);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function verDetalle(id) {
    setTrabajando(true);
    setError('');
    try {
      const res = await obtenerActividad(token, id);
      setDetalleActividad(res.data);
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

  async function cerrarVencidas() {
    setTrabajando(true);
    setError('');
    try {
      const res = await cerrarVencidasActividades(token);
      const n = res.total ?? res.data?.length ?? 0;
      setMensaje(n ? `Se cerraron ${n} actividad(es) vencida(s).` : 'No había actividades vencidas.');
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <section className="crear-caso">
      <GameDecor variant="ambient" munecos={3} />
      <header className="crear-head rise">
        <div>
          <p className="kicker">{esAdmin ? 'Admin / Docente' : 'Docente'}</p>
          <h2>Actividades</h2>
          <p className="muted-light">
            Flujo corto: <strong>Publicar caso</strong> → <strong>Programar</strong> (elige un grupo) →{' '}
            <strong>Iniciar</strong>.
          </p>
        </div>
        <div className="ficha-acciones">
          <button type="button" className="btn-ghost-dark" disabled={trabajando} onClick={cerrarVencidas}>
            Cerrar vencidas
          </button>
          <button type="button" className="btn-ghost-dark" onClick={cargar}>
            Actualizar
          </button>
        </div>
      </header>

      {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
      {error ? <div className="alert fade">{error}</div> : null}
      {cargando ? <p className="muted-light">Cargando…</p> : null}

      {publicados.length > 0 ? (
        <div className="panel-editor casos-listos">
          <h3>Casos listos para programar</h3>
          <p className="muted-light">
            Publicaste el caso: elígelo aquí, convoca un grupo y programa. Después solo inicias.
          </p>
          <div className="casos-listos-grid">
            {publicados.map((c) => (
              <button
                key={c.id}
                type="button"
                className={
                  String(form.casoId) === String(c.id)
                    ? 'caso-listo-card activo'
                    : 'caso-listo-card'
                }
                onClick={() => elegirCasoParaProgramar(c.id)}
              >
                <strong>{c.titulo}</strong>
                <span>#{c.id} - {c.rubricaId ? 'Con rúbrica' : 'Sin rúbrica'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div id="programar-actividad">
        <ActividadCrearForm
          token={token}
          form={form}
          setForm={setForm}
          publicados={publicados}
          espacios={espacios}
          grupos={grupos}
          casoElegido={casoElegido}
          trabajando={trabajando}
          onSubmit={crear}
          onCrearEspacio={crearEspacioRapido}
          mostrarAvanzado={mostrarAvanzado}
          setMostrarAvanzado={setMostrarAvanzado}
        />
      </div>

      {codigos.length > 0 ? (
        <div className="asistente-resultado">
          <div className="ficha-acciones" style={{ marginBottom: '0.5rem' }}>
            <strong>Códigos de acceso (guárdalos ahora)</strong>
            <button
              type="button"
              className="btn-ghost-dark"
              onClick={async () => {
                const texto = codigos
                  .map((c) => `Estudiante #${c.estudianteId}: ${c.codigo}`)
                  .join('\n');
                try {
                  await navigator.clipboard.writeText(texto);
                  setMensaje('Códigos copiados al portapapeles.');
                } catch {
                  setError('No se pudo copiar. Selecciona los códigos a mano.');
                }
              }}
            >
              Copiar todos
            </button>
          </div>
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
                  #{n.estudianteId} {n.nombres || ''} {n.apellidos || ''} - {n.estado}
                  {n.canal ? ` - ${n.canal}` : ''}
                  {n.asunto ? ` - ${n.asunto}` : ''}
                  {n.errorEnvio ? ` - aviso: ${n.errorEnvio}` : ''}
                  {preview ? (
                    <>
                      {' - '}
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

      {detalleActividad ? (
        <div className="panel-editor actividad-detalle">
          <div
            className="actividad-detalle-foto"
            style={{
              backgroundImage: `url('${portadaDeCaso({
                id: detalleActividad.casoId,
                titulo: detalleActividad.casoTitulo
              })}')`
            }}
            aria-hidden="true"
          />
          <div className="ficha-acciones" style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }} className="actividad-card-titulo">
              {detalleActividad.casoTitulo || `Caso #${detalleActividad.casoId}`}
            </h3>
            <button type="button" className="btn-ghost-dark" onClick={() => setDetalleActividad(null)}>
              Cerrar
            </button>
          </div>
          <p className="muted-light">
            Actividad #{detalleActividad.id} - {detalleActividad.estado} - Rúbrica{' '}
            {detalleActividad.rubricaId || '—'}
            {detalleActividad.espacioAcademicoNombre
              ? ` - ${detalleActividad.espacioAcademicoNombre}`
              : ''}
          </p>
          <p>
            <strong>Inicio:</strong> {formatearFecha(detalleActividad.fechaInicio)}
            {' - '}
            <strong>Fin:</strong> {formatearFecha(detalleActividad.fechaFin)}
            {detalleActividad.tiempoLimiteSegundos
              ? ` - límite ${detalleActividad.tiempoLimiteSegundos}s`
              : ''}
          </p>
          <h4>Estudiantes autorizados</h4>
          {(detalleActividad.estudiantesAutorizados || []).length === 0 ? (
            <p className="muted-light">Ninguno todavía.</p>
          ) : (
            <ul className="asistente-meta">
              {detalleActividad.estudiantesAutorizados.map((e) => (
                <li key={e.id || e.estudianteId}>
                  #{e.estudianteId} {e.nombres || ''} {e.apellidos || ''} - {e.estado}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <ActividadesLista
        actividades={actividades}
        estudiantes={estudiantes}
        trabajando={trabajando}
        extraPorActividad={extraPorActividad}
        setExtraPorActividad={setExtraPorActividad}
        retiroPorActividad={retiroPorActividad}
        setRetiroPorActividad={setRetiroPorActividad}
        onIniciar={iniciar}
        onCerrar={cerrar}
        onVerDetalle={verDetalle}
        onVerNotificaciones={verConvocatorias}
        onAgregarExtra={agregarExtra}
        onRetirar={retirar}
      />
    </section>
  );
}
