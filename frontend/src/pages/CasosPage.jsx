import { useEffect, useState } from 'react';
import {
  archivarCaso,
  construirCaso,
  crearCaso,
  listarCasos,
  obtenerCaso,
  publicarCaso
} from '../api/client';

const borradorVacio = {
  titulo: '',
  desarrolloSituacional: '',
  contextoHistoria: '',
  tiempoEstimadoSegundos: 600
};

function pillEstado(estado) {
  const clave = String(estado || '').toLowerCase();
  if (clave === 'publicado') return 'pill pill-publicado';
  if (clave === 'archivado') return 'pill pill-archivado';
  return 'pill pill-borrador';
}

export default function CasosPage({ sesion, onSalir }) {
  const { token, usuario } = sesion;
  const [filtro, setFiltro] = useState('');
  const [casos, setCasos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [form, setForm] = useState(borradorVacio);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar(estado = filtro) {
    setCargando(true);
    setError('');
    try {
      const respuesta = await listarCasos(token, {
        estado: estado || undefined,
        creadorId: usuario?.id
      });
      setCasos(respuesta.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function verDetalle(id) {
    setError('');
    setMensaje('');
    try {
      const respuesta = await obtenerCaso(token, id);
      setSeleccionado(respuesta.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function crearBorrador(evento) {
    evento.preventDefault();
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await crearCaso(token, {
        ...form,
        tiempoEstimadoSegundos: Number(form.tiempoEstimadoSegundos)
      });
      setForm(borradorVacio);
      setMensaje('Borrador creado. Completa escenas y rúbrica antes de publicar.');
      await cargar();
      setSeleccionado(respuesta.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  async function crearDemoCompleto() {
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await construirCaso(token, {
        titulo: 'Conflicto en el aula',
        desarrolloSituacional: 'Dos grupos discuten una norma del salón.',
        contextoHistoria: 'Primer semestre de psicología social.',
        tiempoEstimadoSegundos: 600,
        personajes: [
          { nombre: 'Ana', rolSocial: 'Estudiante' }
        ],
        escenas: [
          {
            nombre: 'Aula',
            contexto: 'Inicio de clase',
            orden: 1,
            esFinal: false,
            personajes: ['Ana'],
            decisiones: [
              {
                pregunta: '¿Cómo interviene el docente?',
                orden: 1,
                opciones: [
                  {
                    texto: 'Escucha a ambos',
                    esCorrecta: true,
                    orden: 1,
                    explicacion: 'Contiene el conflicto y modela escucha.'
                  },
                  {
                    texto: 'Ignora la discusión',
                    esCorrecta: false,
                    orden: 2,
                    explicacion: 'Evita la situación y refuerza la tensión.'
                  }
                ]
              }
            ]
          }
        ],
        rubrica: {
          nombre: 'Rúbrica de intervención',
          criterios: [
            {
              nombre: 'Intervención',
              ponderacion: 100,
              puntajeMaximo: 4,
              niveles: [
                { nombre: 'Básico', descripcion: 'Nombra el conflicto.', puntaje: 1, orden: 1 },
                { nombre: 'Avanzado', descripcion: 'Media y propone acuerdo.', puntaje: 4, orden: 2 }
              ]
            }
          ]
        }
      });
      setMensaje('Caso completo creado con Builder. Ya puedes publicarlo.');
      await cargar();
      setSeleccionado(respuesta.data);
    } catch (err) {
      setError(err.message);
      if (Array.isArray(err.errores)) {
        setError(`${err.message}: ${err.errores.join(' ')}`);
      }
    } finally {
      setTrabajando(false);
    }
  }

  async function publicar() {
    if (!seleccionado?.id) return;
    setTrabajando(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await publicarCaso(token, seleccionado.id);
      setSeleccionado(respuesta.data);
      setMensaje('Caso publicado. Actividades ya puede usarlo.');
      await cargar(filtro);
    } catch (err) {
      const detalle = Array.isArray(err.errores) ? err.errores.join(' ') : '';
      setError(`${err.message}${detalle ? ` — ${detalle}` : ''}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function archivar() {
    if (!seleccionado?.id) return;
    setTrabajando(true);
    setError('');
    try {
      const respuesta = await archivarCaso(token, seleccionado.id);
      setSeleccionado(respuesta.data);
      setMensaje('Caso archivado.');
      await cargar(filtro);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="taller">
      <header className="taller-top fade">
        <div>
          <p className="kicker">Taller docente</p>
          <h1 className="brand-mark">Lumina</h1>
        </div>
        <div className="taller-user">
          <span>{usuario?.nombres || usuario?.correo || `Docente #${usuario?.id}`}</span>
          <button type="button" className="btn btn-ghost" onClick={onSalir}>Salir</button>
        </div>
      </header>

      <section className="taller-grid">
        <aside className="panel rise lista-casos">
          <div className="lista-cabecera">
            <h2>Mis casos</h2>
            <select
              value={filtro}
              onChange={(e) => {
                setFiltro(e.target.value);
                cargar(e.target.value);
              }}
            >
              <option value="">Todos</option>
              <option value="Borrador">Borrador</option>
              <option value="Publicado">Publicado</option>
              <option value="Archivado">Archivado</option>
            </select>
          </div>

          {cargando ? <p className="muted">Cargando…</p> : null}
          {!cargando && casos.length === 0 ? <p className="muted">Aún no hay casos.</p> : null}

          <ul>
            {casos.map((caso) => (
              <li key={caso.id}>
                <button
                  type="button"
                  className={seleccionado?.id === caso.id ? 'caso-item activo' : 'caso-item'}
                  onClick={() => verDetalle(caso.id)}
                >
                  <strong>{caso.titulo}</strong>
                  <span className={pillEstado(caso.estado)}>{caso.estado}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="columna-principal">
          <form className="panel rise form-crear" onSubmit={crearBorrador}>
            <h2>Nuevo borrador</h2>
            <div className="field">
              <label htmlFor="titulo">Título</label>
              <input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="desarrollo">Desarrollo situacional</label>
              <textarea
                id="desarrollo"
                value={form.desarrolloSituacional}
                onChange={(e) => setForm({ ...form, desarrolloSituacional: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="contexto">Contexto</label>
              <textarea
                id="contexto"
                value={form.contextoHistoria}
                onChange={(e) => setForm({ ...form, contextoHistoria: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tiempo">Tiempo estimado (segundos)</label>
              <input
                id="tiempo"
                type="number"
                min="1"
                value={form.tiempoEstimadoSegundos}
                onChange={(e) => setForm({ ...form, tiempoEstimadoSegundos: e.target.value })}
                required
              />
            </div>
            <div className="acciones">
              <button className="btn btn-primary" type="submit" disabled={trabajando}>
                Crear borrador
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={trabajando}
                onClick={crearDemoCompleto}
              >
                Crear demo con Builder
              </button>
            </div>
          </form>

          <section className="panel rise detalle">
            <h2>Detalle del caso</h2>
            {!seleccionado ? (
              <p className="muted">Selecciona un caso o crea uno nuevo.</p>
            ) : (
              <>
                <div className="detalle-cabecera">
                  <div>
                    <h3>{seleccionado.titulo}</h3>
                    <span className={pillEstado(seleccionado.estado)}>{seleccionado.estado}</span>
                  </div>
                  <div className="acciones">
                    {seleccionado.estado === 'Borrador' ? (
                      <button className="btn btn-primary" type="button" disabled={trabajando} onClick={publicar}>
                        Publicar
                      </button>
                    ) : null}
                    {seleccionado.estado !== 'Archivado' ? (
                      <button className="btn btn-secondary" type="button" disabled={trabajando} onClick={archivar}>
                        Archivar
                      </button>
                    ) : null}
                  </div>
                </div>
                <p>{seleccionado.desarrolloSituacional}</p>
                <p className="muted">{seleccionado.contextoHistoria}</p>
                <p>
                  <strong>Escenas:</strong> {seleccionado.escenas?.length || 0}
                  {' · '}
                  <strong>Rúbrica:</strong> {seleccionado.rubrica?.nombre || 'Sin rúbrica'}
                </p>
              </>
            )}
          </section>

          {mensaje ? <div className="alert alert-ok fade">{mensaje}</div> : null}
          {error ? <div className="alert fade">{error}</div> : null}
        </div>
      </section>

      <style>{`
        .taller {
          min-height: 100vh;
          padding: clamp(1rem, 3vw, 2.5rem);
          color: var(--paper);
        }
        .taller-top {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .kicker {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 0.75rem;
          opacity: 0.7;
        }
        .taller-top h1 {
          margin: 0.2rem 0 0;
          font-size: clamp(2.4rem, 5vw, 3.6rem);
          line-height: 1;
        }
        .taller-user {
          display: flex;
          gap: 0.8rem;
          align-items: center;
        }
        .taller-grid {
          display: grid;
          grid-template-columns: minmax(240px, 320px) 1fr;
          gap: 1.2rem;
          align-items: start;
        }
        .lista-casos, .form-crear, .detalle {
          padding: 1.25rem;
          color: var(--ink);
        }
        .lista-cabecera {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 1rem;
        }
        .lista-casos h2, .form-crear h2, .detalle h2 {
          font-family: "Fraunces", Georgia, serif;
          margin: 0;
        }
        .lista-casos ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.55rem;
        }
        .caso-item {
          width: 100%;
          text-align: left;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.55);
          border-radius: 1rem;
          padding: 0.85rem 1rem;
          display: grid;
          gap: 0.45rem;
        }
        .caso-item.activo {
          border-color: var(--clay);
          box-shadow: inset 0 0 0 1px var(--clay);
        }
        .columna-principal {
          display: grid;
          gap: 1rem;
        }
        .acciones {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
        }
        .detalle-cabecera {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: start;
          margin-bottom: 0.8rem;
        }
        .detalle-cabecera h3 {
          margin: 0 0 0.5rem;
          font-family: "Fraunces", Georgia, serif;
        }
        @media (max-width: 900px) {
          .taller-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
