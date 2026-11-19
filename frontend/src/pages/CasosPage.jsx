import { useEffect, useMemo, useState } from 'react';
import {
  archivarCaso,
  construirCaso,
  crearCaso,
  guardarMaterialCaso,
  listarCasos,
  obtenerCaso,
  publicarCaso
} from '../api/client';
import { aPersonajeApi } from '../data/bancoPersonajes';
import Sidebar from '../components/Sidebar';
import CasoHero from '../components/CasoHero';
import CasosCarrusel from '../components/CasosCarrusel';
import CasoFicha from '../components/casos/CasoFicha';
import CasoEditor from '../components/casos/CasoEditor';
import CrearCasoPanel from '../components/casos/CrearCasoPanel';
import SimulacionPlayer from '../components/casos/SimulacionPlayer';
import { emparejarEscenario } from '../components/casos/AsistenteIACasos';
import BancoPersonajes from '../components/BancoPersonajes';
import ActividadesPage from './ActividadesPage';
import AdminPage from './AdminPage';
import AvisosPage from './AvisosPage';
import EspaciosPage from './EspaciosPage';
import SeguimientoPage from './SeguimientoPage';
import { mensajeError } from '../utils/casoHelpers';
import { esAdministrador } from '../utils/roles';
import { guardarPortadaEscena, portadasDeCasoLocal } from '../utils/escenasLocal';

const formVacio = {
  titulo: '',
  desarrolloSituacional: '',
  contextoHistoria: '',
  tiempoEstimadoSegundos: 600,
  pregunta: '¿Qué intervención conviene en esta situación?',
  opcionBuena: 'Escucha a las partes y media el conflicto',
  opcionMala: 'Ignora la tensión y sigue con la clase',
  modo: 'completo'
};

export default function CasosPage({ sesion, onSalir }) {
  const { token, usuario } = sesion;
  const [vista, setVista] = useState('historias');
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [casos, setCasos] = useState([]);
  const [destacadoId, setDestacadoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [personajesElegidos, setPersonajesElegidos] = useState([]);
  const [escenarioElegido, setEscenarioElegido] = useState(null);
  const [rubricaIa, setRubricaIa] = useState(null);
  const [escenasIa, setEscenasIa] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [abriendoId, setAbriendoId] = useState(null);
  const [mostrarIaCrear, setMostrarIaCrear] = useState(false);

  const admin = esAdministrador(usuario);

  async function cargar(estado = filtro) {
    setCargando(true);
    setError('');
    try {
      const respuesta = await listarCasos(token, {
        estado: estado || undefined,
        // Admin ve todos los casos; docente solo los propios.
        creadorId: admin ? undefined : usuario?.id
      });
      const lista = respuesta.data || [];
      setCasos(lista);
      setDestacadoId((prev) => {
        if (prev && lista.some((c) => c.id === prev)) return prev;
        return lista[0]?.id ?? null;
      });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const casosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    if (!q) return casos;
    return casos.filter((c) => {
      const texto = `${c.titulo || ''} ${c.id || ''} ${c.estado || ''}`.toLocaleLowerCase('es');
      return texto.includes(q);
    });
  }, [casos, busqueda]);

  const destacado = useMemo(
    () =>
      casosFiltrados.find((c) => c.id === destacadoId) ||
      casosFiltrados[0] ||
      casos.find((c) => c.id === destacadoId) ||
      casos[0] ||
      null,
    [casos, casosFiltrados, destacadoId]
  );

  const publicados = useMemo(
    () => casosFiltrados.filter((c) => c.estado === 'Publicado'),
    [casosFiltrados]
  );
  const borradores = useMemo(
    () => casosFiltrados.filter((c) => c.estado === 'Borrador'),
    [casosFiltrados]
  );
  const archivados = useMemo(
    () => casosFiltrados.filter((c) => c.estado === 'Archivado'),
    [casosFiltrados]
  );

  function togglePersonaje(personaje) {
    setPersonajesElegidos((prev) => {
      const existe = prev.some((p) => p.id === personaje.id);
      if (existe) return prev.filter((p) => p.id !== personaje.id);
      return [...prev, personaje];
    });
  }

  function cambiarVista(id) {
    setVista(id);
    setMensaje('');
    setError('');
    if (id === 'crear') setMostrarIaCrear(false);
  }

  function sincronizarDetalle(caso) {
    setDetalle(caso);
    setCasos((prev) =>
      prev.map((item) =>
        item.id === caso.id
          ? {
              ...item,
              titulo: caso.titulo,
              estado: caso.estado,
              tiempoEstimadoSegundos: caso.tiempoEstimadoSegundos,
              rubricaId: caso.rubrica?.id ?? item.rubricaId
            }
          : item
      )
    );
  }

  async function abrirFicha(caso) {
    if (!caso?.id) {
      setMostrarIaCrear(false);
      setVista('crear');
      return;
    }
    setError('');
    setMensaje('');
    setAbriendoId(caso.id);
    try {
      const respuesta = await obtenerCaso(token, caso.id);
      setDetalle(respuesta.data);
      setDestacadoId(caso.id);
      setVista('ficha');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setAbriendoId(null);
    }
  }

  async function abrirEditor(caso) {
    const id = caso?.id || detalle?.id;
    if (!id) return;
    setError('');
    setMensaje('');
    setAbriendoId(id);
    try {
      const respuesta = await obtenerCaso(token, id);
      setDetalle(respuesta.data);
      setDestacadoId(id);
      setVista('editor');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setAbriendoId(null);
    }
  }

  async function abrirSimulacion(caso) {
    const id = caso?.id || detalle?.id;
    if (!id) return;
    setError('');
    setMensaje('');
    setAbriendoId(id);
    try {
      const respuesta = await obtenerCaso(token, id);
      const data = respuesta.data;
      if (!(data.escenas || []).length) {
        setError('Esta historia aún no tiene lugares para visitar.');
        setDetalle(data);
        setVista('ficha');
        return;
      }
      setDetalle(data);
      setDestacadoId(id);
      setVista('jugar');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setAbriendoId(null);
    }
  }

  async function crearBorradorBasico(evento) {
    evento.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await crearCaso(token, {
        titulo: form.titulo.trim(),
        desarrolloSituacional: form.desarrolloSituacional.trim(),
        contextoHistoria: form.contextoHistoria.trim(),
        tiempoEstimadoSegundos: Number(form.tiempoEstimadoSegundos)
      });
      setForm(formVacio);
      setPersonajesElegidos([]);
      setMensaje('Historia creada. Ahora elige personajes, escenas y evaluación.');
      await cargar();
      setDetalle(respuesta.data);
      setDestacadoId(respuesta.data.id);
      setVista('editor');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function crearCasoCompleto(evento) {
    evento.preventDefault();
    if (personajesElegidos.length === 0) {
      setError('Elige al menos un personaje.');
      return;
    }
    if (!escenarioElegido) {
      setError('Elige un escenario para la primera escena.');
      return;
    }

    setTrabajando(true);
    setError('');
    setMensaje('');
    const nombres = personajesElegidos.map((p) => p.nombre);

    const plantillaEscenas =
      Array.isArray(escenasIa) && escenasIa.length > 0
        ? escenasIa
        : [
            {
              nombre: escenarioElegido.titulo,
              contexto: escenarioElegido.descripcion,
              pregunta: form.pregunta.trim(),
              opcionBuena: form.opcionBuena.trim(),
              opcionMala: form.opcionMala.trim(),
              explicacionBuena: 'Favorece la contención y el diálogo.',
              explicacionMala: 'Evita el conflicto y refuerza la tensión.'
            }
          ];

    const escenasPayload = plantillaEscenas.map((esc, idx) => ({
      nombre: (idx === 0 ? escenarioElegido.titulo : esc.nombre || `Lugar ${idx + 1}`).trim(),
      contexto: (idx === 0 ? escenarioElegido.descripcion : esc.contexto || form.contextoHistoria).trim(),
      orden: idx + 1,
      esFinal: idx === plantillaEscenas.length - 1,
      personajes: nombres,
      decisiones: [
        {
          pregunta: (esc.pregunta || form.pregunta).trim(),
          orden: 1,
          opciones: [
            {
              texto: (esc.opcionBuena || form.opcionBuena).trim(),
              esCorrecta: true,
              orden: 1,
              explicacion: (esc.explicacionBuena || 'Favorece una intervención ética.').trim()
            },
            {
              texto: (esc.opcionMala || form.opcionMala).trim(),
              esCorrecta: false,
              orden: 2,
              explicacion: (esc.explicacionMala || 'Debilita el proceso de intervención.').trim()
            }
          ]
        }
      ]
    }));

    try {
      const respuesta = await construirCaso(token, {
        titulo: form.titulo.trim(),
        desarrolloSituacional: form.desarrolloSituacional.trim(),
        contextoHistoria: form.contextoHistoria.trim(),
        tiempoEstimadoSegundos: Number(form.tiempoEstimadoSegundos),
        personajes: personajesElegidos.map(aPersonajeApi),
        escenas: escenasPayload,
        rubrica: rubricaIa?.criterios?.length
          ? {
              nombre: rubricaIa.nombre || `Evaluación · ${form.titulo.trim()}`,
              descripcion: rubricaIa.descripcion || null,
              criterios: rubricaIa.criterios
            }
          : {
              nombre: `Evaluación · ${form.titulo.trim()}`,
              criterios: [
                {
                  nombre: 'Intervención',
                  ponderacion: 100,
                  puntajeMaximo: 4,
                  niveles: [
                    { nombre: 'Básico', descripcion: 'Identifica el conflicto.', puntaje: 1, orden: 1 },
                    { nombre: 'Avanzado', descripcion: 'Media y propone acuerdo.', puntaje: 4, orden: 2 }
                  ]
                }
              ]
            }
      });

      (respuesta.data?.escenas || []).forEach((escenaCreada, idx) => {
        const ref =
          idx === 0
            ? escenarioElegido
            : emparejarEscenario(plantillaEscenas[idx]?.nombre) || escenarioElegido;
        if (!ref) return;
        guardarPortadaEscena(respuesta.data.id, escenaCreada.id, ref);
        guardarPortadaEscena(respuesta.data.id, escenaCreada.orden, ref);
        guardarPortadaEscena(respuesta.data.id, escenaCreada.nombre, ref);
      });

      try {
        await guardarMaterialCaso(token, respuesta.data.id, {
          dialogos: {},
          portadas: portadasDeCasoLocal(respuesta.data.id)
        });
      } catch {
        /* portadas quedan en localStorage si el servidor falla */
      }

      setForm(formVacio);
      setPersonajesElegidos([]);
      setEscenarioElegido(null);
      setRubricaIa(null);
      setEscenasIa(null);
      setMensaje('Historia lista. Revísala o publícala para jugarla.');
      await cargar();
      setDetalle(respuesta.data);
      setDestacadoId(respuesta.data.id);
      setVista('ficha');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function publicar() {
    if (!detalle?.id) return;
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await publicarCaso(token, detalle.id);
      setDetalle(respuesta.data);
      setMensaje('Historia publicada. Ya está disponible para jugar.');
      await cargar();
      setVista('ficha');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function archivar() {
    if (!detalle?.id) return;
    if (!window.confirm('¿Archivar esta historia? No se podrá editar después.')) return;
    setTrabajando(true);
    setError('');
    try {
      const respuesta = await archivarCaso(token, detalle.id);
      setDetalle(respuesta.data);
      setMensaje('Historia archivada.');
      await cargar();
      setVista('ficha');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="studio">
      <Sidebar
        activa={['ficha', 'editor', 'jugar'].includes(vista) ? 'historias' : vista}
        onCambiar={cambiarVista}
        usuario={usuario}
        onSalir={onSalir}
        token={token}
      />

      <main className="studio-main">
        <header className="studio-top">
          <div>
            <p className="kicker">{admin ? 'Consola administración' : 'Simulador de casos'}</p>
            <h1 className="brand-mark">
              Lumina{' '}
              <span className="role-pill">{admin ? 'Admin' : 'Docente'}</span>
            </h1>
          </div>
          {!['actividades', 'admin', 'seguimiento', 'avisos', 'espacios'].includes(vista) ? (
            <div className="studio-filters">
              <label>
                Buscar
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Título o #id"
                />
              </label>
              <label>
                Estado
                <select
                  value={filtro}
                  onChange={(e) => {
                    setFiltro(e.target.value);
                    cargar(e.target.value);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="Borrador">En preparación</option>
                  <option value="Publicado">Listas</option>
                  <option value="Archivado">Archivadas</option>
                </select>
              </label>
              <button type="button" className="btn-ghost-dark" onClick={() => cargar()}>
                Actualizar
              </button>
            </div>
          ) : null}
        </header>

        {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
        {error ? <div className="alert fade">{error}</div> : null}
        {cargando ? <p className="muted-light">Abriendo historias…</p> : null}
        {abriendoId ? <p className="muted-light">Abriendo historia…</p> : null}

        {vista === 'historias' ? (
          <>
            <div className="quick-nav">
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('crear')}>
                + Crear historia
              </button>
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('actividades')}>
                Actividades
              </button>
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('seguimiento')}>
                Seguimiento
              </button>
              {admin ? (
                <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('admin')}>
                  Admin
                </button>
              ) : null}
            </div>
            <CasoHero
              caso={destacado}
              onAbrir={(caso) => {
                if (caso) abrirFicha(caso);
                else {
                  setMostrarIaCrear(false);
                  setVista('crear');
                }
              }}
              onJugar={(caso) =>
                caso?.estado === 'Borrador' ? abrirEditor(caso) : abrirSimulacion(caso)
              }
            />
            {casosFiltrados.length > 0 ? (
              <CasosCarrusel
                titulo="Recomendado para ti"
                casos={casosFiltrados}
                seleccionadoId={destacado?.id}
                onSeleccionar={(caso) => {
                  setDestacadoId(caso.id);
                  abrirFicha(caso);
                }}
              />
            ) : busqueda.trim() ? (
              <div className="empty-state soft">
                <strong>Sin coincidencias</strong>
                <p className="muted-light">Probá otro término o limpiá la búsqueda.</p>
              </div>
            ) : null}
            {borradores.length > 0 ? (
              <CasosCarrusel
                titulo="Por completar"
                casos={borradores}
                seleccionadoId={destacado?.id}
                onSeleccionar={(caso) => {
                  setDestacadoId(caso.id);
                  abrirFicha(caso);
                }}
              />
            ) : null}
            {publicados.length > 0 ? (
              <CasosCarrusel
                titulo="Listas para jugar"
                casos={publicados}
                seleccionadoId={destacado?.id}
                onSeleccionar={(caso) => {
                  setDestacadoId(caso.id);
                  abrirFicha(caso);
                }}
              />
            ) : null}
          </>
        ) : null}

        {vista === 'banco' ? (
          <BancoPersonajes modo="ver" titulo="Banco de personajes" />
        ) : null}

        {vista === 'actividades' ? <ActividadesPage sesion={sesion} /> : null}
        {vista === 'admin' && admin ? <AdminPage sesion={sesion} /> : null}
        {vista === 'seguimiento' ? (
          <SeguimientoPage sesion={sesion} onIrActividades={() => cambiarVista('actividades')} />
        ) : null}
        {vista === 'avisos' ? <AvisosPage sesion={sesion} /> : null}
        {vista === 'espacios' ? <EspaciosPage sesion={sesion} /> : null}

        {vista === 'biblioteca' ? (
          <>
            <header className="crear-head" style={{ marginBottom: '0.5rem' }}>
              <div>
                <p className="kicker">Biblioteca</p>
                <h2>Todas tus historias</h2>
                <p className="muted-light">Borradores, publicadas y archivadas en un solo lugar.</p>
              </div>
              <button type="button" className="btn-play" onClick={() => cambiarVista('crear')}>
                Nueva historia
              </button>
            </header>
            {casosFiltrados.length === 0 ? (
              <div className="empty-state">
                <strong>{busqueda.trim() ? 'Sin coincidencias' : 'Biblioteca vacía'}</strong>
                <p className="muted-light">
                  {busqueda.trim()
                    ? 'Probá otro término o limpiá la búsqueda.'
                    : 'Creá tu primera historia para empezar la práctica.'}
                </p>
                {!busqueda.trim() ? (
                  <button type="button" className="btn-play" onClick={() => cambiarVista('crear')}>
                    Crear historia
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <CasosCarrusel
                  titulo="Por completar"
                  casos={borradores}
                  seleccionadoId={destacado?.id}
                  onSeleccionar={(caso) => abrirFicha(caso)}
                />
                <CasosCarrusel
                  titulo="Listas para jugar"
                  casos={publicados}
                  seleccionadoId={destacado?.id}
                  onSeleccionar={(caso) => abrirFicha(caso)}
                />
                <CasosCarrusel
                  titulo="Archivadas"
                  casos={archivados}
                  seleccionadoId={destacado?.id}
                  onSeleccionar={(caso) => abrirFicha(caso)}
                />
              </>
            )}
          </>
        ) : null}

        {vista === 'crear' ? (
          <CrearCasoPanel
            token={token}
            form={form}
            setForm={setForm}
            personajesElegidos={personajesElegidos}
            onTogglePersonaje={togglePersonaje}
            escenarioElegido={escenarioElegido}
            onElegirEscenario={setEscenarioElegido}
            mostrarIa={mostrarIaCrear}
            onToggleIa={() => setMostrarIaCrear((v) => !v)}
            trabajando={trabajando}
            onAplicarIa={({ form: generado, personajes, escenario, rubricaSugerida, borrador }) => {
              setForm((prev) => ({
                ...prev,
                ...generado,
                modo: 'completo'
              }));
              if (personajes?.length) setPersonajesElegidos(personajes);
              if (escenario) setEscenarioElegido(escenario);
              if (rubricaSugerida) setRubricaIa(rubricaSugerida);
              if (borrador?.escenasSugeridas?.length) setEscenasIa(borrador.escenasSugeridas);
              else if (borrador?.escenaSugerida) setEscenasIa([borrador.escenaSugerida]);
              setMensaje(
                escenario
                  ? 'Borrador de IA aplicado. Revisalo abajo y creá la historia.'
                  : 'Borrador aplicado. Elegí un escenario para continuar.'
              );
              setError('');
              setMostrarIaCrear(false);
            }}
            onSubmitCompleto={crearCasoCompleto}
            onSubmitBorrador={crearBorradorBasico}
          />
        ) : null}

        {vista === 'ficha' && detalle ? (
          <CasoFicha
            caso={detalle}
            trabajando={trabajando}
            onEditar={abrirEditor}
            onPublicar={publicar}
            onArchivar={archivar}
            onVolver={() => setVista('historias')}
            onJugar={() => abrirSimulacion(detalle)}
          />
        ) : null}

        {vista === 'jugar' && detalle ? (
          <SimulacionPlayer
            key={`play-${detalle.id}`}
            caso={detalle}
            onSalir={() => setVista('historias')}
          />
        ) : null}

        {vista === 'editor' && detalle?.estado === 'Borrador' ? (
          <CasoEditor
            key={detalle.id}
            token={token}
            caso={detalle}
            onCaso={sincronizarDetalle}
            onMensaje={setMensaje}
            onError={setError}
            onPublicar={publicar}
            onArchivar={archivar}
            onVolver={() => setVista('ficha')}
            onVistaPrevia={abrirSimulacion}
            trabajando={trabajando}
            setTrabajando={setTrabajando}
          />
        ) : null}

        {vista === 'editor' && detalle && detalle.estado !== 'Borrador' ? (
          <div className="panel-editor">
            <p>Esta historia ya no se puede editar.</p>
            <button type="button" className="btn-ghost-dark" onClick={() => setVista('ficha')}>
              Ver historia
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
