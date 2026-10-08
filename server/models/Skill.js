const mongoose = require('mongoose');
const { ownerGuardPlugin } = require('../plugins/ownerGuard');

const SkillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      maxlength: 120,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Languages',
        'Frontend',
        'Backend & Systems',
        'Databases & Caching',
        'DevOps & Cloud',
        'Hardware & Electronics',
        'Tools & Frameworks',
      ],
      default: 'Backend & Systems',
    },
    proficiency: {
      type: String,
      enum: ['Beginner', 'Familiar', 'Proficient', 'Advanced', 'Expert'],
      default: 'Proficient',
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 1,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true },
    visibility: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  {
    timestamps: true,
  }
);

SkillSchema.index({ owner: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
SkillSchema.index({ owner: 1, category: 1 });
SkillSchema.plugin(ownerGuardPlugin, { modelName: 'Skill' });

module.exports = mongoose.model('Skill', SkillSchema);
