const express = require('express');
const router = express.Router();
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const validateId = require('../middleware/validateId');
const { overview, listInvites, createInvite, revokeInvite, getSettings, updateSettings } = require('../controllers/adminController');

router.use(requireSuperAdmin);
router.get('/overview', overview);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/invites', listInvites);
router.post('/invites', createInvite);
router.delete('/invites/:id', validateId(), revokeInvite);

module.exports = router;
