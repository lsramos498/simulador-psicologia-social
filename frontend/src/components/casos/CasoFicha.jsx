import CasoHero from '../CasoHero';
import { imagenDePersonaje } from '../../data/bancoPersonajes';
import { checklistPublicacion, esEditable, pillEstado } from '../../utils/casoHelpers';
import { portadaEscena } from '../../utils/escenasLocal';

export default function CasoFicha({
  caso,
  trabajando,
  onEditar,
  onPublicar,
  onArchivar,
  onVolver,
  onJugar
}) {
  if (!caso) return null;
  const editable = esEditable(caso.estado);
  const checklist = checklistPublicacion(caso);
  const listaParaPublicar = checklist.every((item) => item.ok);
  const sePuedeJugar = (caso.escenas || []).length > 0;

  return (
    <section className="ficha-caso">
      <CasoHero
        caso={caso}
        onAbrir={onVolver}
        onJugar={() => {
          if (editable) onEditar?.(caso);
          else if (sePuedeJugar) onJugar?.(caso);
          else onVolver?.();
        }}
      />

      <div className="ficha-body">
        <div className="ficha-cabecera">
          <div>
            <h2>{caso.titulo}</h2>
            <span className={pillEstado(caso.estado)}>{caso.estado}</span>
          </div>
          <div className="ficha-acciones">
            {sePuedeJugar ? (
              <button className="btn-play" type="button" onClick={() => onJugar?.(caso)}>
                <span className="play-tri" aria-hidden="true" />
                {editable ? 'Vista previa' : 'Entrar a la escena'}
              </button>
            ) : null}
            {editable ? (
              <button className="btn-play" type="button" onClick={() => onEditar?.(caso)}>
                <span className="play-tri" aria-hidden="true" />
                Continuar
              </button>
            ) : null}
            {editable ? (
              <button
                className="btn-play"
                type="button"
                disabled={trabajando || !listaParaPublicar}
                title={!listaParaPublicar ? 'Completa el checklist antes de publicar' : undefined}
                onClick={onPublicar}
              >
                <span className="play-tri" aria-hidden="true" />
                Publicar
              </button>
            ) : null}
            {caso.estado !== 'Archivado' ? (
              <button className="btn-ghost-dark" type="button" disabled={trabajando} onClick={onArchivar}>
                Archivar
              </button>
            ) : null}
            <button className="btn-ghost-dark" type="button" onClick={onVolver}>
              Volver a historias
            </button>
          </div>
        </div>

        <p>{caso.desarrolloSituacional}</p>
        <p className="muted-light">{caso.contextoHistoria}</p>
        <p className="muted-light">
          Tiempo estimado: {caso.tiempoEstimadoSegundos}s
        </p>

        {editable ? (
          <div className="checklist">
            <h3>¿Lista para publicar?</h3>
            <ul>
              {checklist.map((item) => (
                <li key={item.texto} className={item.ok ? 'ok' : 'pendiente'}>
                  <span>{item.ok ? '✓' : '○'}</span> {item.texto}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h3>Personajes</h3>
        <div className="ficha-pjs">
          {(caso.personajes || []).length === 0 ? (
            <p className="muted-light">Sin personajes.</p>
          ) : (
            caso.personajes.map((pj) => {
              const foto = imagenDePersonaje(pj.nombre);
              return (
                <article key={pj.id || pj.nombre} className="ficha-pj con-foto">
                  {foto ? (
                    <span
                      className="ficha-pj-foto"
                      style={{ backgroundImage: `url('${foto}')` }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div>
                    <strong>{pj.nombre}</strong>
                    <em>{pj.rolSocial || 'Sin rol'}</em>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <h3>Escenas</h3>
        {(caso.escenas || []).length === 0 ? (
          <p className="muted-light">Sin escenas.</p>
        ) : (
          <div className="arbol-escenas">
            {[...caso.escenas]
              .sort((a, b) => a.orden - b.orden)
              .map((escena) => (
                <article key={escena.id} className="nodo-escena">
                  {portadaEscena(caso.id, escena)?.imagen ? (
                    <div
                      className="escena-portada"
                      style={{
                        backgroundImage: `linear-gradient(90deg, transparent, rgba(8,6,16,0.75)), url('${portadaEscena(caso.id, escena).imagen}')`
                      }}
                    />
                  ) : null}
                  <header>
                    <strong>
                      {escena.orden}. {escena.nombre}
                      {escena.esFinal ? ' - final' : ''}
                    </strong>
                    <p className="muted-light">{escena.contexto}</p>
                    <p className="muted-light">
                      Personajes:{' '}
                      {(escena.personajes || []).map((p) => p.nombre).join(', ') || 'ninguno'}
                    </p>
                  </header>
                  {(escena.decisiones || []).map((decision) => (
                    <div key={decision.id} className="nodo-decision">
                      <strong>
                        P{decision.orden}: {decision.pregunta}
                      </strong>
                      <ul>
                        {(decision.opciones || []).map((op) => (
                          <li key={op.id}>
                            <span className={op.esCorrecta ? 'op-ok' : 'op-no'}>
                              {op.esCorrecta ? '✓' : ' - '} {op.texto}
                            </span>
                            {op.explicacion ? (
                              <small className="muted-light"> — {op.explicacion}</small>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
          </div>
        )}

        <h3>Evaluación</h3>
        {!caso.rubrica ? (
          <p className="muted-light">Sin evaluación todavía.</p>
        ) : (
          <div className="nodo-rubrica">
            <strong>{caso.rubrica.nombre}</strong>
            {(caso.rubrica.criterios || []).map((c) => (
              <div key={c.id || c.nombre} className="criterio-linea">
                <span>
                  {c.nombre} - {c.ponderacion}% - máx {c.puntajeMaximo}
                </span>
                <ul>
                  {(c.niveles || []).map((n) => (
                    <li key={n.id || `${n.nombre}-${n.orden}`}>
                      {n.orden}. {n.nombre} ({n.puntaje}): {n.descripcion}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
