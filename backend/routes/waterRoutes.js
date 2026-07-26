import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  addWaterLog,
  deleteWaterLog,
  getTodayWaterLogs,
  getWaterHistory,
} from '../controllers/waterController.js';

const router = Router();

router.post('/', protect, addWaterLog);
router.get('/today', protect, getTodayWaterLogs);
router.get('/history', protect, getWaterHistory);
router.delete('/:id', protect, deleteWaterLog);

export default router;
