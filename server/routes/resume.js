const express = require('express');
const router = express.Router();
const { getResume, downloadResume, updateResume } = require('../controllers/resumeController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const optionalSession = require('../middleware/optionalSession');

// Public route: Get the current resume link
router.get('/download', optionalSession, downloadResume);
router.get('/', optionalSession, getResume);

// Protected route: Admin CMS update for resume link
router.put('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Resume), updateResume);

module.exports = router;
