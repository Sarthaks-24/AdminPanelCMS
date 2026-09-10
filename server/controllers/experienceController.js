const Experience = require('../models/Experience');

// @desc    Get all experience entries (sorted by order)
// @route   GET /api/experience
// @access  Public
const getExperience = async (req, res, next) => {
  try {
    const items = await Experience.find().sort({ order: 1, createdAt: -1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new experience entry
// @route   POST /api/experience
// @access  Protected (Admin)
const createExperience = async (req, res, next) => {
  try {
    const experience = await Experience.create(req.body);
    res.status(201).json(experience);
  } catch (error) {
    next(error);
  }
};

// @desc    Update experience entry by ID
// @route   PUT /api/experience/:id
// @access  Protected (Admin)
const updateExperience = async (req, res, next) => {
  try {
    const updated = await Experience.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Experience entry not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete experience entry by ID
// @route   DELETE /api/experience/:id
// @access  Protected (Admin)
const deleteExperience = async (req, res, next) => {
  try {
    const deleted = await Experience.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Experience entry not found' });
    }
    res.json({ success: true, message: 'Experience entry removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExperience,
  createExperience,
  updateExperience,
  deleteExperience,
};
