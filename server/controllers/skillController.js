const Skill = require('../models/Skill');

// @desc    Get all skills (grouped by category and sorted)
// @route   GET /api/skills
// @access  Public
const getSkills = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.featured === 'true') {
      filter.featured = true;
    }

    const skills = await Skill.find(filter).sort({ order: 1, name: 1 });

    // Group by category for instant consumption
    const byCategory = {};
    skills.forEach((skill) => {
      if (!byCategory[skill.category]) {
        byCategory[skill.category] = [];
      }
      byCategory[skill.category].push(skill);
    });

    res.json({
      skills,
      byCategory,
      total: skills.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new skill (single or batch array)
// @route   POST /api/skills
// @access  Protected (Admin)
const createSkill = async (req, res, next) => {
  try {
    if (Array.isArray(req.body)) {
      // Batch insertion
      const inserted = await Skill.insertMany(req.body, { ordered: false });
      return res.status(201).json(inserted);
    }

    const skill = await Skill.create(req.body);
    res.status(201).json(skill);
  } catch (error) {
    next(error);
  }
};

// @desc    Update skill
// @route   PUT /api/skills/:id
// @access  Protected (Admin)
const updateSkill = async (req, res, next) => {
  try {
    const updated = await Skill.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete skill
// @route   DELETE /api/skills/:id
// @access  Protected (Admin)
const deleteSkill = async (req, res, next) => {
  try {
    const deleted = await Skill.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }
    res.json({ success: true, message: 'Skill deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
};
