const express = require('express');
const router = express.Router();
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const validateId = require('../middleware/validateId');
const { overview, listInvites, createInvite, revokeInvite } = require('../controllers/adminController');

router.use(requireSuperAdmin);
router.get('/overview', overview);
router.get('/invites', listInvites);
router.post('/invites', createInvite);
router.delete('/invites/:id', validateId(), revokeInvite);

module.exports = router;
