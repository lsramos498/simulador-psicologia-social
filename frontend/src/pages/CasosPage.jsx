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
import { emparejarEscenario, enriquecerEscenasIa } from '../components/casos/AsistenteIACasos';
import CasosListaOrganizada from '../components/casos/CasosListaOrganizada';
import GameDecor from '../components/GameDecor';
import ActividadesPage from './ActividadesPage';
import AdminPage from './AdminPage';
import AvisosPage from './AvisosPage';
import EspaciosPage from './EspaciosPage';
import GruposEstudiantesPage from './GruposEstudiantesPage';
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
  const [casoProgramarId, setCasoProgramarId] = useState(null);

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

    const plantillaEscenas = enriquecerEscenasIa(
      Array.isArray(escenasIa) && escenasIa.length > 0
        ? escenasIa
        : [
            {
              nombre: escenarioElegido.titulo,
              contexto:
                form.contextoHistoria?.trim() ||
                escenarioElegido.descripcion ||
                '',
              pregunta: form.pregunta.trim(),
              opcionBuena: form.opcionBuena.trim(),
              opcionMala: form.opcionMala.trim(),
              explicacionBuena: 'Favorece la contención y el diálogo.',
              explicacionMala: 'Evita el conflicto y refuerza la tensión.'
            }
          ],
      escenarioElegido
    );

    const escenasPayload = plantillaEscenas.map((esc, idx) => ({
      nombre: String(esc.nombre || `Lugar ${idx + 1}`).trim(),
      contexto: String(
        esc.contexto || form.contextoHistoria || escenarioElegido.descripcion || ''
      ).trim(),
      orden: idx + 1,
      esFinal: idx === plantillaEscenas.length - 1,
      personajes: nombres,
      decisiones: [
        {
          pregunta: String(esc.pregunta || form.pregunta).trim(),
          orden: 1,
          opciones: [
            {
              texto: String(esc.opcionBuena || form.opcionBuena).trim(),
              esCorrecta: true,
              orden: 1,
              explicacion: String(
                esc.explicacionBuena || 'Favorece una intervención ética.'
              ).trim()
            },
            {
              texto: String(esc.opcionMala || form.opcionMala).trim(),
              esCorrecta: false,
              orden: 2,
              explicacion: String(
                esc.explicacionMala || 'Debilita el proceso de intervención.'
              ).trim()
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
        rubrica: (() => {
          const cargada = form.rubricaCargada?.criterios?.length ? form.rubricaCargada : null;
          const deIa = rubricaIa?.criterios?.length ? rubricaIa : null;
          const fuente = cargada || deIa;
          if (fuente) {
            return {
              nombre: fuente.nombre || `Evaluación - ${form.titulo.trim()}`,
              descripcion: fuente.descripcion || null,
              criterios: fuente.criterios
            };
          }
          return {
            nombre: `Evaluación - ${form.titulo.trim()}`,
            descripcion: form.rubricaPdfTexto
              ? String(form.rubricaPdfTexto).slice(0, 2000)
              : null,
            criterios: [
              {
                nombre: 'Intervención',
                ponderacion: 100,
                puntajeMaximo: 5,
                niveles: [
                  { nombre: 'Básico', descripcion: 'Identifica el conflicto.', puntaje: 1, orden: 1 },
                  { nombre: 'Avanzado', descripcion: 'Media y propone acuerdo.', puntaje: 5, orden: 2 }
                ]
              }
            ]
          };
        })()
      });

      (respuesta.data?.escenas || []).forEach((escenaCreada, idx) => {
        const ref =
          plantillaEscenas[idx]?.escenarioRef ||
          (idx === 0
            ? escenarioElegido
            : emparejarEscenario(plantillaEscenas[idx]?.nombre) || escenarioElegido);
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
      const publicado = respuesta.data;
      setDetalle(publicado);
      setCasoProgramarId(publicado?.id || detalle.id);
      setMensaje('Caso publicado. Elige un grupo y programa la actividad.');
      await cargar();
      setVista('actividades');
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
          {!['actividades', 'admin', 'seguimiento', 'avisos', 'espacios', 'estudiantes'].includes(vista) ? (
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
        {cargando ? <p className="muted-light">Abriendo casos…</p> : null}
        {abriendoId ? <p className="muted-light">Abriendo caso…</p> : null}

        {vista === 'historias' ? (
          <>
            <div className="quick-nav">
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('crear')}>
                + Crear caso
              </button>
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('estudiantes')}>
                Grupos y estudiantes
              </button>
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('actividades')}>
                Actividades
              </button>
              <button type="button" className="chip-ejemplo" onClick={() => cambiarVista('crear')}>
                Crear caso
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
              <GameDecor
                variant="empty"
                munecos={2}
                title="Sin coincidencias"
                text="Prueba otro término o limpia la búsqueda."
              />
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
            <CasosListaOrganizada
              titulo="Organizar casos"
              subtitulo="Tabla rápida: ver o editar según el estado."
              casos={casosFiltrados}
              onCrear={() => {
                setMostrarIaCrear(false);
                cambiarVista('crear');
              }}
              onVer={(caso) => {
                setDestacadoId(caso.id);
                abrirFicha(caso);
              }}
              onEditar={(caso) => abrirEditor(caso)}
            />
          </>
        ) : null}

        {vista === 'actividades' ? (
          <ActividadesPage
            sesion={sesion}
            casoIdInicial={casoProgramarId}
            onCasoInicialConsumido={() => setCasoProgramarId(null)}
          />
        ) : null}
        {vista === 'estudiantes' ? <GruposEstudiantesPage sesion={sesion} /> : null}
        {vista === 'admin' && admin ? <AdminPage sesion={sesion} /> : null}
        {vista === 'seguimiento' ? (
          <SeguimientoPage sesion={sesion} onIrActividades={() => cambiarVista('actividades')} />
        ) : null}
        {vista === 'avisos' ? <AvisosPage sesion={sesion} /> : null}
        {vista === 'espacios' ? <EspaciosPage sesion={sesion} /> : null}

        {vista === 'biblioteca' ? (
          <>
            <CasosListaOrganizada
              titulo="Biblioteca de casos"
              subtitulo="Borradores, publicados y archivados en un solo listado."
              casos={casosFiltrados}
              onCrear={() => {
                setMostrarIaCrear(false);
                cambiarVista('crear');
              }}
              onVer={(caso) => abrirFicha(caso)}
              onEditar={(caso) => abrirEditor(caso)}
            />
            {borradores.length > 0 ? (
              <CasosCarrusel
                titulo="Por completar"
                casos={borradores}
                seleccionadoId={destacado?.id}
                onSeleccionar={(caso) => abrirFicha(caso)}
              />
            ) : null}
            {publicados.length > 0 ? (
              <CasosCarrusel
                titulo="Listas para jugar"
                casos={publicados}
                seleccionadoId={destacado?.id}
                onSeleccionar={(caso) => abrirFicha(caso)}
              />
            ) : null}
            {archivados.length > 0 ? (
              <CasosCarrusel
                titulo="Archivados"
                casos={archivados}
                seleccionadoId={destacado?.id}
                onSeleccionar={(caso) => abrirFicha(caso)}
              />
            ) : null}
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
            setTrabajando={setTrabajando}
            onMensaje={setMensaje}
            onError={setError}
            onRubricaCargada={(rubrica) => {
              if (rubrica?.criterios?.length) {
                setRubricaIa(rubrica);
              }
            }}
            onCasoImportado={async (caso) => {
              if (caso?.id) {
                try {
                  const completo = await obtenerCaso(token, caso.id);
                  const data = completo.data || caso;
                  (data.escenas || []).forEach((escena, idx) => {
                    const ref =
                      emparejarEscenario(escena.nombre) ||
                      emparejarEscenario(data.titulo) ||
                      emparejarEscenario(`escenario ${idx + 1}`);
                    if (!ref) return;
                    guardarPortadaEscena(data.id, escena.id, ref);
                    guardarPortadaEscena(data.id, escena.orden, ref);
                    guardarPortadaEscena(data.id, escena.nombre, ref);
                  });
                  await guardarMaterialCaso(token, data.id, {
                    dialogos: data.material?.dialogos || {},
                    portadas: portadasDeCasoLocal(data.id)
                  });
                } catch {
                  /* el caso queda importado; portadas se pueden asignar en el editor */
                }
              }
              await cargar();
              if (caso?.id) abrirFicha(caso);
            }}
            onAplicarIa={({
              form: generado,
              personajes,
              escenario,
              rubricaSugerida,
              escenasSugeridas,
              borrador
            }) => {
              const escenas =
                Array.isArray(escenasSugeridas) && escenasSugeridas.length
                  ? escenasSugeridas
                  : Array.isArray(borrador?.escenasSugeridas) && borrador.escenasSugeridas.length
                    ? borrador.escenasSugeridas
                    : borrador?.escenaSugerida
                      ? [borrador.escenaSugerida]
                      : [];
              setForm((prev) => ({
                ...prev,
                ...generado,
                modo: 'completo'
              }));
              if (personajes?.length) setPersonajesElegidos(personajes);
              if (escenario) setEscenarioElegido(escenario);
              if (rubricaSugerida) setRubricaIa(rubricaSugerida);
              if (escenas.length) setEscenasIa(escenas);
              setMensaje(
                [
                  'Borrador de IA aplicado:',
                  personajes?.length ? `${personajes.length} personajes` : null,
                  escenario ? `escenario «${escenario.titulo}»` : null,
                  escenas.length ? `${escenas.length} escenas con pregunta y opciones` : null,
                  'Revisa y pulsa Crear caso.'
                ]
                  .filter(Boolean)
                  .join(' - ')
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
