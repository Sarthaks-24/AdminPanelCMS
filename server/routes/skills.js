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
const requireSession = require('../middleware/requireSession');

// Dashboard read; external consumers use the scoped /v1 API.
router.get('/', requireSession, getSkills);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, createSkill);
router.patch('/bulk', requireVerifiedSession, bulkUpdateSkills);
router.post('/bulk-delete', requireVerifiedSession, bulkDeleteSkills);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Skill), updateSkill);
router.delete('/:id', requireVerifiedSession, validateId(), deleteSkill);

module.exports = router;
