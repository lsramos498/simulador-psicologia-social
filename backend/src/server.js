import 'dotenv/config';
import app from './app.js';
import {
  ejecutarCierreAutomaticoActividades
} from './routes/actividades.routes.js';

const PORT = process.env.PORT || 3000;
const INTERVALO_CIERRE_AUTOMATICO = 60 * 1000;

app.listen(PORT, () => {
  console.log(`Lumina API escuchando en http://localhost:${PORT}`);

  const ejecutarCierre = async () => {
    try {
      const cantidad = await ejecutarCierreAutomaticoActividades();

      if (cantidad > 0) {
        console.log(
          `Cierre automático: ${cantidad} actividad(es) cerrada(s).`
        );
      }
    } catch (error) {
      console.error(
        'Error al ejecutar el cierre automático de actividades:',
        error
      );
    }
  };

  void ejecutarCierre();

  setInterval(
    ejecutarCierre,
    INTERVALO_CIERRE_AUTOMATICO
  );
});