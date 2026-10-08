const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { isSafeHttpsUrl } = require('../lib/urlValidators');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      maxlength: 120,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Unique URL slug is required'],
      maxlength: 120,
      lowercase: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ['solo', 'team'],
      required: [true, 'Project mode must be solo or team'],
      default: 'solo',
    },
    role: {
      type: String,
      default: 'Lead Engineer',
      trim: true,
    },
    shortDescription: {
      type: String,
      required: [true, 'Short summary is required (max 260 chars)'],
      maxlength: 500,
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
      maxlength: 20000,
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
      validate: { validator: isSafeHttpsUrl, message: 'URL must use https://' },
    },
    links: {
      github: { type: String, default: '', trim: true, validate: { validator: isSafeHttpsUrl, message: 'URL must use https://' } },
      live: { type: String, default: '', trim: true, validate: { validator: isSafeHttpsUrl, message: 'URL must use https://' } },
      demo: { type: String, default: '', trim: true, validate: { validator: isSafeHttpsUrl, message: 'URL must use https://' } },
    },
    order: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
    visibility: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ owner: 1, slug: 1 }, { unique: true });
projectSchema.index({ owner: 1, order: 1 });
projectSchema.plugin(ownerGuardPlugin, { modelName: 'Project' });

module.exports = mongoose.model('Project', projectSchema);
