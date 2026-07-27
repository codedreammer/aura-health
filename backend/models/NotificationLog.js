import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CareCircleContact',
      default: null,
    },
    medicineLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicineLog',
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: ['Reminder 1', 'Reminder 2', 'Care Circle Escalation', 'Daily Completion', 'Weekly Summary', 'Emergency Alert'],
    },
    recipientName: {
      type: String,
      required: true,
    },
    recipientType: {
      type: String,
      required: true,
      enum: ['User', 'Care Circle Contact'],
    },
    channel: {
      type: String,
      required: true,
      enum: ['SMS', 'Email'],
    },
    destination: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['Simulated', 'Sent', 'Failed'],
      default: 'Simulated',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('NotificationLog', notificationLogSchema);
