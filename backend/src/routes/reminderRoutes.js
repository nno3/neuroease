/**
 * Reminder routes – mounted at /api/reminders.
 * CRUD for reminders; ownership enforced in controller (caregiver: assigned patients only; patient: self).
 */
const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { validateReminder } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const { requireCaregiver } = require('../middleware/roles');

router.post('/', verifyToken, validateReminder, reminderController.createReminder);
router.get('/patient/:patientId', verifyToken, reminderController.getRemindersForPatient);
router.put('/:id', verifyToken, reminderController.updateReminder);
router.delete('/:id', verifyToken, reminderController.deleteReminder);

module.exports = router;