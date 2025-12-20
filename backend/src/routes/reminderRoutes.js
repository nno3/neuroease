const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { validateReminder } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');
const {requireCaregiver} = require("../middleware/roles");

// Correct way: Pass the middleware functions directly
router.post('/',verifyToken, validateReminder, reminderController.createReminder);
router.get('/patient/:patientId', verifyToken, reminderController.getRemindersForPatient);
router.put('/:id', verifyToken, reminderController.updateReminder);
router.delete('/:id', verifyToken, reminderController.deleteReminder);

module.exports = router;