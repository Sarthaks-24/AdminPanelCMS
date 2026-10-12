const express = require('express');
const router = express.Router();
const requireSession = require('../middleware/requireSession');
const { accountDestructiveRateLimiter } = require('../middleware/authRateLimiters');
const { exportAccount, deleteAccount, contentSummary } = require('../controllers/accountController');

router.use(requireSession);
router.get('/summary', contentSummary);
router.get('/export', accountDestructiveRateLimiter, exportAccount);
router.delete('/', accountDestructiveRateLimiter, deleteAccount);

module.exports = router;
