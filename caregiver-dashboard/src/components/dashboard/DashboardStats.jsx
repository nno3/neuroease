import KPICard from "./KPICard";
import { Users, CheckCircle2, Gamepad2, AlertTriangle } from "lucide-react";

const DashboardStats = ({ stats }) => {
    // robust: supports either stats.activePatients or stats.active, etc.
    const activePatients =
        stats?.activePatients ??
        stats?.active ??
        stats?.data?.activePatients ??
        stats?.data?.active ??
        0;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 30 }}>
            <KPICard
                title="Active Patients"
                value={activePatients}
                icon={<Users size={28} />}
                description="Currently under your care"
                color="#4A90E2"
                iconBg="#E3F2FD"
            />

            <KPICard
                title="Reminder Compliance"
                value={`${stats?.reminderCompliance ?? 0}%`}
                icon={<CheckCircle2 size={28} />}
                description="Medication adherence rate"
                color="#10b981"
                iconBg="#E8F5E9"
            />

            <KPICard
                title="Games Played Today"
                value={stats?.gamesPlayedToday ?? "—"}
                icon={<Gamepad2 size={28} />}
                description="Cognitive engagement"
                color="#f59e0b"
                iconBg="#FFF3E0"
            />

            <KPICard
                title="Active Alerts"
                value={stats?.activeAlerts ?? 0}
                icon={<AlertTriangle size={28} />}
                description="Requiring attention"
                color="#ef4444"
                iconBg="#FFEBEE"
            />
        </div>
    );
};

export default DashboardStats;
