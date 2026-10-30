import { Router } from 'express';
import {
  consultarCasoPorId,
  consultarCasos
} from '../modules/casos/casos.service.js';

const router = Router();

router.get('/', (_req, res) => {
  const casos = consultarCasos();
  res.status(200).json({
    total: casos.length,
    data: casos
  });
});

router.get('/:id', (req, res) => {
  try {
    const caso = consultarCasoPorId(req.params.id);
    res.status(200).json({ data: caso });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message
    });
  }
});

export default router;
