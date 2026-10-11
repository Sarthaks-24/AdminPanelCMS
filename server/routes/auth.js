const express = require('express');
const router = express.Router();
const { login, verify, signup, signupConfig, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword, logout, me } = require('../controllers/authController');
const requireSession = require('../middleware/requireSession');
const { requireTurnstile } = require('../lib/turnstile');
const { loginRateLimiters, signupRateLimiters, verifyEmailRateLimiter, resetPasswordRateLimiter, resendVerificationRateLimiters, recoveryRateLimiters, changePasswordRateLimiter } = require('../middleware/authRateLimiters');

// Public routes. Turnstile (when TURNSTILE_SECRET_KEY is set) runs after the limiters, so a flood is
// refused before any call to Cloudflare.
router.post('/login', ...loginRateLimiters, login);
router.get('/config', signupConfig);
router.post('/signup', ...signupRateLimiters, requireTurnstile, signup);
router.post('/verify-email', verifyEmailRateLimiter, verifyEmail);
router.post('/resend-verification', ...resendVerificationRateLimiters, requireTurnstile, resendVerification);
router.post('/forgot-password', ...recoveryRateLimiters, forgotPassword);
router.post('/reset-password', resetPasswordRateLimiter, resetPassword);
router.post('/logout', logout);

// Protected routes
router.get('/verify', requireSession, verify);
router.get('/me', requireSession, me);
router.post('/change-password', requireSession, changePasswordRateLimiter, changePassword);

module.exports = router;
