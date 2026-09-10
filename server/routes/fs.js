const express = require('express');
const router = express.Router();
const { getVirtualFilesystem } = require('../controllers/fsController');

// Public route: Complete virtual filesystem tree
router.get('/', getVirtualFilesystem);

module.exports = router;
