import { Router } from 'express';
import { SystemController } from '../controllers/system.controller';

const router = Router();

// Endpoint: /api/... (process, simulate)
router.post('/process', SystemController.process);
router.post('/simulate', SystemController.simulate);

export default router;
