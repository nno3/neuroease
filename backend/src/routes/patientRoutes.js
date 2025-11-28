const express = require('express');
const patientController = require('../controllers/patientController');
const { verifyToken } = require('../middleware/auth');
const { requireCaregiver, requireAny } = require('../middleware/roles');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Caregiver assigns patient
router.post('/assign', requireCaregiver, patientController.assignPatient);

// Get patient details (with ownership check)
router.get('/:patientId', requireAny, patientController.getPatientDetails);

module.exports = router;