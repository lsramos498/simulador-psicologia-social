import {
  descargarPlantillaRubrica,
  descargarPlantillaRubricaCsv,
  descargarRubricaJson,
  leerArchivoRubrica
} from '../../utils/rubricaArchivo';

export default function EditorTabRubrica({
  caso,
  rubrica,
  setRubrica,
  trabajando,
  onGuardar,
  onMensaje,
  onError
}) {
  const suma = rubrica.criterios.reduce((n, c) => n + Number(c.ponderacion || 0), 0);
  const okSuma = Math.abs(suma - 100) < 0.05;

  return (
    <form className="panel-editor" onSubmit={onGuardar}>
      <div className="rubrica-archivos">
        <div>
          <p className="kicker">Archivo de rúbrica</p>
          <p className="muted-light">
            Sube un JSON o CSV, o descarga la plantilla y edítala en Excel/Word y vuelve a subirla.
          </p>
        </div>
        <div className="ficha-acciones">
          <label className="btn-ghost-dark btn-file">
            Subir rúbrica
            <input
              type="file"
              accept=".json,.csv,.txt,application/json,text/csv"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const importada = await leerArchivoRubrica(file);
                  setRubrica(importada);
                  onMensaje(`Rúbrica «${importada.nombre}» cargada. Revisa y guarda.`);
                  onError('');
                } catch (err) {
                  onError(err.message || 'No se pudo leer el archivo.');
                }
              }}
            />
          </label>
          <button type="button" className="btn-ghost-dark" onClick={() => descargarPlantillaRubrica()}>
            Plantilla JSON
          </button>
          <button type="button" className="btn-ghost-dark" onClick={() => descargarPlantillaRubricaCsv()}>
            Plantilla CSV
          </button>
          <button
            type="button"
            className="btn-ghost-dark"
            onClick={() =>
              descargarRubricaJson(
                rubrica,
                `rubrica-${(caso.titulo || 'caso').slice(0, 40).replace(/\s+/g, '-')}.json`
              )
            }
          >
            Exportar actual
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="rub-nom">Nombre</label>
        <input
          id="rub-nom"
          value={rubrica.nombre}
          maxLength={150}
          onChange={(e) => setRubrica({ ...rubrica, nombre: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="rub-des">Descripción</label>
        <textarea
          id="rub-des"
          rows={2}
          value={rubrica.descripcion}
          onChange={(e) => setRubrica({ ...rubrica, descripcion: e.target.value })}
        />
      </div>

      {rubrica.criterios.map((criterio, ci) => (
        <div key={`c-${ci}`} className="nodo-escena">
          <div className="criterio-head">
            <h3>Criterio {ci + 1}</h3>
            {rubrica.criterios.length > 1 ? (
              <button
                type="button"
                className="btn-ghost-dark"
                onClick={() =>
                  setRubrica({
                    ...rubrica,
                    criterios: rubrica.criterios.filter((_, idx) => idx !== ci)
                  })
                }
              >
                Quitar
              </button>
            ) : null}
          </div>
          <div className="crear-grid">
            <div className="field">
              <label>Nombre</label>
              <input
                value={criterio.nombre}
                onChange={(e) => {
                  const criterios = [...rubrica.criterios];
                  criterios[ci] = { ...criterio, nombre: e.target.value };
                  setRubrica({ ...rubrica, criterios });
                }}
                required
              />
            </div>
            <div className="field">
              <label>Ponderación (%)</label>
              <input
                type="number"
                min={0.01}
                max={100}
                step={0.01}
                value={criterio.ponderacion}
                onChange={(e) => {
                  const criterios = [...rubrica.criterios];
                  criterios[ci] = { ...criterio, ponderacion: e.target.value };
                  setRubrica({ ...rubrica, criterios });
                }}
                required
              />
            </div>
            <div className="field">
              <label>Puntaje máximo</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={criterio.puntajeMaximo}
                onChange={(e) => {
                  const criterios = [...rubrica.criterios];
                  criterios[ci] = { ...criterio, puntajeMaximo: e.target.value };
                  setRubrica({ ...rubrica, criterios });
                }}
                required
              />
            </div>
          </div>
          {criterio.niveles.map((nivel, ni) => (
            <div key={`n-${ci}-${ni}`} className="crear-grid">
              <div className="field">
                <label>Nivel</label>
                <input
                  value={nivel.nombre}
                  onChange={(e) => {
                    const criterios = [...rubrica.criterios];
                    const niveles = [...criterio.niveles];
                    niveles[ni] = { ...nivel, nombre: e.target.value };
                    criterios[ci] = { ...criterio, niveles };
                    setRubrica({ ...rubrica, criterios });
                  }}
                  required
                />
              </div>
              <div className="field">
                <label>Puntaje</label>
                <input
                  type="number"
                  step={0.01}
                  value={nivel.puntaje}
                  onChange={(e) => {
                    const criterios = [...rubrica.criterios];
                    const niveles = [...criterio.niveles];
                    niveles[ni] = { ...nivel, puntaje: e.target.value };
                    criterios[ci] = { ...criterio, niveles };
                    setRubrica({ ...rubrica, criterios });
                  }}
                  required
                />
              </div>
              <div className="field">
                <label>Descripción</label>
                <input
                  value={nivel.descripcion}
                  onChange={(e) => {
                    const criterios = [...rubrica.criterios];
                    const niveles = [...criterio.niveles];
                    niveles[ni] = { ...nivel, descripcion: e.target.value };
                    criterios[ci] = { ...criterio, niveles };
                    setRubrica({ ...rubrica, criterios });
                  }}
                  required
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost-dark"
            onClick={() => {
              const criterios = [...rubrica.criterios];
              const niveles = [
                ...criterio.niveles,
                {
                  nombre: `Nivel ${criterio.niveles.length + 1}`,
                  descripcion: '',
                  puntaje: 1,
                  orden: criterio.niveles.length + 1
                }
              ];
              criterios[ci] = { ...criterio, niveles };
              setRubrica({ ...rubrica, criterios });
            }}
          >
            Agregar nivel
          </button>
        </div>
      ))}

      <div className="ficha-acciones">
        <button
          type="button"
          className="btn-ghost-dark"
          onClick={() =>
            setRubrica({
              ...rubrica,
              criterios: [
                ...rubrica.criterios,
                {
                  nombre: `Criterio ${rubrica.criterios.length + 1}`,
                  ponderacion: 0,
                  puntajeMaximo: 4,
                  niveles: [
                    { nombre: 'Básico', descripcion: '', puntaje: 1, orden: 1 },
                    { nombre: 'Alto', descripcion: '', puntaje: 4, orden: 2 }
                  ]
                }
              ]
            })
          }
        >
          Agregar criterio
        </button>
        <button className="btn-play" type="submit" disabled={trabajando}>
          Guardar evaluación
        </button>
      </div>
      <p className={okSuma ? 'muted-light' : 'alert'}>
        Suma de ponderaciones: {suma.toFixed(2)}% {okSuma ? '✓' : '(debe ser 100)'}
      </p>
    </form>
  );
}
