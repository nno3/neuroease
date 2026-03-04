/**
 * Push routes – VAPID public key (no auth), subscribe and status (patient only).
 */
const express = require('express');
const pushController = require('../controllers/pushController');
const { verifyToken } = require('../middleware/auth');
const { requirePatient } = require('../middleware/roles');

const router = express.Router();

router.get('/vapid-public-key', pushController.getVapidPublicKey);

router.use(verifyToken);
router.post('/subscribe', requirePatient, pushController.saveSubscription);
router.get('/status', requirePatient, pushController.getPushStatus);

module.exports = router;
