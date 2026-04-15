/**
 * Patient routes – mounted at /api/patients.
 * All routes require JWT; caregivers can create/assign/archive; patients can read/update own profile.
 */
const express = require('express');
const patientController = require('../controllers/patientController');
const { verifyToken } = require('../middleware/auth');
const { requireCaregiver, requireAny } = require('../middleware/roles');
const { validatePatientRegistration } = require('../middleware/validation');

const router = express.Router();
router.use(verifyToken);

// Caregiver assigns patient
router.post('/assign', requireCaregiver, patientController.assignPatient);

// Patient management routes
router.post('/', requireCaregiver, validatePatientRegistration, patientController.createPatient);
router.get('/', requireCaregiver, patientController.getAllPatients);
router.put('/:id', requireAny, patientController.updatePatient);

// Delete patient details
router.delete('/:id', requireCaregiver, patientController.removePatientAssignment);

//Restore patients
router.post('/:id/restore', requireCaregiver, patientController.restorePatientAssignment);


router.post('/:id/archive', requireCaregiver, patientController.archivePatient);
router.post('/:id/send-invite', requireCaregiver, patientController.sendInvite);

//Unarchived a patient
router.post('/:id/unarchive', requireCaregiver, patientController.unarchivePatient);

// Get all archived patients
router.get('/archived',requireCaregiver, patientController.getArchivedPatients);

// Get archive audit log (comprehensive history of archived and unarchived patients)
router.get('/archive-audit',requireCaregiver, patientController.getArchiveAuditLog);

// Get patient details (with ownership check)
router.get('/:patientId', requireAny, patientController.getPatientDetails);

module.exports = router;
