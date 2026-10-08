const User = require('../models/User');

module.exports = async function ownerForRequest(req) {
  if (req.userId) return req.userId;
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) return null;
  const primaryUser = await User.findOne({ email, status: 'active' }).select('_id');
  return primaryUser?._id || null;
};
