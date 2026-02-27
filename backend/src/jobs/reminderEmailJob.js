/**
 * Reminder email job – runs periodically, finds reminders that are due (and not completed),
 * and sends one email per due reminder when the patient's preference is "email".
 * Uses a 5-minute due window to avoid duplicate sends. Tracks reminderEmailSentAt on Reminder.
 */
const { Op } = require('sequelize');
const { Reminder, Patient, User } = require('../models');
const { sendReminderEmail } = require('../utils/emailService');

const RUN_INTERVAL_MS = 2 * 60 * 1000; // run every 2 minutes so we catch due reminders sooner

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns true if this reminder is due and we have not yet sent an email for this occurrence.
 * - ONCE: due if scheduledTime <= now and we haven't sent (no narrow window—we send any past-due unsent).
 * - DAILY: due if today's occurrence time has passed and we haven't sent today.
 * - WEEKLY: due if this week's occurrence has passed and we haven't sent for that occurrence.
 */
function isDueAndUnsent(reminder, now) {
    const base = new Date(reminder.scheduledTime);
    if (Number.isNaN(base.getTime())) return false;

    const recurrence = reminder.recurrence || 'once';
    const sentAt = reminder.reminderEmailSentAt ? new Date(reminder.reminderEmailSentAt) : null;

    // ONCE: any past-due reminder we haven't sent yet (reminderEmailSentAt prevents duplicates)
    if (recurrence === 'once') {
        return base.getTime() <= now.getTime() && !sentAt;
    }

    // DAILY: today at same time as scheduledTime has passed, and we haven't sent today
    if (recurrence === 'daily') {
        const todayAtTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), base.getHours(), base.getMinutes(), base.getSeconds(), 0);
        if (todayAtTime.getTime() > now.getTime()) return false;
        if (sentAt && startOfDay(sentAt).getTime() >= startOfDay(now).getTime()) return false;
        return true;
    }

    // WEEKLY: this week's occurrence (same weekday and time) has passed, and we haven't sent for it
    if (recurrence === 'weekly') {
        const targetDow = base.getDay();
        const currentDow = now.getDay();
        const daysOffset = (targetDow - currentDow + 7) % 7;
        const thisWeekOccurrence = new Date(now);
        thisWeekOccurrence.setDate(thisWeekOccurrence.getDate() + daysOffset);
        thisWeekOccurrence.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
        if (thisWeekOccurrence.getTime() > now.getTime()) return false;
        if (sentAt && sentAt.getTime() >= thisWeekOccurrence.getTime()) return false;
        return true;
    }

    return false;
}

/**
 * Get effective scheduled time for the current occurrence (for email body).
 */
function getEffectiveScheduledTime(reminder) {
    const base = new Date(reminder.scheduledTime);
    const recurrence = reminder.recurrence || 'once';
    if (recurrence === 'once') return base;
    const now = new Date();
    if (recurrence === 'daily') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), base.getHours(), base.getMinutes(), base.getSeconds(), 0);
    }
    if (recurrence === 'weekly') {
        const targetDow = base.getDay();
        const currentDow = now.getDay();
        const daysOffset = (targetDow - currentDow + 7) % 7;
        const d = new Date(now);
        d.setDate(d.getDate() + daysOffset);
        d.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
        return d;
    }
    return base;
}

async function runReminderEmailJob() {
    const now = new Date();

    try {
        const reminders = await Reminder.findAll({
            where: { isCompleted: false },
            include: [
                {
                    model: User,
                    required: true,
                    attributes: ['id', 'email', 'name'],
                    include: [
                        {
                            model: Patient,
                            required: true,
                        },
                    ],
                },
            ],
        });

        let sentCount = 0;
        for (const reminder of reminders) {
            const patientUser = reminder.User;
            if (!patientUser) continue;

            const patientProfile = patientUser.Patient;
            if (!patientProfile || patientProfile.reminderNotificationChannel !== 'email') continue;

            if (!patientUser.email || !patientUser.email.trim()) continue;

            if (!isDueAndUnsent(reminder, now)) continue;

            const effectiveTime = getEffectiveScheduledTime(reminder);
            const result = await sendReminderEmail(
                patientUser.email,
                patientUser.name,
                reminder.title,
                reminder.message,
                effectiveTime
            );

            if (result.sent) {
                await reminder.update({ reminderEmailSentAt: new Date() });
                sentCount++;
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Reminder email job: sent reminder ${reminder.id} to ${patientUser.email}`);
                }
            } else if (result.error) {
                console.error(`Reminder email job: failed to send for reminder ${reminder.id}:`, result.error);
            }
        }
        if (sentCount > 0 && process.env.NODE_ENV !== 'production') {
            console.log(`Reminder email job: sent ${sentCount} reminder(s)`);
        }
    } catch (err) {
        console.error('Reminder email job error:', err);
    }
}

let intervalId = null;

function startReminderEmailJob() {
    if (intervalId) return;
    // First run after 30 seconds so DB is ready; then every 2 minutes
    const delay = 30 * 1000;
    setTimeout(() => {
        runReminderEmailJob();
        intervalId = setInterval(runReminderEmailJob, RUN_INTERVAL_MS);
    }, delay);
    console.log('Reminder email job started (first run in 30s, then every 2 min).');
}

function stopReminderEmailJob() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

module.exports = { startReminderEmailJob, stopReminderEmailJob, runReminderEmailJob };
