const express = require('express');
const router = express.Router();
const {
  getSocials,
  createSocial,
  updateSocial,
  deleteSocial,
  reorderSocials,
} = require('../controllers/socialController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const validateId = require('../middleware/validateId');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const requireSession = require('../middleware/requireSession');

// Dashboard read; external consumers use the scoped /v1 API.
router.get('/', requireSession, getSocials);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Social), createSocial);
router.patch('/reorder', requireVerifiedSession, reorderSocials);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Social), updateSocial);
router.delete('/:id', requireVerifiedSession, validateId(), deleteSocial);

module.exports = router;
