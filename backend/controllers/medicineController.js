import Medicine from '../models/Medicine.js';

export const addMedicine = async (req, res) => {
  try {
    const { userId, ...medicineData } = req.body;
    const medicine = await Medicine.create({
      ...medicineData,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find({
      userId: req.user._id,
      active: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: medicines.length,
      medicines,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user._id,
      active: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    return res.status(200).json({
      success: true,
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user._id,
      active: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    const allowedFields = [
      'medicineName',
      'dosage',
      'frequency',
      'reminderTimes',
      'instructions',
      'startDate',
      'endDate',
      'active',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        medicine[field] = req.body[field];
      }
    }

    await medicine.save();

    return res.status(200).json({
      success: true,
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user._id,
      active: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found',
      });
    }

    medicine.active = false;
    await medicine.save();

    return res.status(200).json({
      success: true,
      message: 'Medicine deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
