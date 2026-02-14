const express = require('express');
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const {verifyToken} = require('../middleware/auth');
const {requireAny} = require('../middleware/roles');
const router = express.Router();

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Patient passwordless: activate (invite link) and magic link login
router.post('/activate', authController.activatePatient);
router.get('/activate', authController.activatePatient);
router.post('/patient/request-login', authController.patientRequestLogin);
router.post('/patient/verify-link', authController.patientVerifyLink);
router.get('/patient/verify-link', authController.patientVerifyLink);

// Protected routes (require authentication)
router.get('/profile', verifyToken, requireAny, authController.getProfile);
router.put('/profile', verifyToken, requireAny, authController.updateProfile);
router.delete('/profile', verifyToken, requireAny, authController.deleteAccount);
router.post('/logout', verifyToken, requireAny, authController.logout);

module.exports = router;