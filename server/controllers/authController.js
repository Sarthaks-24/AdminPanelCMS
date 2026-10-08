const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase(), status: 'active' });
    const passwordMatches = user
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
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
