import Medicine from '../models/Medicine.js';
import MedicineLog from '../models/MedicineLog.js';
import { checkDailyCompletion, ensureTodayLogsForUser, checkAndTriggerOverdueNotifications } from './careCircleController.js';

export const createMedicineLog = async (req, res) => {
  try {
    const { userId, medicineId, ...logData } = req.body;
    const medicine = await Medicine.findOne({
      _id: medicineId,
      userId: req.user._id,
      active: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    const medicineLog = await MedicineLog.create({
      ...logData,
      medicineId,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      medicineLog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getTodayMedicineLogs = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const medicineLogs = await MedicineLog.find({
      userId: req.user._id,
      scheduledDate: {
        $gte: todayStart,
        $lt: tomorrowStart,
      },
    }).sort({ scheduledTime: 1 });

    return res.status(200).json({
      success: true,
      count: medicineLogs.length,
      medicineLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const markMedicineTaken = async (req, res) => {
  try {
    const medicineLog = await MedicineLog.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!medicineLog) {
      return res.status(404).json({
        success: false,
        message: 'Medicine log not found',
      });
    }

    medicineLog.status = 'Taken';
    medicineLog.takenAt = new Date();
    await medicineLog.save();

    // Trigger daily completion check
    checkDailyCompletion(req.user._id, req.user.fullName).catch(console.error);

    return res.status(200).json({
      success: true,
      medicineLog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const markMedicineSkipped = async (req, res) => {
  try {
    const medicineLog = await MedicineLog.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!medicineLog) {
      return res.status(404).json({
        success: false,
        message: 'Medicine log not found',
      });
    }

    medicineLog.status = 'Skipped';
    await medicineLog.save();

    return res.status(200).json({
      success: true,
      medicineLog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getMedicineHistory = async (req, res) => {
  try {
    const medicineLogs = await MedicineLog.find({
      userId: req.user._id,
    }).sort({ scheduledDate: -1, scheduledTime: -1 });

    return res.status(200).json({
      success: true,
      count: medicineLogs.length,
      medicineLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
