const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema(
  {
    resumeUrl: {
      type: String,
      required: [true, 'Direct PDF or Google Drive shareable link is required'],
      trim: true,
    },
    fileName: {
      type: String,
      default: 'Resume_Master.pdf',
      trim: true,
    },
    version: {
      type: String,
      default: 'v2026.09',
      trim: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    summaryText: {
      type: String,
      default: 'Full Stack Engineer with expertise in modern web systems, distributed architectures, and cloud services.',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for client backward compatibility
ResumeSchema.virtual('driveUrl').get(function () {
  return this.resumeUrl;
});

module.exports = mongoose.model('Resume', ResumeSchema);
