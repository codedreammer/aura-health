import mongoose from 'mongoose';

const healthReportSchema = new mongoose.Schema(
  {
    // User for whom this health report was generated.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Reporting interval represented by this report.
    reportType: {
      type: String,
      required: true,
      enum: ['Daily', 'Weekly', 'Monthly'],
      index: true,
    },
    // Beginning of the reporting period.
    periodStart: {
      type: Date,
      required: true,
      index: true,
    },
    // End of the reporting period.
    periodEnd: {
      type: Date,
      required: true,
    },
    // Percentage score for medicine adherence during the period.
    medicineAdherence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // Percentage score for hydration during the period.
    hydrationScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // Percentage score summarizing the user's overall health.
    overallHealthScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // AI-generated narrative summary of the reporting period.
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    // AI-generated actionable recommendations.
    recommendations: {
      type: [String],
      default: [],
    },
    // Name of the system that generated the report.
    generatedBy: {
      type: String,
      default: 'Gemini',
    },
    // Timestamp when this report was generated.
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('HealthReport', healthReportSchema);
