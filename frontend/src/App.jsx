import { useEffect, useState } from 'react';
import { apiCasos } from './api/casos.js';
import { DetalleCaso } from './taller/DetalleCaso.jsx';
import { EditorCaso } from './taller/EditorCaso.jsx';

const CLAVE_DOCENTE = 'lumina.docenteId';

function mensajeError(error) {
  return [error.message, ...(error.errores ?? [])].filter(Boolean);
}

export default function App() {
  const [docenteId, setDocenteId] = useState(() => localStorage.getItem(CLAVE_DOCENTE) ?? '');
  const [casos, setCasos] = useState([]);
  const [vista, setVista] = useState('lista');
  const [casoId, setCasoId] = useState(null);
  const [error, setError] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    localStorage.setItem(CLAVE_DOCENTE, docenteId);
  }, [docenteId]);

  async function cargarCasos(id = docenteId) {
    if (!id) {
      setCasos([]);
      return;
    }
    setCargando(true);
    setError([]);
    try {
      const data = await apiCasos.listar(id);
      setCasos(Array.isArray(data) ? data : []);
    } catch (fallo) {
      setCasos([]);
      setError(mensajeError(fallo));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (docenteId) {
      cargarCasos(docenteId);
    }
  }, []);

  function abrirDetalle(id) {
    setCasoId(id);
    setVista('detalle');
    setError([]);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-linea bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-pino">Lumina</p>
            <h1 className="font-serif text-3xl text-tinta">Casos del docente</h1>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              setVista('lista');
              cargarCasos(docenteId);
            }}
          >
            <label className="text-sm">
              ID del docente
              <input
                className="mt-1 block w-28 border border-linea bg-white px-3 py-2"
                inputMode="numeric"
                value={docenteId}
                onChange={(evento) => setDocenteId(evento.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button className="bg-pino px-4 py-2 text-white" type="submit">
              Ver mis casos
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="border border-linea bg-card p-4">
          <button
            className="mb-4 w-full border border-arcilla px-3 py-2 text-arcilla"
            type="button"
            onClick={() => {
              setVista('nuevo');
              setCasoId(null);
              setError([]);
            }}
          >
            Nuevo caso
          </button>
          {cargando && <p className="text-sm">Cargando casos…</p>}
          <ul className="space-y-2">
            {casos.map((caso) => (
              <li key={caso.id}>
                <button
                  className="w-full border border-linea px-3 py-2 text-left hover:border-pino"
                  type="button"
                  onClick={() => abrirDetalle(caso.id)}
                >
                  <span className="block font-medium">{caso.titulo}</span>
                  <span className="text-xs uppercase tracking-wide text-pino">{caso.estado}</span>
                </button>
              </li>
            ))}
          </ul>
          {!cargando && casos.length === 0 && (
            <p className="text-sm text-tinta/70">Todavía no hay casos para este docente.</p>
          )}
        </aside>

        <section className="border border-linea bg-card p-5">
          {error.length > 0 && (
            <div className="mb-4 border border-arcilla bg-orange-50 px-4 py-3 text-sm">
              {error.map((linea) => <p key={linea}>{linea}</p>)}
            </div>
          )}

          {vista === 'nuevo' && (
            <EditorCaso
              creadorId={docenteId}
              onCancelar={() => setVista('lista')}
              onGuardado={(caso) => {
                abrirDetalle(caso.id);
                cargarCasos();
              }}
            />
          )}

          {vista === 'detalle' && casoId && (
            <DetalleCaso
              casoId={casoId}
              onCambiado={() => cargarCasos()}
            />
          )}

          {vista === 'lista' && (
            <div className="font-serif">
              <h2 className="text-2xl">Taller de casos</h2>
              <p className="mt-3 max-w-2xl text-base leading-7">
                Aquí se crean los casos situacionales, sus escenas, preguntas,
                explicaciones y la rúbrica. El caso queda en borrador hasta que
                la estructura esté completa y se publique.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
