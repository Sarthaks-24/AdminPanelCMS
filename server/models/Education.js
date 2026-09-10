const mongoose = require('mongoose');

const EducationSchema = new mongoose.Schema(
  {
    institution: {
      type: String,
      required: [true, 'University / Institution name is required'],
      trim: true,
    },
    degree: {
      type: String,
      required: [true, 'Degree is required (e.g., B.Tech in CSE)'],
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
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Education', EducationSchema);
