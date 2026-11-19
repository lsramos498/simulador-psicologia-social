import BancoPersonajes from '../BancoPersonajes';
import SelectorEscenarios from '../SelectorEscenarios';
import AsistenteIACasos from './AsistenteIACasos';

export default function CrearCasoPanel({
  token,
  form,
  setForm,
  personajesElegidos,
  onTogglePersonaje,
  escenarioElegido,
  onElegirEscenario,
  mostrarIa,
  onToggleIa,
  trabajando,
  onAplicarIa,
  onSubmitCompleto,
  onSubmitBorrador
}) {
  return (
    <section className="crear-caso">
      <header className="crear-head">
        <div>
          <p className="kicker">Nuevo caso</p>
          <h2>Crear manualmente</h2>
          <p className="muted-light">
            Completá título, contexto, personajes y lugares. Si querés ayuda, usá Crear con IA.
          </p>
        </div>
        <div className="crear-head-acciones">
          <div className="modo-crear">
            <button
              type="button"
              className={form.modo === 'completo' ? 'tab activo' : 'tab'}
              onClick={() => setForm({ ...form, modo: 'completo' })}
            >
              Lista para jugar
            </button>
            <button
              type="button"
              className={form.modo === 'borrador' ? 'tab activo' : 'tab'}
              onClick={() => setForm({ ...form, modo: 'borrador' })}
            >
              Empezar vacía
            </button>
          </div>
          <button
            type="button"
            className={mostrarIa ? 'btn-play btn-ia-toggle activo' : 'btn-play btn-ia-toggle'}
            onClick={onToggleIa}
          >
            {mostrarIa ? 'Ocultar IA' : 'Crear con IA'}
          </button>
        </div>
      </header>

      {mostrarIa ? (
        <AsistenteIACasos token={token} disabled={trabajando} onAplicar={onAplicarIa} />
      ) : null}

      {form.modo === 'completo' ? (
        <>
          <BancoPersonajes
            modo="elegir"
            titulo="Elige personajes"
            seleccionados={personajesElegidos}
            onToggle={onTogglePersonaje}
          />
          <SelectorEscenarios
            titulo="¿A dónde llega primero el estudiante?"
            valor={escenarioElegido}
            onElegir={onElegirEscenario}
          />
        </>
      ) : (
        <p className="muted-light">
          Creas la historia vacía y luego sumas personajes, escenarios y evaluación.
        </p>
      )}

      <form
        className="crear-form"
        onSubmit={form.modo === 'completo' ? onSubmitCompleto : onSubmitBorrador}
      >
        <div className="field">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            value={form.titulo}
            maxLength={200}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            required
            placeholder="Conflicto en el aula"
          />
        </div>
        <div className="field">
          <label htmlFor="desarrollo">Desarrollo situacional</label>
          <textarea
            id="desarrollo"
            value={form.desarrolloSituacional}
            onChange={(e) => setForm({ ...form, desarrolloSituacional: e.target.value })}
            required
            rows={3}
          />
        </div>
        <div className="field">
          <label htmlFor="contexto">Contexto de la historia</label>
          <textarea
            id="contexto"
            value={form.contextoHistoria}
            onChange={(e) => setForm({ ...form, contextoHistoria: e.target.value })}
            required
            rows={3}
          />
        </div>
        <div className="field">
          <label htmlFor="tiempo">Tiempo estimado (seg)</label>
          <input
            id="tiempo"
            type="number"
            min="1"
            value={form.tiempoEstimadoSegundos}
            onChange={(e) => setForm({ ...form, tiempoEstimadoSegundos: e.target.value })}
            required
          />
        </div>

        {form.modo === 'completo' ? (
          <>
            <div className="field">
              <label htmlFor="pregunta">Pregunta de la escena</label>
              <input
                id="pregunta"
                value={form.pregunta}
                onChange={(e) => setForm({ ...form, pregunta: e.target.value })}
                required
              />
            </div>
            <div className="crear-grid">
              <div className="field">
                <label htmlFor="buena">Opción correcta</label>
                <input
                  id="buena"
                  value={form.opcionBuena}
                  onChange={(e) => setForm({ ...form, opcionBuena: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="mala">Opción incorrecta</label>
                <input
                  id="mala"
                  value={form.opcionMala}
                  onChange={(e) => setForm({ ...form, opcionMala: e.target.value })}
                  required
                />
              </div>
            </div>
          </>
        ) : null}

        <button className="btn-play" type="submit" disabled={trabajando}>
          <span className="play-tri" aria-hidden="true" />
          {trabajando
            ? 'Creando…'
            : form.modo === 'completo'
              ? 'Crear historia'
              : 'Empezar historia'}
        </button>
      </form>
    </section>
  );
}
