const Profile = require('../models/Profile');

// @desc    Get singleton profile
// @route   GET /api/profile
// @access  Public
const getProfile = async (req, res, next) => {
  try {
    let profile = await Profile.findOne();
    if (!profile) {
      // Auto-initialize with default schema values if database is fresh
      profile = await Profile.create({});
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

// @desc    Update or upsert singleton profile
// @route   PUT /api/profile
// @access  Protected (Admin)
const updateProfile = async (req, res, next) => {
  try {
    let profile = await Profile.findOne();
    if (!profile) {
      profile = await Profile.create(req.body);
    } else {
      Object.assign(profile, req.body);
      await profile.save();
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

// @desc    Quick update availability status
// @route   PATCH /api/profile/availability
// @access  Protected (Admin)
const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailableForHire, statusText } = req.body;
    let profile = await Profile.findOne();
    if (!profile) {
      profile = await Profile.create({ isAvailableForHire, statusText });
    } else {
      if (typeof isAvailableForHire === 'boolean') {
        profile.isAvailableForHire = isAvailableForHire;
      }
      if (statusText !== undefined) {
        profile.statusText = statusText;
      }
      await profile.save();
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvailability,
};
