const mongoose = require('mongoose');

// Caps on new invites; existing records created with higher limits are still honoured until they expire.
const MAX_INVITE_USES = 50;
const MAX_INVITE_DAYS = 90;

const InviteSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // `usedBy` is retained for compatibility with existing single-use invite records.
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usedCount: { type: Number, default: 0, min: 0 },
  maxUses: { type: Number, default: 1, min: 1, max: 1000 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: { createdAt: true, updatedAt: false } });

const Invite = mongoose.model('Invite', InviteSchema);
Invite.MAX_INVITE_USES = MAX_INVITE_USES;
Invite.MAX_INVITE_DAYS = MAX_INVITE_DAYS;

module.exports = Invite;
