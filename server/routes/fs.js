const express = require('express');
const router = express.Router();
const { getVirtualFilesystem } = require('../controllers/fsController');
const optionalSession = require('../middleware/optionalSession');

// Public route: Complete virtual filesystem tree
router.get('/', optionalSession, getVirtualFilesystem);

module.exports = router;
