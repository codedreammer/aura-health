import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  getNotificationLogs,
  clearNotificationLogs,
  simulateReminderFlow,
} from '../controllers/careCircleController.js';

const router = Router();

router.get('/', protect, getContacts);
router.post('/', protect, createContact);
router.put('/:id', protect, updateContact);
router.delete('/:id', protect, deleteContact);

router.get('/notifications', protect, getNotificationLogs);
router.delete('/notifications', protect, clearNotificationLogs);
router.post('/simulate', protect, simulateReminderFlow);

export default router;
