import mongoose from 'mongoose';

const medicineLogSchema = new mongoose.Schema(
  {
    // User associated with this scheduled medicine intake.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Scheduled medicine associated with this intake record.
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    // Daily scheduled time in 24-hour HH:MM format.
    scheduledTime: {
      type: String,
      required: true,
      match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'scheduledTime must use HH:MM format'],
    },
    // Calendar date for the scheduled medicine intake.
    scheduledDate: {
      type: Date,
      required: true,
    },
    // Timestamp when the user recorded the medicine as taken.
    takenAt: {
      type: Date,
    },
    // Current intake state for the scheduled dose.
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Taken', 'Missed', 'Skipped'],
      default: 'Pending',
    },
    // Optional note associated with this medicine intake.
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

medicineLogSchema.index(
  { userId: 1, medicineId: 1, scheduledDate: 1, scheduledTime: 1 },
  { unique: true },
);

export default mongoose.model('MedicineLog', medicineLogSchema);
