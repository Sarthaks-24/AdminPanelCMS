const express = require('express');
const router = express.Router();
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { requireRecentReauth } = require('../middleware/requireSuperAdmin');
const validateId = require('../middleware/validateId');
const { adminReauthRateLimiter } = require('../middleware/authRateLimiters');
const { overview, listInvites, createInvite, revokeInvite, getSettings, updateSettings, listUsers, suspendUser, unsuspendUser, deleteUser, mailBudget, reauth } = require('../controllers/adminController');

router.use(requireSuperAdmin);
router.get('/overview', overview);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/invites', listInvites);
router.post('/invites', createInvite);
router.delete('/invites/:id', validateId(), revokeInvite);
router.get('/mail-budget', mailBudget);
router.post('/reauth', adminReauthRateLimiter, reauth);
router.get('/users', listUsers);
router.post('/users/:id/suspend', validateId(), requireRecentReauth, suspendUser);
router.post('/users/:id/unsuspend', validateId(), requireRecentReauth, unsuspendUser);
router.delete('/users/:id', validateId(), requireRecentReauth, deleteUser);

module.exports = router;
