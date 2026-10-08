const express = require('express');
const router = express.Router();
const { login, verify } = require('../controllers/authController');
const requireSession = require('../middleware/requireSession');
const { loginRateLimiters } = require('../middleware/authRateLimiters');

// Public route
router.post('/login', ...loginRateLimiters, login);

// Protected route
router.get('/verify', requireSession, verify);

module.exports = router;
