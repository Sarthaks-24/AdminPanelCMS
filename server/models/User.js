const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { evictOwner, bumpOwnerVersion } = require('../lib/cache');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  emailVerifiedAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
  encDEK: { type: String, default: null },
}, { timestamps: true });

UserSchema.pre('save', function captureDeactivation() {
  this.$locals.deactivatedNow = this.isModified('status') && this.status === 'deleted';
});
UserSchema.post('save', function invalidateDeletedOwner(user) {
  if (user.$locals.deactivatedNow) {
    evictOwner(user._id);
    bumpOwnerVersion(user._id);
  }
});

UserSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);
