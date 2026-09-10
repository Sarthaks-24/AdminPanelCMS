const express = require('express');
const router = express.Router();
const {
  getSocials,
  createSocial,
  updateSocial,
  deleteSocial,
  reorderSocials,
} = require('../controllers/socialController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.get('/', getSocials);

// Protected routes (Admin only)
router.post('/', requireAdmin, createSocial);
router.patch('/reorder', requireAdmin, reorderSocials);
router.put('/:id', requireAdmin, updateSocial);
router.delete('/:id', requireAdmin, deleteSocial);

module.exports = router;
