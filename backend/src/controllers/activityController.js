/**
 * Activity controller – summary (chart-ready aggregates) and log (paginated occurrences).
 * Summary: expands each reminder into occurrences in the date range (once/daily/weekly, respecting
 * endTime), then counts by day and type. Status comes from ActivityLog if present, else inferred
 * (overdue/pending/completed). Date query params accept YYYY-MM-DD or DD/MM/YYYY.
 */
const { Op } = require('sequelize');
const { User, Reminder, ActivityLog, GameSession } = require('../models');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 24 * 60 * 60 * 1000;

function isValidDateOnly(str) {
    return typeof str === 'string' && DATE_ONLY_RE.test(str);
}

/** Parse date string (YYYY-MM-DD or DD/MM/YYYY) to Date; endOfDay sets time to 23:59:59.999 */
function parseDateOnly(str, { endOfDay = false } = {}) {
    if (!str || typeof str !== 'string') return null;
    let dateStr = str.trim();

    // Prefer YYYY-MM-DD (API standard)
    if (DATE_ONLY_RE.test(dateStr)) {
        const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
        const d = new Date(`${dateStr}T${time}`);
        if (!Number.isNaN(d.getTime())) {
            return d;
        }
    }

    // DD/MM/YYYY (e.g. from frontend date picker display)
    const ddMmYyyyRe = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (ddMmYyyyRe.test(dateStr)) {
        const parts = dateStr.split('/');
        const isoStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
        const d = new Date(`${isoStr}T${time}`);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
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
 * Expand a single reminder into all its occurrence timestamps within [rangeStart, rangeEnd].
 * - once: at most one (scheduledTime) if it falls in range and before endTime.
 * - daily: same time each day; stops at endTime or rangeEnd; cap 5000 iterations.
 * - weekly: same weekday and time each week; same end/range rules; cap 800.
 * Used by getActivitySummary to count completed/pending/overdue per day for charts.
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
     * GET /api/activity/summary?patientId=all|<id>&type=all|medication|appointment|general&from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    getActivitySummary: async (req, res) => {
        try {
            const patientIdRaw = req.query.patientId ?? 'all';
            const fromRaw = req.query.from;
            const typeRaw = req.query.type ?? 'all';
            const allowedTypes = new Set(['all', 'medication', 'appointment', 'general']);

            if (!allowedTypes.has(String(typeRaw))) {
                return res.status(400).json({ success: false, message: 'Invalid type' });
            }

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
            const where = {
                patientId: { [Op.in]: targetIds },
                scheduledTime: { [Op.lte]: rangeEnd },
                [Op.or]: [{ endTime: null }, { endTime: { [Op.gte]: rangeStart } }],
            };

            if (String(typeRaw) !== 'all') {
                where.reminderType = String(typeRaw);
            }

            const reminders = await Reminder.findAll({
                where,
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

    /**
     * GET /api/activity/log?patientId=all|<id>&type=all|medication|appointment|general&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=25
     */
    getActivityLog: async (req, res) => {
        try {
            const patientIdRaw = req.query.patientId ?? "all";
            const typeRaw = req.query.type ?? "all";
            const fromRaw = req.query.from;
            const toRaw = req.query.to;

            const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));

            const allowedTypes = new Set(["all", "medication", "appointment", "general"]);
            if (!allowedTypes.has(String(typeRaw))) {
                return res.status(400).json({ success: false, message: "Invalid type" });
            }

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
            if (!caregiver) return res.status(404).json({ success: false, message: "Caregiver not found" });

            const assignedPatients = await caregiver.getPatients({
                where: { isArchived: false },
                attributes: ["id", "name"],
            });

            const assignedIds = assignedPatients.map((p) => p.id);
            const patientNameById = new Map(assignedPatients.map((p) => [p.id, p.name]));

            if (assignedIds.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        patientId: "all",
                        type: String(typeRaw),
                        from: fromRaw,
                        to: toRaw,
                        page,
                        limit,
                        total: 0,
                        totalPages: 0,
                        hasMore: false,
                        items: [],
                        meta: { computedFrom: "reminders", hasActivityLogs: false },
                    },
                });
            }

            // patient filter + assignment check
            let targetIds = assignedIds;
            if (String(patientIdRaw) !== "all") {
                const pid = parseInt(String(patientIdRaw), 10);
                if (!Number.isFinite(pid)) return res.status(400).json({ success: false, message: "Invalid patientId" });
                if (!assignedIds.includes(pid)) {
                    return res.status(403).json({ success: false, message: "Access denied. Patient not assigned to you." });
                }
                targetIds = [pid];
            }

            // fetch reminders that could have occurrences in range
            const where = {
                patientId: { [Op.in]: targetIds },
                scheduledTime: { [Op.lte]: rangeEnd },
                [Op.or]: [{ endTime: null }, { endTime: { [Op.gte]: rangeStart } }],
            };
            if (String(typeRaw) !== "all") where.reminderType = String(typeRaw);

            const reminders = await Reminder.findAll({
                where,
                attributes: ["id", "patientId", "title", "reminderType", "scheduledTime", "endTime", "recurrence", "isCompleted"],
                order: [["scheduledTime", "ASC"]],
            });

            // Optional ActivityLog override (same idea as summary)
            let logsByKey = new Map();
            let hasActivityLogs = false;

            if (ActivityLog) {
                const logs = await ActivityLog.findAll({
                    where: { occursAt: { [Op.between]: [rangeStart, rangeEnd] } },
                    attributes: ["reminderId", "occursAt", "status"],
                });

                if (logs.length) hasActivityLogs = true;

                logs.forEach((l) => {
                    const k = `${l.reminderId}|${new Date(l.occursAt).toISOString()}`;
                    logsByKey.set(k, l.status);
                });
            }

            const now = new Date();
            const items = [];

            reminders.forEach((reminder) => {
                forEachOccurrenceInRange(reminder, rangeStart, rangeEnd, (occursAt) => {
                    const logKey = `${reminder.id}|${occursAt.toISOString()}`;
                    const statusFromLog = logsByKey.get(logKey);
                    const status = statusFromLog || computeFallbackStatus(reminder, occursAt, now);

                    const actionType =
                        status === "completed"
                            ? "Reminder completed"
                            : status === "overdue"
                                ? "Reminder overdue"
                                : "Reminder scheduled";

                    items.push({
                        timestamp: occursAt.toISOString(),
                        patientId: reminder.patientId,
                        patientName: patientNameById.get(reminder.patientId) || `Patient ${reminder.patientId}`,
                        actionType,
                        status, // completed | pending | overdue
                        details: {
                            reminderId: reminder.id,
                            title: reminder.title,
                            reminderType: normalizeType(reminder.reminderType),
                            recurrence: reminder.recurrence || "once",
                        },
                    });
                });
            });

            // newest-first
            items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const total = items.length;
            const totalPages = Math.ceil(total / limit);
            const start = (page - 1) * limit;
            const pageItems = items.slice(start, start + limit);

            return res.json({
                success: true,
                data: {
                    patientId: String(patientIdRaw),
                    type: String(typeRaw),
                    from: fromRaw,
                    to: toRaw,
                    page,
                    limit,
                    total,
                    totalPages,
                    hasMore: page < totalPages,
                    items: pageItems,
                    meta: {
                        computedFrom: hasActivityLogs ? "activity_logs+reminders" : "reminders",
                        hasActivityLogs,
                    },
                },
            });
        } catch (error) {
            console.error("Activity log error:", error);
            return res.status(500).json({ success: false, message: "Error generating activity log" });
        }
    },

    /**
     * GET /api/activity/games-today
     * Returns count of game sessions played today by the caregiver's assigned (non-archived) patients.
     */
    getGamesPlayedToday: async (req, res) => {
        try {
            const caregiver = await User.findByPk(req.user.userId);
            if (!caregiver) return res.status(404).json({ success: false, message: "Caregiver not found" });

            const assignedPatients = await caregiver.getPatients({
                where: { isArchived: false },
                attributes: ["id"],
            });
            const assignedIds = assignedPatients.map((p) => p.id);
            if (assignedIds.length === 0) {
                return res.json({ success: true, data: { count: 0 } });
            }

            const now = new Date();
            const todayStart = startOfDay(now);
            const todayEnd = endOfDay(now);

            const count = await GameSession.count({
                where: {
                    patientId: { [Op.in]: assignedIds },
                    playedAt: { [Op.between]: [todayStart, todayEnd] },
                },
            });

            return res.json({ success: true, data: { count } });
        } catch (error) {
            console.error("Games played today error:", error);
            return res.status(500).json({ success: false, message: "Error fetching games count" });
        }
    },

    /**
     * GET /api/activity/patient-summaries?patientId=optional
     * Returns per-patient activity summary for today: reminders (total/completed/pending/overdue), games played today, lastActive.
     */
    getPatientSummaries: async (req, res) => {
        try {
            const caregiver = await User.findByPk(req.user.userId);
            if (!caregiver) return res.status(404).json({ success: false, message: 'Caregiver not found' });

            const assignedPatients = await caregiver.getPatients({
                where: { isArchived: false },
                attributes: ['id', 'name'],
            });
            const assignedIds = assignedPatients.map((p) => p.id);
            const patientNameById = new Map(assignedPatients.map((p) => [p.id, p.name]));

            if (assignedIds.length === 0) {
                return res.json({ success: true, data: { summaries: [] } });
            }

            const patientIdFilter = req.query.patientId;
            let targetIds = assignedIds;
            if (patientIdFilter) {
                const pid = parseInt(String(patientIdFilter), 10);
                if (!Number.isFinite(pid) || !assignedIds.includes(pid)) {
                    return res.status(400).json({ success: false, message: 'Invalid or unauthorized patientId' });
                }
                targetIds = [pid];
            }

            const now = new Date();
            const todayStart = startOfDay(now);
            const todayEnd = endOfDay(now);
            const fromRaw = dateKey(todayStart);
            const toRaw = dateKey(todayEnd);

            const where = {
                patientId: { [Op.in]: targetIds },
                scheduledTime: { [Op.lte]: todayEnd },
                [Op.or]: [{ endTime: null }, { endTime: { [Op.gte]: todayStart } }],
            };
            const reminders = await Reminder.findAll({
                where,
                attributes: ['id', 'patientId', 'scheduledTime', 'endTime', 'recurrence', 'isCompleted'],
            });

            let logsByKey = new Map();
            if (ActivityLog) {
                const logs = await ActivityLog.findAll({
                    where: { occursAt: { [Op.between]: [todayStart, todayEnd] } },
                    attributes: ['reminderId', 'occursAt', 'status'],
                });
                logs.forEach((l) => {
                    const k = `${l.reminderId}|${new Date(l.occursAt).toISOString()}`;
                    logsByKey.set(k, l.status);
                });
            }

            const reminderCountsByPatient = new Map();
            targetIds.forEach((id) => {
                reminderCountsByPatient.set(id, { total: 0, completed: 0, pending: 0, overdue: 0 });
            });

            reminders.forEach((reminder) => {
                forEachOccurrenceInRange(reminder, todayStart, todayEnd, (occursAt) => {
                    const pid = reminder.patientId;
                    if (!reminderCountsByPatient.has(pid)) return;
                    const counts = reminderCountsByPatient.get(pid);
                    counts.total += 1;
                    const logKey = `${reminder.id}|${occursAt.toISOString()}`;
                    const statusFromLog = logsByKey.get(logKey);
                    const status = statusFromLog || computeFallbackStatus(reminder, occursAt, now);
                    if (status === 'completed') counts.completed += 1;
                    else if (status === 'overdue') counts.overdue += 1;
                    else counts.pending += 1;
                });
            });

            const gameCountByPatient = new Map();
            const lastActiveByPatient = new Map();
            targetIds.forEach((id) => {
                gameCountByPatient.set(id, 0);
                lastActiveByPatient.set(id, null);
            });
            const sessions = await GameSession.findAll({
                where: { patientId: { [Op.in]: targetIds } },
                attributes: ['patientId', 'playedAt'],
                order: [['playedAt', 'DESC']],
            });
            sessions.forEach((s) => {
                const pid = s.patientId;
                const d = new Date(s.playedAt);
                if (d >= todayStart && d <= todayEnd) {
                    gameCountByPatient.set(pid, (gameCountByPatient.get(pid) || 0) + 1);
                }
                const current = lastActiveByPatient.get(pid);
                if (!current || d > new Date(current)) lastActiveByPatient.set(pid, s.playedAt);
            });

            const summaries = targetIds.map((pid) => {
                const reminderCounts = reminderCountsByPatient.get(pid) || { total: 0, completed: 0, pending: 0, overdue: 0 };
                return {
                    patientId: pid,
                    patientName: patientNameById.get(pid) || `Patient ${pid}`,
                    remindersToday: reminderCounts,
                    gamesPlayedToday: gameCountByPatient.get(pid) || 0,
                    lastActive: lastActiveByPatient.get(pid) ? new Date(lastActiveByPatient.get(pid)).toISOString() : null,
                    hasOverdue: (reminderCounts.overdue || 0) > 0,
                };
            });

            return res.json({ success: true, data: { summaries, date: fromRaw } });
        } catch (error) {
            console.error('Patient summaries error:', error);
            return res.status(500).json({ success: false, message: 'Error fetching patient summaries' });
        }
    },

    /**
     * GET /api/activity/recent-games?limit=20
     * Returns recent game sessions for caregiver's assigned patients (for dashboard activity feed).
     */
    getRecentGameSessions: async (req, res) => {
        try {
            const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
            const caregiver = await User.findByPk(req.user.userId);
            if (!caregiver) return res.status(404).json({ success: false, message: "Caregiver not found" });

            const assignedPatients = await caregiver.getPatients({
                where: { isArchived: false },
                attributes: ["id", "name"],
            });
            const assignedIds = assignedPatients.map((p) => p.id);
            const patientNameById = new Map(assignedPatients.map((p) => [p.id, p.name]));

            if (assignedIds.length === 0) {
                return res.json({ success: true, data: { items: [] } });
            }

            const sessions = await GameSession.findAll({
                where: { patientId: { [Op.in]: assignedIds } },
                order: [["playedAt", "DESC"]],
                limit,
                attributes: ["id", "patientId", "gameType", "score", "duration", "accuracy", "playedAt"],
            });

            const items = sessions.map((s) => ({
                timestamp: s.playedAt,
                patientId: s.patientId,
                patientName: patientNameById.get(s.patientId) || `Patient ${s.patientId}`,
                activityType: "game",
                gameType: s.gameType,
                score: s.score,
                duration: s.duration,
                accuracy: s.accuracy != null ? s.accuracy : null,
            }));

            return res.json({ success: true, data: { items } });
        } catch (error) {
            console.error("Recent game sessions error:", error);
            return res.status(500).json({ success: false, message: "Error fetching recent games" });
        }
    },
};

module.exports = activityController;
