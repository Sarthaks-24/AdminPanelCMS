const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // `usedBy` is retained for compatibility with existing single-use invite records.
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usedCount: { type: Number, default: 0, min: 0 },
  maxUses: { type: Number, default: 1, min: 1, max: 1000 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('Invite', InviteSchema);
