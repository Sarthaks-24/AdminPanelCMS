const Certification = require('../models/Certification');

// @desc    Get all certifications and licenses
// @route   GET /api/certifications
// @access  Public
const getCertifications = async (req, res, next) => {
  try {
    const certs = await Certification.find().sort({ order: 1, createdAt: 1 });
    res.json(certs);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new certification
// @route   POST /api/certifications
// @access  Protected (Admin)
const createCertification = async (req, res, next) => {
  try {
    const cert = await Certification.create(req.body);
    res.status(201).json(cert);
  } catch (error) {
    next(error);
  }
};

// @desc    Update certification
// @route   PUT /api/certifications/:id
// @access  Protected (Admin)
const updateCertification = async (req, res, next) => {
  try {
    const updated = await Certification.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Certification not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete certification
// @route   DELETE /api/certifications/:id
// @access  Protected (Admin)
const deleteCertification = async (req, res, next) => {
  try {
    const deleted = await Certification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Certification not found' });
    }
    res.json({ success: true, message: 'Certification deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
};
