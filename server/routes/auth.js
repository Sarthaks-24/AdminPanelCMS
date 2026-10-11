const express = require('express');
const router = express.Router();
const { login, verify, signup, signupConfig, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword, logout, me } = require('../controllers/authController');
const requireSession = require('../middleware/requireSession');
const { loginRateLimiters, signupRateLimiters, verificationRateLimiter, resendVerificationRateLimiters, recoveryRateLimiters, changePasswordRateLimiter } = require('../middleware/authRateLimiters');

// Public routes
router.post('/login', ...loginRateLimiters, login);
router.get('/config', signupConfig);
router.post('/signup', ...signupRateLimiters, signup);
router.post('/verify-email', verificationRateLimiter, verifyEmail);
router.post('/resend-verification', ...resendVerificationRateLimiters, resendVerification);
router.post('/forgot-password', ...recoveryRateLimiters, forgotPassword);
router.post('/reset-password', verificationRateLimiter, resetPassword);
router.post('/logout', logout);

// Protected routes
router.get('/verify', requireSession, verify);
router.get('/me', requireSession, me);
router.post('/change-password', requireSession, changePasswordRateLimiter, changePassword);

module.exports = router;
