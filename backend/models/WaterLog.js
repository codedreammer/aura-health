import mongoose from 'mongoose';

const waterLogSchema = new mongoose.Schema(
  {
    // User who recorded this water intake event.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Water volume consumed in milliliters.
    amount: {
      type: Number,
      required: true,
      min: 50,
      max: 2000,
    },
    // Timestamp when this water intake was logged.
    loggedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // Origin of the water intake entry.
    source: {
      type: String,
      enum: ['Manual', 'Reminder', 'Smart Bottle'],
      default: 'Manual',
    },
    // Optional note associated with this water intake.
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('WaterLog', waterLogSchema);
