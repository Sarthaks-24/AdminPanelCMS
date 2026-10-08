const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  emailVerifiedAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
  encDEK: { type: String, default: null },
}, { timestamps: true });

UserSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);
