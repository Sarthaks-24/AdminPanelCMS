const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

const ProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      maxlength: 120,
      trim: true,
      default: () => process.env.ADMIN_NAME || 'Portfolio Administrator',
    },
    initials: {
      type: String,
      trim: true,
      default: 'PA',
    },
    headline: {
      type: String,
      required: [true, 'Professional headline is required'],
      maxlength: 120,
      trim: true,
      default: 'Full Stack Engineer · Systems & Architecture',
    },
    shortBio: {
      type: String,
      required: [true, 'Short bio is required'],
      maxlength: 500,
      default: 'Building low-latency distributed web systems and high-throughput cloud architectures.',
    },
    aboutMarkdown: {
      type: String,
      maxlength: 20000,
      default: '# Professional Overview\n\nFull-stack software engineer with expertise in distributed microservices, real-time WebSockets, and modern cloud infrastructure.',
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
      default: () => process.env.ADMIN_EMAIL || 'admin@example.com',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      city: { type: String, default: 'San Francisco' },
      country: { type: String, default: 'United States' },
      isRemoteAvailable: { type: Boolean, default: true },
    },
    statusText: {
      type: String,
      default: 'Open for high-impact software engineering roles',
    },
    isAvailableForHire: {
      type: Boolean,
      default: true,
    },
    // Terminal Customization & System Identity
    terminalUser: {
      type: String,
      default: 'admin',
      trim: true,
    },
    terminalHost: {
      type: String,
      default: 'portfolio',
      trim: true,
    },
    bootGreeting: {
      type: String,
      default: 'PORTFOLIO_SYSTEM v2026.09 - POST INITIATED',
    },
    // Key Highlight Badges (displayed in summary / overview)
    metrics: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

ProfileSchema.index({ owner: 1 }, { unique: true });
ProfileSchema.plugin(ownerGuardPlugin, { modelName: 'Profile' });

module.exports = mongoose.model('Profile', ProfileSchema);
