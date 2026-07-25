import mongoose from 'mongoose';

const healthSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // e.g., 'Alex' for your prototype
  date: { type: String, required: true },
  water: { type: Number, default: 0 },
  meals: { type: Number, default: 0 },
  meds: [
    {
      id: String,
      name: String,
      time: String,
      taken: Boolean
    }
  ],
  streak: { type: Number, default: 0 }
});

export default mongoose.model('UserHealth', healthSchema);