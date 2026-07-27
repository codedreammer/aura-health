import WaterLog from '../models/WaterLog.js';
import { checkDailyCompletion } from './careCircleController.js';

export const addWaterLog = async (req, res) => {
  try {
    const { userId, ...waterLogData } = req.body;
    const waterLog = await WaterLog.create({
      ...waterLogData,
      userId: req.user._id,
    });

    // Trigger daily completion check
    checkDailyCompletion(req.user._id, req.user.fullName).catch(console.error);

    return res.status(201).json({
      success: true,
      message: 'Water intake logged successfully',
      waterLog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getTodayWaterLogs = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const waterLogs = await WaterLog.find({
      userId: req.user._id,
      loggedAt: {
        $gte: todayStart,
        $lt: tomorrowStart,
      },
    }).sort({ loggedAt: 1 });

    const totalWater = waterLogs.reduce((total, waterLog) => total + waterLog.amount, 0);

    return res.status(200).json({
      success: true,
      totalWater,
      count: waterLogs.length,
      waterLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getWaterHistory = async (req, res) => {
  try {
    const waterLogs = await WaterLog.find({
      userId: req.user._id,
    }).sort({ loggedAt: -1 });

    return res.status(200).json({
      success: true,
      count: waterLogs.length,
      waterLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteWaterLog = async (req, res) => {
  try {
    const waterLog = await WaterLog.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!waterLog) {
      return res.status(404).json({
        success: false,
        message: 'Water log not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Water log deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
