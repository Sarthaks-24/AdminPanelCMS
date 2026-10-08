const jwt = require('jsonwebtoken');
const User = require('../models/User');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });
    const user = await User.findOne({ email: String(email).toLowerCase(), status: 'active' });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ sub: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const identity = { id: user._id, email: user.email };
    return res.json({ success: true, token, user: identity, admin: identity });
  } catch (error) {
    return next(error);
  }
};

const verify = (req, res) => {
  const identity = { id: req.user._id, email: req.user.email };
  res.json({ success: true, valid: true, user: identity, admin: identity });
};

module.exports = { login, verify };
