export default function EditorTabDialogos({
  personajes,
  dialogosForm,
  setDialogosForm,
  trabajando,
  onGuardar
}) {
  return (
    <div className="panel-editor">
      <p className="muted-light">
        Escribe lo que dice cada personaje al preguntarle en la simulación. Una línea por renglón.
        Si lo dejas vacío, Lumina arma un diálogo automático con el perfil.
      </p>
      {(personajes || []).length === 0 ? (
        <p className="muted-light">Agrega personajes primero.</p>
      ) : (
        <div className="dialogos-editor">
          {personajes.map((pj) => {
            const actual = dialogosForm[pj.nombre]?.['*'] || [];
            const texto = Array.isArray(actual) ? actual.join('\n') : '';
            return (
              <div key={pj.id || pj.nombre} className="field">
                <label htmlFor={`dlg-${pj.id || pj.nombre}`}>
                  {pj.nombre}
                  {pj.rolSocial ? ` - ${pj.rolSocial}` : ''}
                </label>
                <textarea
                  id={`dlg-${pj.id || pj.nombre}`}
                  rows={4}
                  value={texto}
                  placeholder={`${pj.nombre}: Hola, ¿qué quieres saber?\n${pj.nombre}: Te cuento lo que vi…`}
                  onChange={(e) => {
                    const lineas = e.target.value
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean);
                    setDialogosForm((prev) => ({
                      ...prev,
                      [pj.nombre]: { ...(prev[pj.nombre] || {}), '*': lineas }
                    }));
                  }}
                />
              </div>
            );
          })}
          <button type="button" className="btn-play" disabled={trabajando} onClick={onGuardar}>
            Guardar diálogos
          </button>
        </div>
      )}
    </div>
  );
}
