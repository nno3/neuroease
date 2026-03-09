/**
 * Game routes – mounted at /api/games.
 * Patient submits game sessions; requires JWT and patient role.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');
const gameController = require('../controllers/gameController');

// POST /api/games – create game session (patient-only)
router.post('/', verifyToken, requirePatient, gameController.createSession);

module.exports = router;
