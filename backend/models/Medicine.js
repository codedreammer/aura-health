import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    // User who owns this medicine record.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Name of the prescribed medicine.
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    // Prescribed medicine dosage.
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    // How often the medicine should be taken.
    frequency: {
      type: String,
      required: true,
      enum: ['Once Daily', 'Twice Daily', 'Three Times Daily', 'Weekly', 'As Needed'],
    },
    // Scheduled medicine reminder times.
    reminderTimes: {
      type: [String],
      required: true,
      default: [],
    },
    // Additional medicine-taking instructions.
    instructions: {
      type: String,
      trim: true,
      default: '',
    },
    // Date on which the medicine schedule begins.
    startDate: {
      type: Date,
      required: true,
    },
    // Optional date on which the medicine schedule ends.
    endDate: {
      type: Date,
    },
    // Whether this medicine schedule is currently active.
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('Medicine', medicineSchema);
