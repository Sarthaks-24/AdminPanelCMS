const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

const ApiTokenSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  app: { type: mongoose.Schema.Types.ObjectId, ref: 'App', required: true, index: true },
  quotaSlot: { type: Number, required: true, min: 0, max: 1, select: false },
  type: { type: String, enum: ['pk', 'sk'], required: true },
  prefix: { type: String, required: true },
  hash: { type: String, required: true, unique: true },
  value: { type: String, default: null, select: false },
  label: { type: String, maxlength: 60, trim: true, default: '' },
  expiresAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

ApiTokenSchema.index({ app: 1, revokedAt: 1 });
ApiTokenSchema.index({ app: 1, quotaSlot: 1 }, { unique: true, partialFilterExpression: { revokedAt: null } });
ApiTokenSchema.pre('validate', function keepSecretTokensHashOnly() {
  if (this.type === 'sk') this.value = null;
});
// ownerGuard-exemption: the hash-only lookup is the credential authentication entry point; hash is a unique SHA-256 digest.
ApiTokenSchema.plugin(ownerGuardPlugin, { modelName: 'ApiToken' });

module.exports = mongoose.model('ApiToken', ApiTokenSchema);
