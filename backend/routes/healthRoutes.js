import { Router } from 'express';
import { getHealthData, saveHealthData } from '../controllers/healthController.js';

const router = Router();

router.get('/:userId/:date', getHealthData);
router.post('/', saveHealthData);

export default router;
