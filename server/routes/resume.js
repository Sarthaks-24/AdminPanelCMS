const express = require('express');
const router = express.Router();
const { getResume, updateResume } = require('../controllers/resumeController');
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const pickWritable = require('../middleware/pickWritable');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const requireSession = require('../middleware/requireSession');

// Dashboard read; external consumers use resumeUrl from the scoped /v1/resume API.
router.get('/', requireSession, getResume);

// Protected route: Admin CMS update for resume link
router.put('/', requireVerifiedSession, pickWritable(WRITABLE_FIELDS.Resume), updateResume);

module.exports = router;
