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
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const validateId = require('../middleware/validateId');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const optionalSession = require('../middleware/optionalSession');

// Public route
router.get('/', optionalSession, getSkills);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, createSkill);
router.patch('/bulk', requireVerifiedSession, bulkUpdateSkills);
router.post('/bulk-delete', requireVerifiedSession, bulkDeleteSkills);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Skill), updateSkill);
router.delete('/:id', requireVerifiedSession, validateId(), deleteSkill);

module.exports = router;
