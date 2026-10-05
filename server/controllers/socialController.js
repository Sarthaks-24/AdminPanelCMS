const Social = require('../models/Social');

// @desc    Get all social links
// @route   GET /api/socials
// @access  Public
const getSocials = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.featured === 'true') {
      filter.featured = true;
    }
    const socials = await Social.find(filter).sort({ order: 1, createdAt: 1 });
    res.json(socials);
  } catch (error) {
    next(error);
  }
};

// @desc    Create social link
// @route   POST /api/socials
// @access  Protected (Admin)
const createSocial = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.platform && payload.platform.toLowerCase() === 'email') {
      if (payload.url && !payload.url.startsWith('mailto:') && !payload.url.startsWith('http')) {
        payload.url = `mailto:${payload.url.trim()}`;
      }
    }
    const social = await Social.create(payload);
    res.status(201).json(social);
  } catch (error) {
    next(error);
  }
};

// @desc    Update social link
// @route   PUT /api/socials/:id
// @access  Protected (Admin)
const updateSocial = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.platform && payload.platform.toLowerCase() === 'email') {
      if (payload.url && !payload.url.startsWith('mailto:') && !payload.url.startsWith('http')) {
        payload.url = `mailto:${payload.url.trim()}`;
      }
    }
    const updated = await Social.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Social link not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete social link
// @route   DELETE /api/socials/:id
// @access  Protected (Admin)
const deleteSocial = async (req, res, next) => {
  try {
    const deleted = await Social.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Social link not found' });
    }
    res.json({ success: true, message: 'Social link deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk reorder social links
// @route   PATCH /api/socials/reorder
// @access  Protected (Admin)
const reorderSocials = async (req, res, next) => {
  try {
    const { items } = req.body; // Array of { id, order }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array required' });
    }
    const updatePromises = items.map((item) =>
      Social.findByIdAndUpdate(item.id, { order: item.order })
    );
    await Promise.all(updatePromises);
    const updatedList = await Social.find().sort({ order: 1 });
    res.json(updatedList);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSocials,
  createSocial,
  updateSocial,
  deleteSocial,
  reorderSocials,
};
