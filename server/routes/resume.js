const express = require('express');
const router = express.Router();
const { getResume, updateResume } = require('../controllers/resumeController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route: Get the current resume link
router.get('/', getResume);

// Protected route: Admin CMS update for resume link
router.put('/', requireAdmin, updateResume);

module.exports = router;
