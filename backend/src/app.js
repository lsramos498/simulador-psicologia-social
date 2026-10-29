import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Lumina API',
    message: 'Backend de Lumina disponible.'
  });
});

app.use('/api/health', healthRoutes);

export default app;
