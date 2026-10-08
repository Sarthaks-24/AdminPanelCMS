const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

const CertificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Certification title is required'],
      maxlength: 120,
      trim: true,
    },
    issuer: {
      type: String,
      required: [true, 'Issuing organization is required'],
      maxlength: 120,
      trim: true,
    },
    issueDate: {
      type: String,
      required: [true, 'Issue date is required'], // e.g., 'August 2025' or ISO Date
    },
    expirationDate: {
      type: String,
      default: 'No Expiration',
    },
    credentialId: {
      type: String,
      default: '',
      trim: true,
    },
    credentialUrl: {
      type: String,
      default: '',
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
    featured: { type: Boolean, default: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
    visibility: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  {
    timestamps: true,
  }
);

CertificationSchema.index({ owner: 1, issueDate: -1 });
CertificationSchema.plugin(ownerGuardPlugin, { modelName: 'Certification' });

module.exports = mongoose.model('Certification', CertificationSchema);
