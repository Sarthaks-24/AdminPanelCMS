const mongoose = require('mongoose');

// Platform-wide settings editable by a superadmin (not tenant content, so no owner field).
const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: false, updatedAt: true } });

module.exports = mongoose.model('Setting', SettingSchema);
