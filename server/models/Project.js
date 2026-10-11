const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { isSafeHttpsUrl } = require('../lib/urlValidators');
const { boundedStringArray, SLUG_PATTERN, SLUG_MAX_LENGTH } = require('../lib/modelConstants');

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
      maxlength: SLUG_MAX_LENGTH,
      lowercase: true,
      trim: true,
      match: [SLUG_PATTERN, 'Slug may only contain lowercase letters, digits and single hyphens'],
    },
    mode: {
      type: String,
      enum: ['solo', 'team'],
      required: [true, 'Project mode must be solo or team'],
      default: 'solo',
    },
    role: { type: String, maxlength: 80, trim: true, default: '' },
    shortDescription: {
      type: String,
      required: [true, 'Short summary is required (max 500 chars)'],
      maxlength: 500,
    },
    keyMetric: { type: String, maxlength: 120, trim: true, default: '' }, // e.g., 'Latency: <15ms', '50k MAU'
    highlights: boundedStringArray(15, 200), // Key technical takeaways
    caseStudyBody: { type: String, maxlength: 20000, default: '' },
    stack: boundedStringArray(30, 40), // e.g., ['React', 'Node.js', 'Redis']
    teammates: boundedStringArray(20, 80),
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
    order: { type: Number, default: 0 },
    featured: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now },
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
