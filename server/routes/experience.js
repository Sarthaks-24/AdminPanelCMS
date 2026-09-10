const express = require('express');
const router = express.Router();
const {
  getExperience,
  createExperience,
  updateExperience,
  deleteExperience,
} = require('../controllers/experienceController');
const requireAdmin = require('../middleware/requireAdmin');

// Public routes
router.get('/', getExperience);

// Protected routes (Admin only)
router.post('/', requireAdmin, createExperience);
router.put('/:id', requireAdmin, updateExperience);
router.delete('/:id', requireAdmin, deleteExperience);

module.exports = router;
