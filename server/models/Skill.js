const mongoose = require('mongoose');

const SkillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      unique: true,
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
      index: true,
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
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Skill', SkillSchema);
