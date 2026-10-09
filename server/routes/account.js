const express = require('express');
const router = express.Router();
const requireSession = require('../middleware/requireSession');
const { exportAccount, deleteAccount } = require('../controllers/accountController');

router.use(requireSession);
router.get('/export', exportAccount);
router.delete('/', deleteAccount);

module.exports = router;
