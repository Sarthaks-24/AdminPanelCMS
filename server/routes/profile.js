const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateAvailability,
} = require('../controllers/profileController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const requireSession = require('../middleware/requireSession');

// Dashboard read; external consumers use the scoped /v1 API.
router.get('/', requireSession, getProfile);

// Protected routes (Admin only)
router.put('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Profile), updateProfile);
router.patch('/availability', requireVerifiedSession, pickWritable(['isAvailableForHire', 'statusText']), updateAvailability);

module.exports = router;
