/**
 * Push routes – VAPID public key (no auth), subscribe and status (caregiver or patient).
 */
const express = require('express');
const pushController = require('../controllers/pushController');
const { verifyToken } = require('../middleware/auth');
const { requireAny } = require('../middleware/roles');

const router = express.Router();

router.get('/vapid-public-key', pushController.getVapidPublicKey);

router.use(verifyToken);
router.post('/subscribe', requireAny, pushController.saveSubscription);
router.post('/unsubscribe', requireAny, pushController.deleteSubscription);
router.get('/status', requireAny, pushController.getPushStatus);

module.exports = router;
