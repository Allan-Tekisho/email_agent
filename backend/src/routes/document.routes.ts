import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/document.controller';

const upload = multer();
const router = Router();

// Endpoint: /api/documents
router.post('/', upload.single('file'), DocumentController.upload);

export default router;
