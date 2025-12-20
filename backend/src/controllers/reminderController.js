const { Reminder, User } = require('../models');

// Create reminder
const createReminder = async (req, res) => {
    try {
        const { patientId, title, message, reminderType, scheduledTime, recurrence } = req.body;

        // Ownership check
        if (req.user.userType === 'patient' && req.user.userId !== patientId) {
            return res.status(403).json({ success: false, message: "Patients can only create their own reminders" });
        }

        if (req.user.userType === 'caregiver') {
            const caregiver = await User.findByPk(req.user.userId);
            const patients = await caregiver.getPatients();
            if (!patients.some(p => p.id === patientId)) {
                return res.status(403).json({ success: false, message: "Not assigned to patient" });
            }
        }

        const reminder = await Reminder.create({
            patientId,
            title,
            message,
            reminderType,
            scheduledTime,
            recurrence
        });

        res.json({ success: true, data: reminder });

    } catch (error) {
        res.status(500).json({ success: false, message: "Error creating reminder" });
    }
};

// Get reminders for patient
const getRemindersForPatient = async (req, res) => {
    try {
        const patientId = parseInt(req.params.patientId);

        if (req.user.userType === 'patient' && req.user.userId !== patientId) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        if (req.user.userType === 'caregiver') {
            const caregiver = await User.findByPk(req.user.userId);
            const patients = await caregiver.getPatients();
            if (!patients.some(p => p.id === patientId)) {
                return res.status(403).json({ success: false, message: "Not assigned to patient" });
            }
        }

        const reminders = await Reminder.findAll({
            where: { patientId }
        });

        res.json({ success: true, data: reminders });

    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching reminders" });
    }
};

// Update reminder
const updateReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findByPk(req.params.id);

        if (!reminder) {
            return res.status(404).json({ success: false, message: "Reminder not found" });
        }

        // Ownership check
        if (req.user.userType === 'patient' && req.user.userId !== reminder.patientId) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        if (req.user.userType === 'caregiver') {
            const caregiver = await User.findByPk(req.user.userId);
            const patients = await caregiver.getPatients();
            if (!patients.some(p => p.id === reminder.patientId)) {
                return res.status(403).json({ success: false, message: "Not assigned to patient" });
            }
        }

        await reminder.update(req.body);

        res.json({ success: true, message: "Reminder updated", data: reminder });

    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating reminder" });
    }
};

// Delete reminder
const deleteReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findByPk(req.params.id);

        if (!reminder) {
            return res.status(404).json({ success: false, message: "Not found" });
        }

        // Ownership
        if (req.user.userType === 'patient' && req.user.userId !== reminder.patientId) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        if (req.user.userType === 'caregiver') {
            const caregiver = await User.findByPk(req.user.userId);
            const patients = await caregiver.getPatients();
            if (!patients.some(p => p.id === reminder.patientId)) {
                return res.status(403).json({ success: false, message: "Not assigned to patient" });
            }
        }

        await reminder.destroy();

        res.json({ success: true, message: "Reminder deleted" });

    } catch (error) {
        res.status(500).json({ success: false, message: "Error deleting reminder" });
    }
};

// Export all functions at the bottom (ONCE)
module.exports = {
    createReminder,
    getRemindersForPatient,
    updateReminder,
    deleteReminder
};