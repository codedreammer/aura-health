import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createMedicineLog,
  getMedicineHistory,
  getTodayMedicineLogs,
  markMedicineSkipped,
  markMedicineTaken,
} from '../controllers/medicineLogController.js';

const router = Router();

router.post('/', protect, createMedicineLog);
router.get('/today', protect, getTodayMedicineLogs);
router.get('/history', protect, getMedicineHistory);
router.patch('/:id/taken', protect, markMedicineTaken);
router.patch('/:id/skipped', protect, markMedicineSkipped);

export default router;
