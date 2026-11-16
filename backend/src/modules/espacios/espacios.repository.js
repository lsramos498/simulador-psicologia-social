export function crearRepositorioEspacios(pool) {
  if (!pool || typeof pool.execute !== 'function') {
    throw new TypeError('Se requiere un pool de MySQL');
  }

  return {
    async insertar({ nombre, codigo }) {
      const [resultado] = await pool.execute(
        `INSERT INTO EspacioAcademico (nombre, codigo, activo)
         VALUES (?, ?, TRUE)`,
        [nombre, codigo]
      );
      return resultado.insertId;
    },

    async listar() {
      const [filas] = await pool.execute(
        `SELECT id, nombre, codigo, activo
         FROM EspacioAcademico
         ORDER BY nombre, id`
      );
      return filas;
    }
  };
}
