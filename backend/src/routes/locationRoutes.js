/**
 * Location routes – mounted at /api/location.
 * Caregiver routes: update, latest, alerts, status.
 * Patient route: POST /patient/update for patients to send their own location.
 */
const express = require('express');
const locationController = require('../controllers/locationController');
const { verifyToken } = require('../middleware/auth');
const { requireCaregiver, requirePatient } = require('../middleware/roles');

const router = express.Router();
router.use(verifyToken);

router.post('/patient/update', requirePatient, locationController.patientUpdate);

router.post('/update', requireCaregiver, locationController.update);
router.get('/latest', requireCaregiver, locationController.latest);
router.get('/history', requireCaregiver, locationController.history);
router.get('/alerts', requireCaregiver, locationController.alerts);
router.get('/status', requireCaregiver, locationController.status);

module.exports = router;
