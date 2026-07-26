import { Router } from 'express';
import { chatWithCoach } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/chat', protect, chatWithCoach);

export default router;
