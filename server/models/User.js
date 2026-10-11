const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { evictOwner, bumpOwnerVersion } = require('../lib/cache');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  // Null until the verification link is opened: whoever proves the email chooses the password.
  passwordHash: { type: String, required: false, default: null },
  emailVerifiedAt: { type: Date, default: null },
  acceptedTermsAt: { type: Date, default: null },
  acceptedTermsVersion: { type: String, default: null },
  acceptedPrivacyAt: { type: Date, default: null },
  acceptedPrivacyVersion: { type: String, default: null },
  // When the "an account already exists" notice was last sent, so a leaked invite cannot spam a tenant.
  accountExistsNoticeAt: { type: Date, default: null },
  // Superadmin password re-check for destructive platform actions (valid for ten minutes).
  adminReauthAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active', index: true },
  role: { type: String, enum: ['user', 'superadmin'], default: 'user', index: true },
}, { timestamps: true });

UserSchema.index({ emailVerifiedAt: 1, createdAt: 1 });

UserSchema.pre('save', function captureDeactivation() {
  this.$locals.deactivatedNow = this.isModified('status') && this.status !== 'active';
});
UserSchema.post('save', function invalidateDeactivatedOwner(user) {
  if (user.$locals.deactivatedNow) {
    evictOwner(user._id);
    bumpOwnerVersion(user._id);
  }
});

UserSchema.methods.matchPassword = async function matchPassword(password) {
  if (!this.passwordHash || typeof password !== 'string') return false;
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);
