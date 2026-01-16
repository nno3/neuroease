import KPICard from './KPICard';

const IconUsers = (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
            d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11ZM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        />
        <path
            d="M3.5 20c0-2.6 2.7-4.7 6-4.7s6 2.1 6 4.7M13.5 20c0-1.8 1.5-3.3 3.8-4.1 1.8-.6 3.2.1 3.2 4.1"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        />
    </svg>
);

const IconCheck = (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
            d="M20 7 10 17l-5-5"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        />
    </svg>
);

const IconGamepad = (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 6H7a4 4 0 0 0-4 4v8a2 2 0 0 0 2 2h1a2 2 0 0 0 1.6-.8l1.2-1.6a2 2 0 0 1 1.6-.8h2.8a2 2 0 0 1 1.6.8l1.2 1.6A2 2 0 0 0 19 20h1a2 2 0 0 0 2-2v-8a4 4 0 0 0-4-4Z" />
        <path d="M7 12h4" />
        <path d="M9 10v4" />
        <path d="M15 12h.01" />
        <path d="M18 10h.01" />
    </svg>
);


const IconAlert = (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path
            d="M10.3 4.4 2.7 18.3c-.8 1.5.3 3.3 2 3.3h14.6c1.7 0 2.8-1.8 2-3.3L13.7 4.4c-.8-1.5-2.9-1.5-3.4 0Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        />
    </svg>
);

const DashboardStats = ({ stats }) => {
    const activePatients =
        stats?.active ??
        stats?.activePatients ??
        stats?.data?.active ??
        stats?.data?.activePatients ??
        0;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 30 }}>
            <KPICard
                title="Active Patients"
                value={activePatients}
                icon={IconUsers}
                description="Currently under your care"
                color="#4A90E2"
                iconBg="#E3F2FD"
            />

            <KPICard
                title="Reminder Compliance"
                value={`${stats.reminderCompliance}%`}
                icon={IconCheck}
                description="Medication adherence rate"
                color="#10b981"
                iconBg="#E8F5E9"
            />

            <KPICard
                title="Games Played Today"
                value={stats.gamesPlayedToday ?? "—"}
                icon={IconGamepad}
                description="Cognitive engagement"
                color="#f59e0b"
                iconBg="#FFF3E0"
            />

            <KPICard
                title="Active Alerts"
                value={stats.activeAlerts}
                icon={IconAlert}
                description="Requiring attention"
                color="#ef4444"
                iconBg="#FFEBEE"
            />
        </div>
    );
};

export default DashboardStats;
