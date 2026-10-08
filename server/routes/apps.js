const express = require('express');
const router = express.Router();
const requireVerifiedSession = require('../middleware/requireVerifiedSession');
const validateId = require('../middleware/validateId');
const { listApps, createApp, getApp, updateApp, deleteApp, getAppPreview, getTokens, createToken, revokeToken } = require('../controllers/appsController');

router.use(requireVerifiedSession);
router.get('/', listApps);
router.post('/', createApp);
router.get('/:id', validateId(), getApp);
router.get('/:id/tokens', validateId(), getTokens);
router.post('/:id/tokens', validateId(), createToken);
router.delete('/:id/tokens/:tokenId', validateId('tokenId'), validateId(), revokeToken);
router.get('/:id/preview', validateId(), getAppPreview);
router.put('/:id', validateId(), updateApp);
router.delete('/:id', validateId(), deleteApp);

module.exports = router;
