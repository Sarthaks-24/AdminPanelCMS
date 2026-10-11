const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { MAX_FIELDS_PER_SECTION } = require('../lib/modelConstants');
const LIMITS = require('../config/limits');

// Schema-level caps are the last line of defence (contract §4); validateApp in appsController
// applies the exact per-model `fields` cap, ownership of `ids` and the owner's category list.
const unique = (value) => new Set(value.map(String)).size === value.length;
const fieldsSpec = {
  type: [{ type: String, trim: true }],
  default: [],
  validate: {
    validator: (value) => value.length <= MAX_FIELDS_PER_SECTION && unique(value),
    message: `fields must be unique and contain at most ${MAX_FIELDS_PER_SECTION} entries`,
  },
};
const idsSpec = {
  type: [{ type: mongoose.Schema.Types.ObjectId }],
  default: [],
  validate: {
    validator: (value) => value.length <= LIMITS.itemsPerCollection && unique(value),
    message: `ids must be unique and contain at most ${LIMITS.itemsPerCollection} entries`,
  },
};
const categoriesSpec = {
  type: [{ type: String, trim: true, maxlength: 60 }],
  default: [],
  validate: {
    validator: (value) => value.length <= 50 && unique(value) && value.every((entry) => entry.length <= 60),
    message: 'categories must be unique and contain at most 50 entries of at most 60 characters',
  },
};

const SectionSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['all', 'featured', 'selected'], default: 'all' },
  ids: idsSpec,
  fields: fieldsSpec,
}, { _id: false });

const SkillsSectionSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['all', 'featured', 'selected'], default: 'all' },
  ids: idsSpec,
  fields: fieldsSpec,
  categories: categoriesSpec,
}, { _id: false });

const SimpleSectionSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  fields: fieldsSpec,
}, { _id: false });

const IncludeSchema = new mongoose.Schema({
  profile: { type: SimpleSectionSchema, default: () => ({}) },
  resume: { type: SimpleSectionSchema, default: () => ({}) },
  socials: { type: SectionSchema, default: () => ({}) },
  skills: { type: SkillsSectionSchema, default: () => ({}) },
  projects: { type: SectionSchema, default: () => ({}) },
  experience: { type: SectionSchema, default: () => ({}) },
  education: { type: SectionSchema, default: () => ({}) },
  certifications: { type: SectionSchema, default: () => ({}) },
  fs: { enabled: { type: Boolean, default: false } },
}, { _id: false });

const AppSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  quotaSlot: { type: Number, required: true, min: 0, max: 9, select: false },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  type: { type: String, enum: ['static', 'protected'], required: true },
  allowedOrigins: {
    type: [{ type: String, trim: true }],
    default: [],
    validate: [(origins) => origins.length <= 10, 'Max 10 origins'],
  },
  include: { type: IncludeSchema, default: () => ({}) },
}, { timestamps: true });

AppSchema.index({ owner: 1, createdAt: -1 });
AppSchema.index({ owner: 1, quotaSlot: 1 }, { unique: true });
AppSchema.plugin(ownerGuardPlugin, { modelName: 'App' });

module.exports = mongoose.model('App', AppSchema);
