/**
 * Auth routes – mounted at /api/auth.
 * Public: register, login, email verification, patient activate and magic-link.
 * Protected: profile CRUD and logout (require JWT + role check).
 */
const express = require('express');
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { requireAny } = require('../middleware/roles');
const router = express.Router();

// Caregiver: sign up and sign in (email + password); verification links
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Patient: no password; invite link activates account, magic link logs in
router.post('/activate', authController.activatePatient);
router.get('/activate', authController.activatePatient);
router.post('/patient/request-login', authController.patientRequestLogin);
router.post('/patient/verify-link', authController.patientVerifyLink);
router.get('/patient/verify-link', authController.patientVerifyLink);

// Require valid JWT; requireAny allows both caregiver and patient
router.get('/profile', verifyToken, requireAny, authController.getProfile);
router.put('/profile', verifyToken, requireAny, authController.updateProfile);
router.delete('/profile', verifyToken, requireAny, authController.deleteAccount);
router.post('/logout', verifyToken, requireAny, authController.logout);

module.exports = router;