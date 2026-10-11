const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every default is blank (contract §2.7): a new tenant must never publish the operator's name or
// placeholder copy. `configured` flips to true on the first dashboard save and gates /v1/profile.
const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, maxlength: 120, trim: true, default: '' },
    initials: { type: String, maxlength: 4, trim: true, default: '' },
    headline: { type: String, maxlength: 160, trim: true, default: '' },
    shortBio: { type: String, maxlength: 500, default: '' },
    aboutMarkdown: { type: String, maxlength: 20000, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      // Never default to the operator's address: new tenants would publish it unknowingly.
      default: '',
      validate: { validator: (value) => value === '' || EMAIL_PATTERN.test(value), message: 'Email address is invalid' },
    },
    phone: { type: String, maxlength: 40, trim: true, default: '' },
    location: {
      city: { type: String, maxlength: 80, trim: true, default: '' },
      country: { type: String, maxlength: 80, trim: true, default: '' },
      isRemoteAvailable: { type: Boolean, default: false },
    },
    statusText: { type: String, maxlength: 200, trim: true, default: '' },
    isAvailableForHire: { type: Boolean, default: false },
    // Terminal customization & system identity
    terminalUser: { type: String, maxlength: 32, trim: true, default: '' },
    terminalHost: { type: String, maxlength: 32, trim: true, default: '' },
    bootGreeting: { type: String, maxlength: 500, default: '' },
    // Key highlight badges (displayed in summary / overview)
    metrics: {
      type: [
        {
          label: { type: String, required: true, maxlength: 40, trim: true },
          value: { type: String, required: true, maxlength: 40, trim: true },
          description: { type: String, maxlength: 200, default: '' },
        },
      ],
      default: [],
      validate: { validator: (value) => Array.isArray(value) && value.length <= 8, message: 'At most 8 metrics' },
    },
    configured: { type: Boolean, default: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

ProfileSchema.index({ owner: 1 }, { unique: true });
ProfileSchema.plugin(ownerGuardPlugin, { modelName: 'Profile' });

module.exports = mongoose.model('Profile', ProfileSchema);
module.exports.EMAIL_PATTERN = EMAIL_PATTERN;
