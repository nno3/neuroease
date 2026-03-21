/**
 * Send notification emails to caregivers based on their preferences.
 * Caregivers can opt in to: locationAlerts, missedReminders, gameCompletion.
 */
const { User } = require('../models');
const {
    sendCaregiverLocationAlertEmail,
    sendCaregiverReturnedToZoneEmail,
    sendCaregiverMissedReminderEmail,
    sendCaregiverGameCompletionEmail,
} = require('./emailService');

const DEFAULT_PREFS = { locationAlerts: false, missedReminders: false, gameCompletion: false };

function parsePrefs(raw) {
    if (!raw) return DEFAULT_PREFS;
    try {
        const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
            locationAlerts: !!p.locationAlerts,
            missedReminders: !!p.missedReminders,
            gameCompletion: !!p.gameCompletion,
        };
    } catch {
        return DEFAULT_PREFS;
    }
}

async function getCaregiversForPatient(patientId) {
    const patientUser = await User.findByPk(patientId, {
        attributes: ['id', 'name'],
        include: [
            {
                model: User,
                as: 'caregivers',
                attributes: ['id', 'email', 'name', 'emailNotificationPreferences'],
                through: { attributes: [] },
            },
        ],
    });
    if (!patientUser || !patientUser.caregivers) return [];
    return patientUser.caregivers;
}

/**
 * Notify caregivers when patient leaves safe zone.
 */
async function notifyCaregiversLocationAlert(patientId, patientName, timestamp, latitude, longitude) {
    const caregivers = await getCaregiversForPatient(patientId);
    const pName = patientName || 'Patient';
    if (caregivers.length === 0 && process.env.NODE_ENV !== 'production') {
        console.warn('Location alert: no caregivers assigned to patient', patientId);
    }
    for (const cg of caregivers) {
        const prefs = parsePrefs(cg.emailNotificationPreferences);
        if (!prefs.locationAlerts) continue;
        if (!cg.email?.trim()) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Location alert: skipping caregiver', cg.id, '- no email address');
            }
            continue;
        }
        await sendCaregiverLocationAlertEmail(cg.email, cg.name, pName, timestamp, patientId, latitude, longitude);
    }
}

/**
 * Notify caregivers when patient returns to safe zone.
 * Uses same locationAlerts preference; sends a calming, non-alarming email.
 */
async function notifyCaregiversReturnedToZone(patientId, patientName, timestamp, latitude, longitude) {
    const caregivers = await getCaregiversForPatient(patientId);
    const pName = patientName || 'Patient';
    for (const cg of caregivers) {
        const prefs = parsePrefs(cg.emailNotificationPreferences);
        if (!prefs.locationAlerts || !cg.email?.trim()) continue;
        await sendCaregiverReturnedToZoneEmail(cg.email, cg.name, pName, timestamp, patientId, latitude, longitude);
    }
}

/**
 * Notify caregivers when patient misses a reminder (overdue).
 */
async function notifyCaregiversMissedReminder(patientId, patientName, reminderTitle, scheduledTime) {
    const caregivers = await getCaregiversForPatient(patientId);
    const pName = patientName || 'Patient';
    for (const cg of caregivers) {
        const prefs = parsePrefs(cg.emailNotificationPreferences);
        if (!prefs.missedReminders || !cg.email?.trim()) continue;
        await sendCaregiverMissedReminderEmail(cg.email, cg.name, pName, reminderTitle, scheduledTime);
    }
}

/**
 * Notify caregivers when patient completes a game.
 * maxScore and difficulty are optional (for clearer email formatting).
 */
async function notifyCaregiversGameCompletion(patientId, patientName, gameType, score, duration, maxScore, difficulty) {
    const caregivers = await getCaregiversForPatient(patientId);
    const pName = patientName || 'Patient';
    for (const cg of caregivers) {
        const prefs = parsePrefs(cg.emailNotificationPreferences);
        if (!prefs.gameCompletion || !cg.email?.trim()) continue;
        await sendCaregiverGameCompletionEmail(cg.email, cg.name, pName, gameType, score, duration, maxScore, difficulty);
    }
}

module.exports = {
    notifyCaregiversLocationAlert,
    notifyCaregiversReturnedToZone,
    notifyCaregiversMissedReminder,
    notifyCaregiversGameCompletion,
    parsePrefs,
};
