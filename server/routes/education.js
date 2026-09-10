const express = require('express');
const router = express.Router();
const {
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
} = require('../controllers/educationController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.get('/', getEducation);

// Protected routes (Admin only)
router.post('/', requireAdmin, createEducation);
router.put('/:id', requireAdmin, updateEducation);
router.delete('/:id', requireAdmin, deleteEducation);

module.exports = router;
