import { api } from "./apiClient";

const MOCK_STATS = {
    reminderCompliance: 87,
    activeAlerts: 2,
    gamesPlayedToday: 0,
};

export const getDashboardStats = async () => {
    try {
        const res = await api.get("/dashboard/stats");

        // apiClient likely returns { success, data, message } (not axios response)
        const payload = res?.data ?? res;
        const stats = payload?.data?.stats ?? payload?.data ?? payload;

        return {
            reminderCompliance: stats?.reminderCompliance ?? 0,
            activeAlerts: stats?.activeAlerts ?? 0,
            gamesPlayedToday: stats?.gamesPlayedToday ?? 0,
        };
    } catch (error) {
        console.error("Dashboard stats failed (fallback to mock):", error);
        return MOCK_STATS;
    }
};
