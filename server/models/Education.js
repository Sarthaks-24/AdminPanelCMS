const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

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
    fieldOfStudy: {
      type: String,
      default: 'Computer Science & Engineering',
      trim: true,
    },
    period: {
      type: String,
      required: [true, 'Display period is required (e.g., 2022 - 2026)'],
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    grade: {
      type: String,
      default: '', // e.g., 'CGPA: 8.5 / 10'
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    achievements: {
      type: [String],
      default: [], // Relevant coursework, honors, societies
    },
    order: {
      type: Number,
      default: 0,
    },
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
