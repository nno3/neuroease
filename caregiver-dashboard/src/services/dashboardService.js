import { api } from "./apiClient";

const extractPatients = (res) =>
    res?.data?.data?.patients ??
    res?.data?.patients ??
    res?.data?.data ??
    [];

export const getDashboardStats = async () => {
    try {
        const [activeRes, archivedRes] = await Promise.allSettled([
            api.get("/patients"),
            api.get("/patients/archived"),
        ]);

        const activePatients =
            activeRes.status === "fulfilled" ? extractPatients(activeRes.value).length : 0;

        const archivedPatients =
            archivedRes.status === "fulfilled" ? extractPatients(archivedRes.value).length : 0;

        return {
            activePatients,
            archivedPatients,
            reminderCompliance: 0,
            activeAlerts: 0,
            gamesPlayedToday: 0,
        };
    } catch (e) {
        // don't throw -> prevents "dashboard loading" forever
        return { activePatients: 0, archivedPatients: 0, reminderCompliance: 0, activeAlerts: 0, gamesPlayedToday: 0 };
    }
};
