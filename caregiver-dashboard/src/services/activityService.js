import { api } from "./apiClient";

/**
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 * @param {string} [patientId=all]
 * @param {string} [type=all]
 */
export function getActivitySummary({ from, to, patientId = "all", type = "all" } = {}) {
    const params = new URLSearchParams({ from, to, patientId, type });
    return api.get(`/activity/summary?${params.toString()}`);
}

/**
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 * @param {number} [limit=25]
 * @param {number} [page=1]
 * @param {string} [patientId=all]
 * @param {string} [type=all]
 */
export function getActivityLog({ from, to, limit = 25, page = 1, patientId = "all", type = "all" } = {}) {
    const params = new URLSearchParams({ from, to, limit: String(limit), page: String(page), patientId, type });
    return api.get(`/activity/log?${params.toString()}`);
}

export function getGamesPlayedToday() {
    return api.get("/activity/games-today");
}

/**
 * Recent game sessions for dashboard activity feed.
 * @param {number} [limit=20]
 * @param {number} [patientId] - If provided, filter to this patient only.
 */
export function getRecentGameSessions(limit = 20, patientId) {
    const params = new URLSearchParams({ limit: String(Math.max(1, Math.min(50, limit))) });
    if (patientId != null) params.set("patientId", String(patientId));
    return api.get(`/activity/recent-games?${params.toString()}`);
}

/**
 * Game sessions chart-ready summary aggregated by day and game type.
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 * @param {string} [patientId=all]
 */
export function getGamesSummary({ from, to, patientId = "all" } = {}) {
    const params = new URLSearchParams({ from, to, patientId });
    return api.get(`/activity/games-summary?${params.toString()}`);
}

/**
 * Per-patient activity summary for today (reminders, games, last active).
 * @param {number} [patientId] - If provided, return only this patient's summary.
 */
export function getPatientActivitySummaries(patientId) {
    const params = patientId != null ? `?patientId=${patientId}` : "";
    return api.get(`/activity/patient-summaries${params}`);
}
