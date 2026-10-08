const express = require('express');
const router = express.Router();
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const validateId = require('../middleware/validateId');
const { listApps, createApp, updateApp, deleteApp, getAppPreview } = require('../controllers/appsController');

router.use(requireVerifiedSession);
router.get('/', listApps);
router.post('/', createApp);
router.get('/:id/preview', validateId(), getAppPreview);
router.put('/:id', validateId(), updateApp);
router.delete('/:id', validateId(), deleteApp);

module.exports = router;
