/**
 * Reminder notification job – runs every 2 min. Finds reminders that are due (and not completed),
 * sends email or in-app push per patient preference. Sends initial at due time (reminderEmailSentAt).
 * If still incomplete 15 minutes after due, sends one overdue follow-up (overdueNotificationSentAt).
 */
const { Reminder, Patient, User, PushSubscription } = require('../models');
const { sendReminderEmail } = require('../utils/emailService');
const { sendPush, configureVapid } = require('../utils/pushService');

const RUN_INTERVAL_MS = 2 * 60 * 1000; // run every 2 minutes so we catch due reminders sooner

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const OVERDUE_MINUTES = 15;

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
 * Returns true if we already sent the initial notification for this occurrence, it's been at least
 * OVERDUE_MINUTES since the occurrence, and we haven't sent the overdue follow-up for this occurrence.
 */
function isOverdueAndUnsent(reminder, now) {
    const effectiveTime = getEffectiveScheduledTime(reminder);
    if (Number.isNaN(effectiveTime.getTime())) return false;
    const overdueAt = new Date(effectiveTime.getTime() + OVERDUE_MINUTES * 60 * 1000);
    if (overdueAt.getTime() > now.getTime()) return false; // not yet 15 min past due
    if (!reminder.reminderEmailSentAt) return false; // never sent initial
    const sentAt = new Date(reminder.reminderEmailSentAt);
    const recurrence = reminder.recurrence || 'once';
    // For once: initial must have been sent (we have reminderEmailSentAt) and we haven't sent overdue
    if (recurrence === 'once') {
        return !reminder.overdueNotificationSentAt;
    }
    // For daily/weekly: we haven't sent overdue for this occurrence (overdueNotificationSentAt is null or before this occurrence)
    const overdueSentAt = reminder.overdueNotificationSentAt ? new Date(reminder.overdueNotificationSentAt) : null;
    return !overdueSentAt || overdueSentAt.getTime() < effectiveTime.getTime();
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
        const isDev = process.env.NODE_ENV !== 'production';
        for (const reminder of reminders) {
            const patientUser = reminder.User;
            if (!patientUser) continue;

            const patientProfile = patientUser.Patient;
            const channel = patientProfile?.reminderNotificationChannel;
            if (!channel || channel === 'none') {
                if (isDev && reminder.isCompleted === false) {
                    console.log(`Reminder job: reminder ${reminder.id} skipped – channel is '${channel || 'missing'}' (user ${patientUser.id})`);
                }
                continue;
            }

            const due = isDueAndUnsent(reminder, now);
            if (isDev) {
                const scheduled = new Date(reminder.scheduledTime);
                console.log(`Reminder job: reminder ${reminder.id} scheduled=${scheduled.toISOString()} now=${now.toISOString()} due=${due} channel=${channel}`);
            }
            if (!due) continue;

            const effectiveTime = getEffectiveScheduledTime(reminder);
            const title = reminder.title || 'Reminder';
            const body = reminder.message || `Scheduled for ${effectiveTime.toLocaleString()}`;

            const channelLower = (channel || '').toLowerCase();
            if (channelLower === 'email') {
                if (!patientUser.email || !patientUser.email.trim()) continue;
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
                        console.log(`Reminder job: sent email for reminder ${reminder.id} to ${patientUser.email}`);
                    }
                } else if (result.error) {
                    console.error(`Reminder job: email failed for reminder ${reminder.id}:`, result.error);
                }
            } else if (channelLower === 'push') {
                const subs = await PushSubscription.findAll({ where: { userId: patientUser.id } });
                if (subs.length === 0) {
                    console.warn(`Reminder job: reminder ${reminder.id} – user ${patientUser.id} has push selected but no push subscription. Re-select In-app push in the app Profile.`);
                    continue;
                }
                if (!configureVapid()) {
                    console.warn(`Reminder job: reminder ${reminder.id} – VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.`);
                    continue;
                }
                let anySent = false;
                for (const sub of subs) {
                    const result = await sendPush(sub, { title, body });
                    if (result.sent) {
                        anySent = true;
                        if (process.env.NODE_ENV !== 'production') {
                            console.log(`Reminder job: sent push for reminder ${reminder.id} to user ${patientUser.id}`);
                        }
                    } else if (result.error) {
                        console.error(`Reminder job: push failed for reminder ${reminder.id} user ${patientUser.id}:`, result.error);
                    }
                }
                if (anySent) {
                    await reminder.update({ reminderEmailSentAt: new Date() });
                    sentCount++;
                }
            }
        }

        // Second pass: overdue follow-up (15 min after due, if still incomplete and we sent initial)
        for (const reminder of reminders) {
            const patientUser = reminder.User;
            if (!patientUser) continue;
            const patientProfile = patientUser.Patient;
            const channel = patientProfile?.reminderNotificationChannel;
            if (!channel || channel === 'none') continue;
            if (!isOverdueAndUnsent(reminder, now)) continue;

            const effectiveTime = getEffectiveScheduledTime(reminder);
            const overdueTitle = `Overdue: ${reminder.title || 'Reminder'}`;
            const overdueBody = reminder.message
                ? `This reminder was due at ${effectiveTime.toLocaleString()} and is still incomplete. ${reminder.message}`
                : `This reminder was due at ${effectiveTime.toLocaleString()} and is still incomplete.`;

            if (channel === 'email') {
                if (!patientUser.email || !patientUser.email.trim()) continue;
                const result = await sendReminderEmail(
                    patientUser.email,
                    patientUser.name,
                    overdueTitle,
                    overdueBody,
                    effectiveTime
                );
                if (result.sent) {
                    await reminder.update({ overdueNotificationSentAt: new Date() });
                    sentCount++;
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Reminder job: sent overdue email for reminder ${reminder.id} to ${patientUser.email}`);
                    }
                } else if (result.error) {
                    console.error(`Reminder job: overdue email failed for reminder ${reminder.id}:`, result.error);
                }
            } else if ((channel || '').toLowerCase() === 'push') {
                const subs = await PushSubscription.findAll({ where: { userId: patientUser.id } });
                if (subs.length === 0) {
                    console.warn(`Reminder job: overdue reminder ${reminder.id} – user ${patientUser.id} has no push subscription.`);
                    continue;
                }
                if (!configureVapid()) {
                    console.warn(`Reminder job: overdue reminder ${reminder.id} – VAPID keys not configured.`);
                    continue;
                }
                let anySent = false;
                for (const sub of subs) {
                    const result = await sendPush(sub, { title: overdueTitle, body: overdueBody });
                    if (result.sent) {
                        anySent = true;
                        if (process.env.NODE_ENV !== 'production') {
                            console.log(`Reminder job: sent overdue push for reminder ${reminder.id} to user ${patientUser.id}`);
                        }
                    } else if (result.error) {
                        console.error(`Reminder job: overdue push failed for reminder ${reminder.id}:`, result.error);
                    }
                }
                if (anySent) {
                    await reminder.update({ overdueNotificationSentAt: new Date() });
                    sentCount++;
                }
            }
        }
        if (sentCount > 0 && process.env.NODE_ENV !== 'production') {
            console.log(`Reminder job: sent ${sentCount} notification(s)`);
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
    const pushReady = !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
    console.log('Reminder job started (first run in 30s, then every 2 min). Web push: ' + (pushReady ? 'configured' : 'not configured (set VAPID keys for in-app push).'));
}

function stopReminderEmailJob() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

module.exports = { startReminderEmailJob, stopReminderEmailJob, runReminderEmailJob };
