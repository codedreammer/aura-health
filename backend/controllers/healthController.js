import UserHealth from '../models/UserHealth.js';

export const getHealthData = async (req, res) => {
  try {
    let data = await UserHealth.findOne({ userId: req.params.userId, date: req.params.date });
    if (!data) {
      data = {
        water: 0,
        meals: 0,
        streak: 0,
        meds: [
          { id: 'm1', name: 'Vitamin D', time: '8:00 PM', taken: false },
          { id: 'm2', name: 'Metformin', time: '8:00 AM', taken: false }
        ]
      };
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const saveHealthData = async (req, res) => {
  try {
    const { userId, date, water, meals, meds, streak } = req.body;
    const updatedData = await UserHealth.findOneAndUpdate(
      { userId, date },
      { water, meals, meds, streak },
      { new: true, upsert: true }
    );
    res.json(updatedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
