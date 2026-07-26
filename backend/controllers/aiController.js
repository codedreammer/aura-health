import Medicine from '../models/Medicine.js';
import MedicineLog from '../models/MedicineLog.js';
import WaterLog from '../models/WaterLog.js';
import { generateCoachReply } from '../services/geminiService.js';

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const formatMedicines = (medicines, medicineLogs) => medicines.map((medicine) => {
  const log = medicineLogs.find((medicineLog) => String(medicineLog.medicineId) === String(medicine._id));
  const reminder = medicine.reminderTimes?.join(', ') || 'No reminder time';
  return `- ${medicine.medicineName}\n  ${reminder}\n  ${log?.status || 'Pending'}`;
}).join('\n');

const formatMedicineLogs = (medicineLogs) => medicineLogs.map((medicineLog) => (
  `- ${medicineLog.scheduledTime}: ${medicineLog.status}`
)).join('\n');

export const chatWithCoach = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A message is required.',
      });
    }

    const { start, end } = getTodayRange();
    const [medicines, medicineLogs, waterLogs] = await Promise.all([
      Medicine.find({ userId: req.user._id, active: true }),
      MedicineLog.find({
        userId: req.user._id,
        scheduledDate: { $gte: start, $lt: end },
      }).sort({ scheduledTime: 1 }),
      WaterLog.find({
        userId: req.user._id,
        loggedAt: { $gte: start, $lt: end },
      }),
    ]);

    const waterAmount = waterLogs.reduce((total, waterLog) => total + waterLog.amount, 0);
    const waterGlasses = Math.round(waterAmount / 250);
    const pendingMedicines = medicines.filter((medicine) => {
      const log = medicineLogs.find((medicineLog) => String(medicineLog.medicineId) === String(medicine._id));
      return !log || log.status !== 'Taken';
    });
    const takenLogs = medicineLogs.filter((medicineLog) => medicineLog.status === 'Taken').length;
    const adherence = medicineLogs.length ? Math.round((takenLogs / medicineLogs.length) * 100) : 0;
    const medicineSummary = `${pendingMedicines.length} medicine${pendingMedicines.length === 1 ? '' : 's'} pending; ${takenLogs} of ${medicineLogs.length} scheduled doses marked taken.`;
    const healthSummary = `Medicine adherence today: ${adherence}%. Hydration progress: ${waterGlasses} of 8 glasses.`;

    const reply = await generateCoachReply({
      userName: req.user.fullName,
      waterAmount,
      waterGlasses,
      medicines: formatMedicines(medicines, medicineLogs),
      pendingMedicines: formatMedicines(pendingMedicines, medicineLogs),
      medicineLogs: formatMedicineLogs(medicineLogs),
      medicineSummary,
      healthSummary,
      message: message.trim(),
    });

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    const status = error.code === 'AI_TIMEOUT' ? 504 : error.status || 500;
    const messages = {
      401: 'Gemini AI authentication failed. Please contact support.',
      403: 'Gemini AI access is not available right now.',
      429: 'Aura is receiving a lot of requests. Please try again shortly.',
      500: 'Aura could not respond right now. Please try again shortly.',
      504: 'Aura took too long to respond. Please try again.',
    };

    console.error('Gemini chat error:', error);
    return res.status(status).json({
      success: false,
      message: messages[status] || 'Aura could not respond right now. Please try again shortly.',
    });
  }
};
