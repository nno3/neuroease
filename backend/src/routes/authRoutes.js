const express = require('express');
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const {verifyToken} = require('../middleware/auth');
const {requireAny} = require('../middleware/roles');
const router = express.Router();

//Public routes
// POST /api/auth/register
router.post('/register',validateRegister, authController.register);
// POST /api/auth/login
router.post('/login',validateLogin, authController.login);

// Protected routes (require authentication)
router.get('/profile', verifyToken, requireAny, authController.getProfile); // GET /api/auth/profile
router.post('/logout', verifyToken, requireAny, authController.logout); // POST /api/auth/logout

module.exports = router;