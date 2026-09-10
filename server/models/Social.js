const mongoose = require('mongoose');

const SocialSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: [true, 'Platform name is required'],
      trim: true, // e.g., 'GitHub', 'LinkedIn', 'X/Twitter', 'LeetCode', 'Discord', 'Email'
    },
    label: {
      type: String,
      required: true, // e.g., 'github.com/username'
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'Valid URL is required'],
      trim: true,
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
      index: true,
    },
    featured: {
      type: Boolean,
      default: true, // If true, highlighted in spotlight and top contact menu
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Social', SocialSchema);
