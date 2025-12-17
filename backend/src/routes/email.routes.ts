import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';

const router = Router();

// Endpoint: /api/emails
router.get('/', EmailController.getPending);
router.post('/:id/approve', EmailController.approve);
router.post('/:id/reject', EmailController.reject);

export default router;
