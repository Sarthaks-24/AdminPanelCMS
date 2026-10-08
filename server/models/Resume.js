const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { isSafeHttpsUrl } = require('../lib/urlValidators');

const ResumeSchema = new mongoose.Schema(
  {
    resumeUrl: {
      type: String,
      required: [true, 'Direct PDF or Google Drive shareable link is required'],
      trim: true,
      validate: { validator: isSafeHttpsUrl, message: 'URL must use https://' },
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
      maxlength: 500,
      default: 'Full Stack Engineer with expertise in modern web systems, distributed architectures, and cloud services.',
      trim: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
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

ResumeSchema.index({ owner: 1 }, { unique: true });
ResumeSchema.plugin(ownerGuardPlugin, { modelName: 'Resume' });

module.exports = mongoose.model('Resume', ResumeSchema);
