import BancoPersonajes from '../BancoPersonajes';
import { imagenDePersonaje } from '../../data/bancoPersonajes';

export default function EditorTabPersonajes({
  idsEnCaso,
  personajes,
  trabajando,
  onAgregarDelBanco,
  onAgregarPersonalizado
}) {
  return (
    <div className="panel-editor">
      <BancoPersonajes
        modo="elegir"
        titulo="Agregar desde el banco"
        seleccionados={idsEnCaso}
        onToggle={onAgregarDelBanco}
      />

      <h3>En esta historia</h3>
      <div className="ficha-pjs">
        {(personajes || []).length === 0 ? (
          <p className="muted-light">Todavía no hay personajes.</p>
        ) : (
          personajes.map((pj) => {
            const foto = imagenDePersonaje(pj.nombre);
            return (
              <article key={pj.id} className="ficha-pj con-foto">
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

      <form className="form-inline" onSubmit={onAgregarPersonalizado}>
        <h3>Personaje a medida</h3>
        <div className="crear-grid">
          <div className="field">
            <label htmlFor="pj-nom">Nombre</label>
            <input id="pj-nom" name="nombre" required maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="pj-rol">Rol social</label>
            <input id="pj-rol" name="rolSocial" maxLength={100} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pj-per">Perfil</label>
          <input id="pj-per" name="perfil" />
        </div>
        <div className="field">
          <label htmlFor="pj-pau">Pautas</label>
          <input id="pj-pau" name="pautas" />
        </div>
        <button className="btn-play" type="submit" disabled={trabajando}>
          Agregar personaje
        </button>
      </form>
    </div>
  );
}
