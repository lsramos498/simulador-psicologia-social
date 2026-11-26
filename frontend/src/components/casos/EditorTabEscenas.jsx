import BancoPersonajes from '../BancoPersonajes';
import SelectorEscenarios from '../SelectorEscenarios';
import { portadaEscena } from '../../utils/escenasLocal';

export default function EditorTabEscenas({
  casoId,
  escenas,
  personajes,
  escenaForm,
  setEscenaForm,
  escenarioNuevo,
  setEscenarioNuevo,
  personajesEscenaNueva = [],
  onTogglePersonajeEscena,
  decisionForms,
  setDecisionForms,
  opcionForms,
  setOpcionForms,
  trabajando,
  onCrearEscena,
  onGuardarEscena,
  onVincularPj,
  onCrearDecision,
  onGuardarDecision,
  onCrearOpcion,
  onGuardarOpcion
}) {
  return (
    <div className="panel-editor">
      {(escenas || []).length === 0 ? (
        <p className="muted-light">
          Todavía no hay escenas. Crea una abajo: elige escenario y personajes en el mismo paso.
        </p>
      ) : null}
      <form onSubmit={onCrearEscena} className="bloque-nuevo escena-creacion-bloque">
        <h3>Nueva escena</h3>
        <p className="muted-light">
          En esta misma creación eliges el escenario y los personajes que participan. No hay un módulo
          aparte de personajes.
        </p>
        <SelectorEscenarios
          titulo="Escenario de esta escena"
          valor={escenarioNuevo}
          onElegir={(esc) => {
            setEscenarioNuevo(esc);
            setEscenaForm({
              ...escenaForm,
              nombre: esc.titulo,
              contexto: esc.descripcion
            });
          }}
        />
        <BancoPersonajes
          modo="elegir"
          titulo="Personajes de esta escena"
          seleccionados={personajesEscenaNueva}
          onToggle={onTogglePersonajeEscena}
        />
        <div className="crear-grid">
          <div className="field">
            <label htmlFor="es-nom">Nombre</label>
            <input
              id="es-nom"
              value={escenaForm.nombre}
              maxLength={150}
              onChange={(e) => setEscenaForm({ ...escenaForm, nombre: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="es-fin">¿Es final?</label>
            <select
              id="es-fin"
              value={escenaForm.esFinal ? 'si' : 'no'}
              onChange={(e) => setEscenaForm({ ...escenaForm, esFinal: e.target.value === 'si' })}
            >
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="es-ctx">Contexto</label>
          <textarea
            id="es-ctx"
            rows={2}
            value={escenaForm.contexto}
            onChange={(e) => setEscenaForm({ ...escenaForm, contexto: e.target.value })}
            required
          />
        </div>
        <button className="btn-play" type="submit" disabled={trabajando}>
          Crear escena
        </button>
      </form>

      {[...(escenas || [])]
        .sort((a, b) => a.orden - b.orden)
        .map((escena) => {
          const idsEnEscena = new Set((escena.personajes || []).map((p) => p.id));
          const disponibles = (personajes || []).filter((p) => !idsEnEscena.has(p.id));
          const dForm = decisionForms[escena.id] || { pregunta: '', ayuda: '' };
          const portada = portadaEscena(casoId, escena);

          return (
            <article key={escena.id} className="nodo-escena editable">
              {portada?.imagen ? (
                <div
                  className="escena-portada"
                  style={{
                    backgroundImage: `linear-gradient(90deg, transparent, rgba(8,6,16,0.75)), url('${portada.imagen}')`
                  }}
                />
              ) : null}
              <header className="escena-edit-head">
                <strong>
                  Escena {escena.orden}: {escena.nombre}
                </strong>
                <label className="check-inline">
                  <input
                    type="checkbox"
                    checked={Boolean(escena.esFinal)}
                    onChange={(e) => onGuardarEscena(escena, { esFinal: e.target.checked })}
                  />
                  Final
                </label>
              </header>

              <div className="field">
                <label>Contexto</label>
                <textarea
                  rows={2}
                  defaultValue={escena.contexto}
                  onBlur={(e) => {
                    if (e.target.value !== escena.contexto) {
                      onGuardarEscena(escena, { contexto: e.target.value });
                    }
                  }}
                />
              </div>

              <div className="asociar-row">
                <p className="muted-light" style={{ margin: 0 }}>
                  Personajes en esta escena:{' '}
                  <strong>
                    {(escena.personajes || []).map((p) => p.nombre).join(', ') || 'ninguno'}
                  </strong>
                </p>
                {disponibles.length > 0 ? (
                  <label>
                    Agregar otro del caso
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        e.target.value = '';
                        onVincularPj(escena.id, val);
                      }}
                    >
                      <option value="" disabled>
                        Elegir…
                      </option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {(escena.decisiones || []).map((decision) => {
                const oForm = opcionForms[decision.id] || {
                  texto: '',
                  explicacion: '',
                  esCorrecta: false,
                  fundamentoTeorico: ''
                };
                return (
                  <div key={decision.id} className="nodo-decision editable">
                    <div className="field">
                      <label>Pregunta (orden {decision.orden})</label>
                      <input
                        defaultValue={decision.pregunta}
                        onBlur={(e) => {
                          if (e.target.value !== decision.pregunta) {
                            onGuardarDecision(decision, { pregunta: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <ul className="lista-ops">
                      {(decision.opciones || []).map((op) => (
                        <li key={op.id}>
                          <label className="check-inline">
                            <input
                              type="checkbox"
                              checked={Boolean(op.esCorrecta)}
                              onChange={(e) => onGuardarOpcion(op, { esCorrecta: e.target.checked })}
                            />
                            Correcta
                          </label>
                          <input
                            className="op-texto"
                            defaultValue={op.texto}
                            onBlur={(e) => {
                              if (e.target.value !== op.texto) {
                                onGuardarOpcion(op, { texto: e.target.value });
                              }
                            }}
                          />
                          <input
                            className="op-exp"
                            defaultValue={op.explicacion || ''}
                            placeholder="Explicación"
                            onBlur={(e) => {
                              if (e.target.value !== (op.explicacion || '')) {
                                onGuardarOpcion(op, { explicacion: e.target.value });
                              }
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                    <div className="crear-grid">
                      <div className="field">
                        <label>Nueva opción</label>
                        <input
                          value={oForm.texto}
                          onChange={(e) =>
                            setOpcionForms((prev) => ({
                              ...prev,
                              [decision.id]: { ...oForm, texto: e.target.value }
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Explicación</label>
                        <input
                          value={oForm.explicacion}
                          onChange={(e) =>
                            setOpcionForms((prev) => ({
                              ...prev,
                              [decision.id]: { ...oForm, explicacion: e.target.value }
                            }))
                          }
                        />
                      </div>
                    </div>
                    <label className="check-inline">
                      <input
                        type="checkbox"
                        checked={Boolean(oForm.esCorrecta)}
                        onChange={(e) =>
                          setOpcionForms((prev) => ({
                            ...prev,
                            [decision.id]: { ...oForm, esCorrecta: e.target.checked }
                          }))
                        }
                      />
                      Marcar como correcta
                    </label>
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      disabled={trabajando}
                      onClick={() => onCrearOpcion(decision)}
                    >
                      Agregar opción
                    </button>
                  </div>
                );
              })}

              <div className="bloque-nuevo soft">
                <div className="field">
                  <label>Nueva pregunta</label>
                  <input
                    value={dForm.pregunta}
                    onChange={(e) =>
                      setDecisionForms((prev) => ({
                        ...prev,
                        [escena.id]: { ...dForm, pregunta: e.target.value }
                      }))
                    }
                    placeholder="¿Qué harías en esta situación?"
                  />
                </div>
                <button
                  type="button"
                  className="btn-ghost-dark"
                  disabled={trabajando}
                  onClick={() => onCrearDecision(escena)}
                >
                  Agregar pregunta
                </button>
              </div>
            </article>
          );
        })}
    </div>
  );
}
