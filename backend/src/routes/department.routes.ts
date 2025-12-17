import { Router } from 'express';
import { DepartmentController } from '../controllers/department.controller';

const router = Router();

router.get('/', DepartmentController.getAll);
router.put('/:id', DepartmentController.updateHead);

export default router;
