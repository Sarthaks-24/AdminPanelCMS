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
    fileName: { type: String, maxlength: 120, trim: true, default: '' },
    version: { type: String, maxlength: 40, trim: true, default: '' },
    lastUpdated: { type: Date, default: Date.now },
    summaryText: { type: String, maxlength: 500, trim: true, default: '' },
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
