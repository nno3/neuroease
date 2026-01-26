const { Op } = require('sequelize');
const { User, Reminder, ActivityLog } = require('../models');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 24 * 60 * 60 * 1000;

function isValidDateOnly(str) {
    return typeof str === 'string' && DATE_ONLY_RE.test(str);
}

function parseDateOnly(str, { endOfDay = false } = {}) {
    if (!isValidDateOnly(str)) return null;
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const d = new Date(`${str}T${time}`);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d, n) {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

function dateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function normalizeType(t) {
    return t === 'medication' || t === 'appointment' || t === 'general' ? t : 'general';
}

/**
 * Expand reminder into occurrences in [rangeStart, rangeEnd]
 * - once / daily / weekly
 * - respects endTime (if set)
 * - keeps original hour/min/sec
 */
function forEachOccurrenceInRange(reminder, rangeStart, rangeEnd, fn) {
    const base = new Date(reminder.scheduledTime);
    if (Number.isNaN(base.getTime())) return;

    const recurrence = reminder.recurrence || 'once';

    const reminderEndRaw = reminder.endTime ? new Date(reminder.endTime) : null;
    const reminderEnd =
        reminderEndRaw && !Number.isNaN(reminderEndRaw.getTime()) ? endOfDay(reminderEndRaw) : null;

    const withinEndLimit = (d) => !reminderEnd || d <= reminderEnd;

    // ONCE
    if (recurrence === 'once') {
        if (base >= rangeStart && base <= rangeEnd && withinEndLimit(base)) fn(new Date(base));
        return;
    }

    // DAILY
    if (recurrence === 'daily') {
        let first = new Date(base);

        if (first < rangeStart) {
            const diffDays = Math.floor((startOfDay(rangeStart) - startOfDay(first)) / MS_DAY);
            first.setDate(first.getDate() + diffDays);
            first.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
            if (first < rangeStart) first.setDate(first.getDate() + 1);
        }

        const maxIterations = Math.min(
            5000,
            Math.ceil((startOfDay(rangeEnd) - startOfDay(rangeStart)) / MS_DAY) + 2
        );

        let cur = new Date(first);
        for (let i = 0; i < maxIterations && cur <= rangeEnd; i++) {
            if (!withinEndLimit(cur)) break;
            if (cur >= rangeStart && cur <= rangeEnd) fn(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return;
    }

    // WEEKLY
    if (recurrence === 'weekly') {
        const targetDow = base.getDay();
        let first = new Date(base);

        if (first < rangeStart) {
            const startDow = rangeStart.getDay();
            const offset = (targetDow - startDow + 7) % 7;

            first = new Date(rangeStart);
            first.setDate(first.getDate() + offset);
            first.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
            if (first < rangeStart) first.setDate(first.getDate() + 7);
        }

        const maxIterations = 800;
        let cur = new Date(first);

        for (let i = 0; i < maxIterations && cur <= rangeEnd; i++) {
            if (!withinEndLimit(cur)) break;
            if (cur >= rangeStart && cur <= rangeEnd) fn(new Date(cur));
            cur.setDate(cur.getDate() + 7);
        }
        return;
    }

    // Fallback
    if (base >= rangeStart && base <= rangeEnd && withinEndLimit(base)) fn(new Date(base));
}

/**
 * Status inference WITHOUT activity logs:
 * - completed: only for one-time reminders marked isCompleted
 * - overdue: occurrence time passed
 * - pending: future
 *
 * If ActivityLog exists, it overrides this.
 */
function computeFallbackStatus(reminder, occursAt, now) {
    const recurrence = reminder.recurrence || 'once';
    if (recurrence === 'once' && reminder.isCompleted) return 'completed';
    if (occursAt.getTime() < now.getTime()) return 'overdue';
    return 'pending';
}

function initBreakdown() {
    return {
        medication: { total: 0, completed: 0, pending: 0, overdue: 0 },
        appointment: { total: 0, completed: 0, pending: 0, overdue: 0 },
        general: { total: 0, completed: 0, pending: 0, overdue: 0 },
    };
}

function buildEmptySeries(rangeStart, rangeEnd) {
    const out = [];
    const dayStart = startOfDay(rangeStart);
    const dayEnd = startOfDay(rangeEnd);
    for (let cur = new Date(dayStart); cur <= dayEnd; cur = addDays(cur, 1)) {
        out.push({ date: dateKey(cur), completed: 0, pending: 0, overdue: 0, total: 0 });
    }
    return out;
}

const activityController = {
    /**
     * GET /api/activity/summary?patientId=all|<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    getActivitySummary: async (req, res) => {
        try {
            const patientIdRaw = req.query.patientId ?? 'all';
            const fromRaw = req.query.from;
            const toRaw = req.query.to;

            if (!fromRaw || !toRaw) {
                return res.status(400).json({
                    success: false,
                    message: "Query params 'from' and 'to' are required (YYYY-MM-DD).",
                });
            }

            const rangeStart = parseDateOnly(fromRaw, { endOfDay: false });
            const rangeEnd = parseDateOnly(toRaw, { endOfDay: true });

            if (!rangeStart || !rangeEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format. Use YYYY-MM-DD for 'from' and 'to'.",
                });
            }

            if (rangeStart > rangeEnd) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid range: 'from' cannot be after 'to'.",
                });
            }

            // caregiver + assigned patients
            const caregiver = await User.findByPk(req.user.userId);
            if (!caregiver) return res.status(404).json({ success: false, message: 'Caregiver not found' });

            const assignedPatients = await caregiver.getPatients({
                where: { isArchived: false },
                attributes: ['id'],
            });

            const assignedIds = assignedPatients.map((p) => p.id);

            if (assignedIds.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        patientId: 'all',
                        from: fromRaw,
                        to: toRaw,
                        seriesByDay: buildEmptySeries(rangeStart, rangeEnd),
                        breakdownByType: initBreakdown(),
                        totals: { total: 0, completed: 0, pending: 0, overdue: 0 },
                        meta: { computedFrom: 'reminders', hasActivityLogs: false },
                    },
                });
            }

            // patient filter + assignment check
            let targetIds = assignedIds;

            if (String(patientIdRaw) !== 'all') {
                const pid = parseInt(String(patientIdRaw), 10);
                if (!Number.isFinite(pid)) return res.status(400).json({ success: false, message: 'Invalid patientId' });
                if (!assignedIds.includes(pid)) {
                    return res.status(403).json({ success: false, message: 'Access denied. Patient not assigned to you.' });
                }
                targetIds = [pid];
            }

            // fetch reminders that could have occurrences in range
            const reminders = await Reminder.findAll({
                where: {
                    patientId: { [Op.in]: targetIds },
                    scheduledTime: { [Op.lte]: rangeEnd },
                    [Op.or]: [{ endTime: null }, { endTime: { [Op.gte]: rangeStart } }],
                },
                attributes: ['id', 'patientId', 'title', 'reminderType', 'scheduledTime', 'endTime', 'recurrence', 'isCompleted'],
                order: [['scheduledTime', 'ASC']],
            });

            // series map
            const seriesMap = new Map();
            for (const row of buildEmptySeries(rangeStart, rangeEnd)) seriesMap.set(row.date, row);

            const breakdownByType = initBreakdown();
            const totals = { total: 0, completed: 0, pending: 0, overdue: 0 };
            const now = new Date();

            // OPTIONAL: if ActivityLog exists, prefetch logs for this range (fast override)
            let logsByKey = new Map();
            let hasActivityLogs = false;

            if (ActivityLog) {
                const logs = await ActivityLog.findAll({
                    where: {
                        occursAt: { [Op.between]: [rangeStart, rangeEnd] },
                    },
                    attributes: ['reminderId', 'occursAt', 'status'],
                });

                if (logs.length) hasActivityLogs = true;

                logs.forEach((l) => {
                    const k = `${l.reminderId}|${new Date(l.occursAt).toISOString()}`;
                    logsByKey.set(k, l.status);
                });
            }

            // aggregate occurrences
            reminders.forEach((reminder) => {
                forEachOccurrenceInRange(reminder, rangeStart, rangeEnd, (occursAt) => {
                    const day = dateKey(occursAt);
                    const entry = seriesMap.get(day);
                    if (!entry) return;

                    const logKey = `${reminder.id}|${occursAt.toISOString()}`;
                    const statusFromLog = logsByKey.get(logKey);
                    const status = statusFromLog || computeFallbackStatus(reminder, occursAt, now);

                    entry[status] += 1;
                    entry.total += 1;

                    const t = normalizeType(reminder.reminderType);
                    breakdownByType[t][status] += 1;
                    breakdownByType[t].total += 1;

                    totals[status] += 1;
                    totals.total += 1;
                });
            });

            const seriesByDay = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

            return res.json({
                success: true,
                data: {
                    patientId: String(patientIdRaw ?? 'all'),
                    from: fromRaw,
                    to: toRaw,
                    seriesByDay,
                    breakdownByType,
                    totals,
                    meta: {
                        computedFrom: totals.total ? (hasActivityLogs ? 'activity_logs+reminders' : 'reminders') : 'reminders',
                        hasActivityLogs,
                    },
                },
            });
        } catch (error) {
            console.error('Activity summary error:', error);
            return res.status(500).json({ success: false, message: 'Error generating activity summary' });
        }
    },
};

module.exports = activityController;
