import { useEffect, useState } from 'react';
import { apiCasos } from '../api/casos.js';

const campo = 'mt-1 w-full border border-linea bg-white px-3 py-2';

export function DetalleCaso({ casoId, onCambiado }) {
  const [caso, setCaso] = useState(null);
  const [errores, setErrores] = useState([]);
  const [escena, setEscena] = useState({ nombre: '', contexto: '', esFinal: false });
  const [basicos, setBasicos] = useState(null);

  async function cargar() {
    setErrores([]);
    const data = await apiCasos.obtener(casoId);
    setCaso(data);
    setBasicos({
      titulo: data.titulo,
      desarrolloSituacional: data.desarrolloSituacional,
      contextoHistoria: data.contextoHistoria,
      tiempoEstimadoSegundos: data.tiempoEstimadoSegundos
    });
  }

  useEffect(() => {
    cargar().catch((error) => setErrores([error.message, ...(error.errores ?? [])]));
  }, [casoId]);

  async function ejecutar(accion) {
    setErrores([]);
    try {
      const actualizado = await accion();
      setCaso(actualizado);
      onCambiado();
    } catch (error) {
      setErrores([error.message, ...(error.errores ?? [])]);
    }
  }

  if (!caso || !basicos) {
    return (
      <div>
        {errores.length > 0 && (
          <div className="border border-arcilla bg-orange-50 px-4 py-3 text-sm">
            {errores.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}
        {errores.length === 0 && <p>Cargando el caso…</p>}
      </div>
    );
  }

  const editable = caso.estado === 'Borrador';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">{caso.titulo}</h2>
        <span className="border border-pino px-2 py-1 text-xs uppercase tracking-wide text-pino">{caso.estado}</span>
      </div>

      {errores.length > 0 && (
        <div className="border border-arcilla bg-orange-50 px-4 py-3 text-sm">
          {errores.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <form
        className="grid gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          ejecutar(() => apiCasos.actualizar(caso.id, {
            ...basicos,
            tiempoEstimadoSegundos: Number(basicos.tiempoEstimadoSegundos)
          }));
        }}
      >
        <label>
          Título
          <input className={campo} disabled={!editable} value={basicos.titulo} onChange={(evento) => setBasicos({ ...basicos, titulo: evento.target.value })} />
        </label>
        <label>
          Desarrollo situacional
          <textarea className={campo} rows="4" disabled={!editable} value={basicos.desarrolloSituacional} onChange={(evento) => setBasicos({ ...basicos, desarrolloSituacional: evento.target.value })} />
        </label>
        <label>
          Contexto de la historia
          <textarea className={campo} rows="3" disabled={!editable} value={basicos.contextoHistoria} onChange={(evento) => setBasicos({ ...basicos, contextoHistoria: evento.target.value })} />
        </label>
        {editable && <button className="justify-self-start border border-pino px-3 py-2 text-pino" type="submit">Guardar datos</button>}
      </form>

      <section>
        <h3 className="font-serif text-xl">Escenas</h3>
        {caso.escenas.map((item) => (
          <article key={item.id} className="mt-3 border border-linea p-3">
            <h4 className="font-medium">{item.orden}. {item.nombre} {item.esFinal ? '· final' : ''}</h4>
            <p className="mt-1 text-sm">{item.contexto}</p>
            {item.personajes.length > 0 && (
              <p className="mt-1 text-sm text-pino">{item.personajes.map((personaje) => personaje.nombre).join(', ')}</p>
            )}
            {item.decisiones.map((decision) => (
              <div key={decision.id} className="mt-3">
                <p className="font-medium">{decision.pregunta}</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {decision.opciones.map((opcion) => (
                    <li key={opcion.id}>
                      {opcion.texto} {opcion.esCorrecta ? '· esperada' : ''}
                      <span className="block text-tinta/70">{opcion.explicacion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))}
      </section>

      {caso.rubrica && (
        <section>
          <h3 className="font-serif text-xl">Rúbrica · versión {caso.rubrica.version}</h3>
          <p className="text-sm">{caso.rubrica.nombre}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {caso.rubrica.criterios.map((criterio) => (
              <li key={criterio.id}>{criterio.nombre} · {criterio.ponderacion}%</li>
            ))}
          </ul>
        </section>
      )}

      {editable && (
        <form
          className="grid gap-2 border border-linea p-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            const orden = caso.escenas.length + 1;
            ejecutar(async () => {
              const actualizado = await apiCasos.agregarEscena(caso.id, { ...escena, orden });
              setEscena({ nombre: '', contexto: '', esFinal: false });
              return actualizado;
            });
          }}
        >
          <h3 className="font-serif text-xl">Agregar escena</h3>
          <input className={campo} placeholder="Nombre" value={escena.nombre} onChange={(evento) => setEscena({ ...escena, nombre: evento.target.value })} />
          <textarea className={campo} rows="2" placeholder="Contexto" value={escena.contexto} onChange={(evento) => setEscena({ ...escena, contexto: evento.target.value })} />
          <button className="justify-self-start bg-pino px-3 py-2 text-white" type="submit">Agregar</button>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        {editable && (
          <button className="bg-arcilla px-4 py-2 text-white" type="button" onClick={() => ejecutar(() => apiCasos.publicar(caso.id))}>
            Publicar
          </button>
        )}
        {caso.estado !== 'Archivado' && (
          <button className="border border-tinta px-4 py-2" type="button" onClick={() => ejecutar(() => apiCasos.archivar(caso.id))}>
            Archivar
          </button>
        )}
      </div>
    </div>
  );
}
