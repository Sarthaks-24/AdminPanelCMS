const express = require('express');
const router = express.Router();
const requireSession = require('../middleware/requireSession');
const { accountDestructiveRateLimiter } = require('../middleware/authRateLimiters');
const { exportAccount, deleteAccount } = require('../controllers/accountController');

router.use(requireSession);
router.get('/export', accountDestructiveRateLimiter, exportAccount);
router.delete('/', accountDestructiveRateLimiter, deleteAccount);

module.exports = router;
