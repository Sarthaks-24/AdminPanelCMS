const express = require('express');
const router = express.Router();
const {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  bulkUpdateSkills,
  bulkDeleteSkills,
} = require('../controllers/skillController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.get('/', getSkills);

// Protected routes (Admin only)
router.post('/', requireAdmin, createSkill);
router.patch('/bulk', requireAdmin, bulkUpdateSkills);
router.post('/bulk-delete', requireAdmin, bulkDeleteSkills);
router.put('/:id', requireAdmin, updateSkill);
router.delete('/:id', requireAdmin, deleteSkill);

module.exports = router;
