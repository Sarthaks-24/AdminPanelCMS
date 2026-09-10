const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateAvailability,
} = require('../controllers/profileController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.get('/', getProfile);

// Protected routes (Admin only)
router.put('/', requireAdmin, updateProfile);
router.patch('/availability', requireAdmin, updateAvailability);

module.exports = router;
