import { api } from "./apiClient";
import { getActivitySummary, getGamesPlayedToday } from "./activityService";

const extractPatients = (res) =>
    res?.data?.data?.patients ??
    res?.data?.patients ??
    res?.data?.data ??
    [];

function todayISODate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export const getDashboardStats = async () => {
    try {
        const today = todayISODate();
        const [activeRes, archivedRes, summaryRes, gamesRes] = await Promise.allSettled([
            api.get("/patients"),
            api.get("/patients/archived"),
            getActivitySummary({ from: today, to: today }),
            getGamesPlayedToday(),
        ]);

        const activePatients =
            activeRes.status === "fulfilled" ? extractPatients(activeRes.value).length : 0;

        const archivedPatients =
            archivedRes.status === "fulfilled" ? extractPatients(archivedRes.value).length : 0;

        let reminderCompliance = 0;
        let remindersTotalToday = 0;
        let remindersCompletedToday = 0;
        let remindersPendingToday = 0;
        let remindersOverdueToday = 0;
        if (summaryRes.status === "fulfilled") {
            const data = summaryRes.value?.data?.data ?? summaryRes.value?.data ?? summaryRes.value;
            const totals = data?.totals ?? {};
            const total = totals.total ?? 0;
            const completed = totals.completed ?? 0;
            reminderCompliance = total > 0 ? Math.round((100 * completed) / total) : 0;
            remindersTotalToday = total;
            remindersCompletedToday = completed;
            remindersPendingToday = totals.pending ?? 0;
            remindersOverdueToday = totals.overdue ?? 0;
        }

        let gamesPlayedToday = 0;
        if (gamesRes.status === "fulfilled") {
            const data = gamesRes.value?.data?.data ?? gamesRes.value?.data ?? gamesRes.value;
            gamesPlayedToday = data?.count ?? 0;
        }

        return {
            activePatients,
            archivedPatients,
            reminderCompliance,
            activeAlerts: 0, // set by Dashboard from location status
            gamesPlayedToday,
            remindersTotalToday,
            remindersCompletedToday,
            remindersPendingToday,
            remindersOverdueToday,
        };
    } catch {
        return {
            activePatients: 0,
            archivedPatients: 0,
            reminderCompliance: 0,
            activeAlerts: 0,
            gamesPlayedToday: 0,
            remindersTotalToday: 0,
            remindersCompletedToday: 0,
            remindersPendingToday: 0,
            remindersOverdueToday: 0,
        };
    }
};
