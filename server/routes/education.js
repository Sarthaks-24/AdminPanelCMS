const express = require('express');
const router = express.Router();
const {
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation,
} = require('../controllers/educationController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const validateId = require('../middleware/validateId');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const requireSession = require('../middleware/requireSession');

// Dashboard read; external consumers use the scoped /v1 API.
router.get('/', requireSession, getEducation);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Education), createEducation);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Education), updateEducation);
router.delete('/:id', requireVerifiedSession, validateId(), deleteEducation);

module.exports = router;
