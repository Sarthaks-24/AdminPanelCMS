const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { boundedStringArray } = require('../lib/modelConstants');

const EducationSchema = new mongoose.Schema(
  {
    institution: {
      type: String,
      required: [true, 'University / Institution name is required'],
      maxlength: 120,
      trim: true,
    },
    degree: {
      type: String,
      required: [true, 'Degree is required (e.g., B.Tech in CSE)'],
      maxlength: 120,
      trim: true,
    },
    fieldOfStudy: { type: String, maxlength: 120, trim: true, default: '' },
    period: {
      type: String,
      required: [true, 'Display period is required (e.g., 2022 - 2026)'],
      maxlength: 60,
      trim: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    grade: { type: String, maxlength: 40, trim: true, default: '' }, // e.g., 'CGPA: 8.5 / 10'
    location: { type: String, maxlength: 120, trim: true, default: '' },
    achievements: boundedStringArray(15, 300), // Relevant coursework, honors, societies
    order: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
    visibility: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  {
    timestamps: true,
  }
);

EducationSchema.index({ owner: 1, order: 1 });
EducationSchema.plugin(ownerGuardPlugin, { modelName: 'Education' });

module.exports = mongoose.model('Education', EducationSchema);
