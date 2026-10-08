const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

const SectionSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['all', 'featured', 'selected'], default: 'all' },
  ids: [{ type: mongoose.Schema.Types.ObjectId }],
  fields: [{ type: String, trim: true }],
}, { _id: false });

const SkillsSectionSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['all', 'featured', 'selected'], default: 'all' },
  ids: [{ type: mongoose.Schema.Types.ObjectId }],
  fields: [{ type: String, trim: true }],
  categories: [{ type: String, trim: true }],
}, { _id: false });

const SimpleSectionSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  fields: [{ type: String, trim: true }],
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
AppSchema.plugin(ownerGuardPlugin, { modelName: 'App' });

module.exports = mongoose.model('App', AppSchema);
