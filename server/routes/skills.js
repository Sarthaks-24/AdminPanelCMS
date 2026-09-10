const express = require('express');
const router = express.Router();
const {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
} = require('../controllers/skillController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.get('/', getSkills);

// Protected routes (Admin only)
router.post('/', requireAdmin, createSkill);
router.put('/:id', requireAdmin, updateSkill);
router.delete('/:id', requireAdmin, deleteSkill);

module.exports = router;
