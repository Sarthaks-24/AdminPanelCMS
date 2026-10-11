const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { isSafeHttpsUrl } = require('../lib/urlValidators');
const { boundedStringArray } = require('../lib/modelConstants');

const ExperienceSchema = new mongoose.Schema(
  {
    company: {
      type: String,
      required: [true, 'Company name is required'],
      maxlength: 120,
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Job title/role is required'],
      maxlength: 120,
      trim: true,
    },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'],
      default: 'Full-time',
    },
    period: {
      type: String,
      required: [true, 'Display period is required (e.g., June 2024 - Present)'],
      maxlength: 60,
      trim: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    location: { type: String, maxlength: 120, trim: true, default: '' },
    companyUrl: {
      type: String,
      trim: true,
      default: '',
      validate: { validator: isSafeHttpsUrl, message: 'URL must use https://' },
    },
    description: {
      type: String,
      required: [true, 'Role overview is required'],
      maxlength: 2000,
    },
    achievements: boundedStringArray(15, 300),
    technologies: boundedStringArray(30, 40),
    order: { type: Number, default: 0 },
    featured: { type: Boolean, default: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
    visibility: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  {
    timestamps: true,
  }
);

ExperienceSchema.index({ owner: 1, order: 1 });
ExperienceSchema.plugin(ownerGuardPlugin, { modelName: 'Experience' });

module.exports = mongoose.model('Experience', ExperienceSchema);
