const express = require('express');
const router = express.Router();
const {
  getExperience,
  createExperience,
  updateExperience,
  deleteExperience,
} = require('../controllers/experienceController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const validateId = require('../middleware/validateId');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const optionalSession = require('../middleware/optionalSession');

// Public routes
router.get('/', optionalSession, getExperience);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Experience), createExperience);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Experience), updateExperience);
router.delete('/:id', requireVerifiedSession, validateId(), deleteExperience);

module.exports = router;
