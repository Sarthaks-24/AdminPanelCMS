const mongoose = require('mongoose');

const EmailTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['verify', 'reset'], required: true },
  hash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('EmailToken', EmailTokenSchema);
