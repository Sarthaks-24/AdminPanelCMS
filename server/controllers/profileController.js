const Profile = require('../models/Profile');
const Social = require('../models/Social');

// Helper to synchronize public profile email with Email social coordinate
const syncEmailToSocial = async (rawEmail) => {
  if (!rawEmail || typeof rawEmail !== 'string') return;
  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (!normalizedEmail) return;

  const emailQuery = {
    $or: [
      { platform: { $regex: /^email$/i } },
      { icon: 'mail' },
      { url: { $regex: /^mailto:/i } },
    ],
  };

  const existingEmailSocials = await Social.find(emailQuery);

  if (existingEmailSocials.length > 0) {
    await Social.updateMany(emailQuery, {
      $set: {
        platform: 'Email',
        label: normalizedEmail,
        url: `mailto:${normalizedEmail}`,
        username: normalizedEmail.split('@')[0],
        icon: 'mail',
      },
    });
  } else {
    // If no email social link exists in the database, create one
    const count = await Social.countDocuments();
    await Social.create({
      platform: 'Email',
      label: normalizedEmail,
      url: `mailto:${normalizedEmail}`,
      username: normalizedEmail.split('@')[0],
      icon: 'mail',
      order: count,
      featured: true,
    });
  }
};

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

    // Synchronize public profile email to the Email social link
    // (Note: Dashboard admin login email remains separate and unchanged)
    if (profile.email) {
      await syncEmailToSocial(profile.email);
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
