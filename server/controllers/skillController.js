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

// @desc    Bulk update multiple skills
// @route   PATCH /api/skills/bulk
// @access  Protected (Admin)
const bulkUpdateSkills = async (req, res, next) => {
  try {
    const { ids, updates, items } = req.body;

    // Mode A: Individual item updates in batch [{ id, ...fields }]
    if (Array.isArray(items) && items.length > 0) {
      const updatePromises = items.map(async (item) => {
        const targetId = item.id || item._id;
        if (!targetId) return null;
        const { id, _id, createdAt, updatedAt, ...fields } = item;
        return Skill.findByIdAndUpdate(targetId, fields, {
          new: true,
          runValidators: true,
        });
      });
      const results = await Promise.all(updatePromises);
      const filtered = results.filter(Boolean);
      return res.json({ success: true, count: filtered.length, skills: filtered });
    }

    // Mode B: Uniform updates across an array of IDs { ids: [...], updates: {...} }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of skill IDs' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, message: 'Updates object is required' });
    }

    const setFields = {};
    if (updates.category) setFields.category = updates.category;
    if (updates.proficiency) setFields.proficiency = updates.proficiency;
    if (updates.yearsOfExperience !== undefined && updates.yearsOfExperience !== '') {
      const parsedYears = Number(updates.yearsOfExperience);
      if (!isNaN(parsedYears) && parsedYears >= 0) {
        setFields.yearsOfExperience = parsedYears;
      }
    }
    if (typeof updates.featured === 'boolean') {
      setFields.featured = updates.featured;
    }

    if (Object.keys(setFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    await Skill.updateMany(
      { _id: { $in: ids } },
      { $set: setFields },
      { runValidators: true }
    );

    const updatedSkills = await Skill.find({ _id: { $in: ids } });
    res.json({
      success: true,
      count: updatedSkills.length,
      skills: updatedSkills,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete multiple skills
// @route   POST /api/skills/bulk-delete
// @access  Protected (Admin)
const bulkDeleteSkills = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of skill IDs' });
    }

    const result = await Skill.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} skills deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  bulkUpdateSkills,
  bulkDeleteSkills,
};
