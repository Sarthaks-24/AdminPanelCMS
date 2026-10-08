const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');
const { isSafeSocialUrl } = require('../lib/urlValidators');

const SocialSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: [true, 'Platform name is required'],
      maxlength: 120,
      trim: true, // e.g., 'GitHub', 'LinkedIn', 'X/Twitter', 'LeetCode', 'Discord', 'Email'
    },
    label: {
      type: String,
      required: true, // e.g., 'github.com/username'
      maxlength: 500,
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'Valid URL is required'],
      trim: true,
      validate: { validator: isSafeSocialUrl, message: 'URL must use https:// or a valid mailto: address' },
    },
    username: {
      type: String,
      trim: true, // e.g., 'username'
    },
    icon: {
      type: String,
      default: 'link', // 'github', 'linkedin', 'twitter', 'mail', 'code', 'globe'
    },
    order: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: true, // If true, highlighted in spotlight and top contact menu
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
    visibility: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  {
    timestamps: true,
  }
);

SocialSchema.index({ owner: 1, order: 1 });
SocialSchema.plugin(ownerGuardPlugin, { modelName: 'Social' });

module.exports = mongoose.model('Social', SocialSchema);
