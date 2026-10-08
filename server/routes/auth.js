const express = require('express');
const router = express.Router();
const { login, verify } = require('../controllers/authController');
const requireSession = require('../middleware/requireSession');

// Public route
router.post('/login', login);

// Protected route
router.get('/verify', requireSession, verify);

module.exports = router;
