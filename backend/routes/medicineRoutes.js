import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  addMedicine,
  deleteMedicine,
  getMedicineById,
  getMedicines,
  updateMedicine,
} from '../controllers/medicineController.js';

const router = Router();

router.post('/', protect, addMedicine);
router.get('/', protect, getMedicines);
router.get('/:id', protect, getMedicineById);
router.put('/:id', protect, updateMedicine);
router.delete('/:id', protect, deleteMedicine);

export default router;
