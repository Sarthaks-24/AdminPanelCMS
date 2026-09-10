const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Unique URL slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ['solo', 'team'],
      required: [true, 'Project mode must be solo or team'],
      default: 'solo',
      index: true,
    },
    role: {
      type: String,
      default: 'Lead Engineer',
      trim: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short summary is required (max 260 chars)'],
      maxlength: 260,
    },
    keyMetric: {
      type: String,
      default: '', // e.g., 'Latency: <15ms', '50k MAU', '99.9% Uptime'
      trim: true,
    },
    highlights: {
      type: [String],
      default: [], // Key technical takeaways
    },
    caseStudyBody: {
      type: String,
      required: [true, 'Full Markdown case study body is required'],
    },
    stack: {
      type: [String],
      default: [], // e.g., ['React', 'Node.js', 'Redis', 'WebSockets']
    },
    teammates: {
      type: [String],
      default: [],
    },
    thumbnail: {
      type: String,
      default: '', // Image URL for previews
      trim: true,
    },
    links: {
      github: { type: String, default: '', trim: true },
      live: { type: String, default: '', trim: true },
      demo: { type: String, default: '', trim: true },
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    featured: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);
