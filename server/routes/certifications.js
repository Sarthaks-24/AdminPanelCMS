const express = require('express');
const router = express.Router();
const {
  getCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
} = require('../controllers/certificationController');
const requireAdmin = require('../middleware/requireAdmin');

// Public route
router.get('/', getCertifications);

// Protected routes (Admin only)
router.post('/', requireAdmin, createCertification);
router.put('/:id', requireAdmin, updateCertification);
router.delete('/:id', requireAdmin, deleteCertification);

module.exports = router;
