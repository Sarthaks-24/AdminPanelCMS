const express = require('express');
const router = express.Router();
const {
  getCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
} = require('../controllers/certificationController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const validateId = require('../middleware/validateId');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const optionalSession = require('../middleware/optionalSession');

// Public route
router.get('/', optionalSession, getCertifications);

// Protected routes (Admin only)
router.post('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Certification), createCertification);
router.put('/:id', requireVerifiedSession, validateId(), pickWritable(WRITABLE_FIELDS.Certification), updateCertification);
router.delete('/:id', requireVerifiedSession, validateId(), deleteCertification);

module.exports = router;
