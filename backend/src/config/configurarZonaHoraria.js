/**
 * Alinea la zona horaria SQL de cada conexión nueva con DB_TIMEZONE.
 * La opción `timezone` de mysql2 controla la conversión de Date en el driver;
 * este SET SESSION también controla funciones SQL como NOW() y CURTIME().
 */
export function configurarZonaHorariaMySql(pool, zonaHoraria) {
  if (!pool || typeof pool.on !== 'function') {
    throw new TypeError('Se requiere un pool MySQL válido.');
  }
  if (typeof zonaHoraria !== 'string' || !zonaHoraria.trim()) {
    throw new TypeError('Se requiere una zona horaria SQL válida.');
  }

  pool.on('connection', (conexion) => {
    if (!conexion || typeof conexion.query !== 'function') {
      throw new TypeError('La conexión MySQL no permite ejecutar consultas.');
    }

    conexion.query('SET SESSION time_zone = ?', [zonaHoraria], (error) => {
      if (!error) return;

      // Una conexión cuya zona no pudo configurarse no debe volver al pool.
      console.error(
        'No se pudo configurar la zona horaria de la sesión MySQL:',
        error.message
      );
      if (typeof conexion.destroy === 'function') conexion.destroy();
    });
  });

  return pool;
}
