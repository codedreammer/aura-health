import mongoose from 'mongoose';

const careCircleContactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    relationship: {
      type: String,
      required: true,
      enum: ['Parent', 'Partner', 'Spouse', 'Family Member', 'Caregiver'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    sharingSettings: {
      missedMedicines: {
        type: Boolean,
        default: true,
      },
      dailyCompletion: {
        type: Boolean,
        default: false,
      },
      weeklySummary: {
        type: Boolean,
        default: false,
      },
      emergencyAlerts: {
        type: Boolean,
        default: false,
      },
    },
    optIn: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('CareCircleContact', careCircleContactSchema);
