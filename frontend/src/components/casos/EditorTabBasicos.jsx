import AsistenteIACasos from './AsistenteIACasos';

export default function EditorTabBasicos({
  token,
  basicos,
  setBasicos,
  trabajando,
  mostrarIa,
  setMostrarIa,
  onAplicarIa,
  onGuardar
}) {
  return (
    <div className="panel-editor editor-basicos-ia">
      <div className="crear-head-acciones editor-ia-bar">
        <p className="muted-light" style={{ margin: 0 }}>
          Editá los datos a mano o pedile un borrador a la IA.
        </p>
        <button
          type="button"
          className={mostrarIa ? 'btn-play btn-ia-toggle activo' : 'btn-play btn-ia-toggle'}
          onClick={() => setMostrarIa((v) => !v)}
        >
          {mostrarIa ? 'Ocultar IA' : 'Crear con IA'}
        </button>
      </div>

      {mostrarIa ? (
        <AsistenteIACasos
          token={token}
          compacto
          disabled={trabajando}
          promptInicial={
            [basicos.titulo, basicos.desarrolloSituacional].filter(Boolean).join('. ').slice(0, 500)
          }
          botonAplicar="Aplicar IA a esta historia"
          onAplicar={async (payload) => {
            await onAplicarIa(payload);
            setMostrarIa(false);
          }}
        />
      ) : null}

      <form onSubmit={onGuardar}>
        <div className="field">
          <label htmlFor="ed-titulo">Título</label>
          <input
            id="ed-titulo"
            value={basicos.titulo}
            maxLength={200}
            onChange={(e) => setBasicos({ ...basicos, titulo: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ed-des">Desarrollo situacional</label>
          <textarea
            id="ed-des"
            rows={4}
            value={basicos.desarrolloSituacional}
            onChange={(e) => setBasicos({ ...basicos, desarrolloSituacional: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ed-ctx">Contexto</label>
          <textarea
            id="ed-ctx"
            rows={3}
            value={basicos.contextoHistoria}
            onChange={(e) => setBasicos({ ...basicos, contextoHistoria: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ed-tmp">Tiempo estimado (segundos)</label>
          <input
            id="ed-tmp"
            type="number"
            min={1}
            value={basicos.tiempoEstimadoSegundos}
            onChange={(e) => setBasicos({ ...basicos, tiempoEstimadoSegundos: e.target.value })}
            required
          />
        </div>
        <button className="btn-play" type="submit" disabled={trabajando}>
          Guardar datos
        </button>
      </form>
    </div>
  );
}
