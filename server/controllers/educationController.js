const Education = require('../models/Education');

// @desc    Get all education credentials
// @route   GET /api/education
// @access  Public
const getEducation = async (req, res, next) => {
  try {
    const items = await Education.find().sort({ order: 1, createdAt: 1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new education credential
// @route   POST /api/education
// @access  Protected (Admin)
const createEducation = async (req, res, next) => {
  try {
    const item = await Education.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

// @desc    Update education credential
// @route   PUT /api/education/:id
// @access  Protected (Admin)
const updateEducation = async (req, res, next) => {
  try {
    const updated = await Education.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Education record not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete education credential
// @route   DELETE /api/education/:id
// @access  Protected (Admin)
const deleteEducation = async (req, res, next) => {
  try {
    const deleted = await Education.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Education record not found' });
    }
    res.json({ success: true, message: 'Education record deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
};
