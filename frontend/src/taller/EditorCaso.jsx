import { useState } from 'react';
import { apiCasos } from '../api/casos.js';
import { casoVacio, prepararCaso, renumerar } from './plantilla.js';

const campo = 'mt-1 w-full border border-linea bg-white px-3 py-2';

function Errores({ errores }) {
  if (!errores.length) {
    return null;
  }
  return (
    <div className="mb-4 border border-arcilla bg-orange-50 px-4 py-3 text-sm">
      {errores.map((error) => <p key={error}>{error}</p>)}
    </div>
  );
}

export function EditorCaso({ creadorId, onGuardado, onCancelar }) {
  const [caso, setCaso] = useState(casoVacio);
  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  function cambiar(mutar) {
    setCaso((actual) => {
      const copia = structuredClone(actual);
      mutar(copia);
      return copia;
    });
  }

  async function guardar() {
    setGuardando(true);
    setErrores([]);
    try {
      const creado = await apiCasos.construir(prepararCaso(caso, creadorId));
      onGuardado(creado);
    } catch (error) {
      setErrores([error.message, ...(error.errores ?? [])]);
    } finally {
      setGuardando(false);
    }
  }

  const suma = caso.rubrica.criterios.reduce(
    (total, criterio) => total + Number(criterio.ponderacion || 0),
    0
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Nuevo caso</h2>
        <p className="text-sm text-pino">Paso {paso + 1} de 4</p>
      </div>
      <Errores errores={errores} />

      {paso === 0 && (
        <div className="grid gap-4">
          <label>
            Título
            <input className={campo} value={caso.titulo} onChange={(evento) => cambiar((copia) => { copia.titulo = evento.target.value; })} />
          </label>
          <label>
            Desarrollo situacional
            <textarea className={campo} rows="4" value={caso.desarrolloSituacional} onChange={(evento) => cambiar((copia) => { copia.desarrolloSituacional = evento.target.value; })} />
          </label>
          <label>
            Contexto de la historia
            <textarea className={campo} rows="3" value={caso.contextoHistoria} onChange={(evento) => cambiar((copia) => { copia.contextoHistoria = evento.target.value; })} />
          </label>
          <label>
            Tiempo estimado (segundos)
            <input className={campo} type="number" min="1" value={caso.tiempoEstimadoSegundos} onChange={(evento) => cambiar((copia) => { copia.tiempoEstimadoSegundos = Number(evento.target.value); })} />
          </label>
        </div>
      )}

      {paso === 1 && (
        <div className="grid gap-3">
          {caso.personajes.map((personaje, indice) => (
            <div key={indice} className="grid gap-2 border border-linea p-3 md:grid-cols-2">
              <input className={campo} placeholder="Nombre" value={personaje.nombre} onChange={(evento) => cambiar((copia) => { copia.personajes[indice].nombre = evento.target.value; })} />
              <input className={campo} placeholder="Rol social" value={personaje.rolSocial} onChange={(evento) => cambiar((copia) => { copia.personajes[indice].rolSocial = evento.target.value; })} />
              <textarea className={`${campo} md:col-span-2`} rows="2" placeholder="Perfil" value={personaje.perfil} onChange={(evento) => cambiar((copia) => { copia.personajes[indice].perfil = evento.target.value; })} />
            </div>
          ))}
          <button
            className="border border-pino px-3 py-2 text-pino"
            type="button"
            onClick={() => cambiar((copia) => {
              copia.personajes.push({ nombre: '', rolSocial: '', perfil: '', pautasComportamiento: '' });
            })}
          >
            Agregar personaje
          </button>
        </div>
      )}

      {paso === 2 && (
        <div className="grid gap-4">
          {caso.escenas.map((escena, indiceEscena) => (
            <article key={indiceEscena} className="border border-linea p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <input className={campo} placeholder="Nombre de la escena" value={escena.nombre} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].nombre = evento.target.value; })} />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={escena.esFinal}
                    onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].esFinal = evento.target.checked; })}
                  />
                  Escena final
                </label>
                <textarea className={`${campo} md:col-span-2`} rows="2" placeholder="Contexto" value={escena.contexto} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].contexto = evento.target.value; })} />
              </div>
              {caso.personajes.some((personaje) => personaje.nombre.trim()) && (
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {caso.personajes.filter((personaje) => personaje.nombre.trim()).map((personaje) => (
                    <label key={personaje.nombre} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={escena.personajes.includes(personaje.nombre.trim())}
                        onChange={(evento) => cambiar((copia) => {
                          const nombre = personaje.nombre.trim();
                          const lista = copia.escenas[indiceEscena].personajes;
                          copia.escenas[indiceEscena].personajes = evento.target.checked
                            ? [...lista, nombre]
                            : lista.filter((item) => item !== nombre);
                        })}
                      />
                      {personaje.nombre}
                    </label>
                  ))}
                </div>
              )}
              {escena.decisiones.map((item, indiceDecision) => (
                <div key={indiceDecision} className="mt-3 border-t border-linea pt-3">
                  <textarea className={campo} rows="2" placeholder="Pregunta" value={item.pregunta} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].decisiones[indiceDecision].pregunta = evento.target.value; })} />
                  <input className={campo} placeholder="Ayuda opcional" value={item.ayuda} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].decisiones[indiceDecision].ayuda = evento.target.value; })} />
                  {item.opciones.map((itemOpcion, indiceOpcion) => (
                    <div key={indiceOpcion} className="mt-2 grid gap-2 bg-arena/60 p-2">
                      <input className={campo} placeholder="Opción" value={itemOpcion.texto} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].decisiones[indiceDecision].opciones[indiceOpcion].texto = evento.target.value; })} />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={itemOpcion.esCorrecta}
                          onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].decisiones[indiceDecision].opciones[indiceOpcion].esCorrecta = evento.target.checked; })}
                        />
                        Opción esperada
                      </label>
                      <textarea className={campo} rows="2" placeholder="Explicación" value={itemOpcion.explicacion} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].decisiones[indiceDecision].opciones[indiceOpcion].explicacion = evento.target.value; })} />
                      <input className={campo} placeholder="Fundamento teórico" value={itemOpcion.fundamentoTeorico} onChange={(evento) => cambiar((copia) => { copia.escenas[indiceEscena].decisiones[indiceDecision].opciones[indiceOpcion].fundamentoTeorico = evento.target.value; })} />
                    </div>
                  ))}
                  <button
                    className="mt-2 text-sm text-pino"
                    type="button"
                    onClick={() => cambiar((copia) => {
                      const opciones = copia.escenas[indiceEscena].decisiones[indiceDecision].opciones;
                      opciones.push({
                        texto: '',
                        esCorrecta: false,
                        consecuencia: '',
                        orden: opciones.length + 1,
                        explicacion: '',
                        fundamentoTeorico: ''
                      });
                    })}
                  >
                    Agregar opción
                  </button>
                </div>
              ))}
              <button
                className="mt-3 text-sm text-pino"
                type="button"
                onClick={() => cambiar((copia) => {
                  const decisiones = copia.escenas[indiceEscena].decisiones;
                  decisiones.push({
                    pregunta: '',
                    orden: decisiones.length + 1,
                    ayuda: '',
                    opciones: [
                      { texto: '', esCorrecta: true, consecuencia: '', orden: 1, explicacion: '', fundamentoTeorico: '' },
                      { texto: '', esCorrecta: false, consecuencia: '', orden: 2, explicacion: '', fundamentoTeorico: '' }
                    ]
                  });
                })}
              >
                Agregar pregunta
              </button>
            </article>
          ))}
          <button
            className="border border-pino px-3 py-2 text-pino"
            type="button"
            onClick={() => cambiar((copia) => {
              copia.escenas.push({
                nombre: '',
                contexto: '',
                orden: copia.escenas.length + 1,
                esFinal: false,
                personajes: [],
                decisiones: []
              });
              copia.escenas = renumerar(copia.escenas);
            })}
          >
            Agregar escena
          </button>
        </div>
      )}

      {paso === 3 && (
        <div className="grid gap-3">
          <label>
            Nombre de la rúbrica
            <input className={campo} value={caso.rubrica.nombre} onChange={(evento) => cambiar((copia) => { copia.rubrica.nombre = evento.target.value; })} />
          </label>
          <label>
            Descripción
            <textarea className={campo} rows="2" value={caso.rubrica.descripcion} onChange={(evento) => cambiar((copia) => { copia.rubrica.descripcion = evento.target.value; })} />
          </label>
          <p className="text-sm">Suma de ponderaciones: {suma}. Debe ser 100 para publicar.</p>
          {caso.rubrica.criterios.map((criterio, indice) => (
            <div key={indice} className="grid gap-2 border border-linea p-3">
              <input className={campo} placeholder="Criterio" value={criterio.nombre} onChange={(evento) => cambiar((copia) => { copia.rubrica.criterios[indice].nombre = evento.target.value; })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Ponderación
                  <input className={campo} type="number" value={criterio.ponderacion} onChange={(evento) => cambiar((copia) => { copia.rubrica.criterios[indice].ponderacion = Number(evento.target.value); })} />
                </label>
                <label className="text-sm">
                  Puntaje máximo
                  <input className={campo} type="number" value={criterio.puntajeMaximo} onChange={(evento) => cambiar((copia) => { copia.rubrica.criterios[indice].puntajeMaximo = Number(evento.target.value); })} />
                </label>
              </div>
              {criterio.niveles.map((nivel, indiceNivel) => (
                <div key={indiceNivel} className="grid gap-2 md:grid-cols-3">
                  <input className={campo} placeholder="Nivel" value={nivel.nombre} onChange={(evento) => cambiar((copia) => { copia.rubrica.criterios[indice].niveles[indiceNivel].nombre = evento.target.value; })} />
                  <input className={campo} placeholder="Descripción" value={nivel.descripcion} onChange={(evento) => cambiar((copia) => { copia.rubrica.criterios[indice].niveles[indiceNivel].descripcion = evento.target.value; })} />
                  <input className={campo} type="number" value={nivel.puntaje} onChange={(evento) => cambiar((copia) => { copia.rubrica.criterios[indice].niveles[indiceNivel].puntaje = Number(evento.target.value); })} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-between gap-3">
        <button className="px-3 py-2" type="button" onClick={() => (paso === 0 ? onCancelar() : setPaso((actual) => actual - 1))}>
          {paso === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {paso < 3 ? (
          <button className="bg-pino px-4 py-2 text-white" type="button" onClick={() => setPaso((actual) => actual + 1)}>
            Siguiente
          </button>
        ) : (
          <button className="bg-arcilla px-4 py-2 text-white disabled:opacity-60" type="button" disabled={guardando || !creadorId} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar borrador'}
          </button>
        )}
      </div>
      {!creadorId && <p className="mt-3 text-sm text-arcilla">Escribe el ID del docente antes de guardar.</p>}
    </div>
  );
}
