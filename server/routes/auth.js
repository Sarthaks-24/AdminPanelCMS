const express = require('express');
const router = express.Router();
const { login, verify } = require('../controllers/authController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.post('/login', login);

// Protected route
router.get('/verify', requireAdmin, verify);

module.exports = router;
