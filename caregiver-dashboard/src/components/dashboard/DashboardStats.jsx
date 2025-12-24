import KPICard from './KPICard';

const DashboardStats = ({ stats }) => {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
        }}>
            <KPICard
                title="Active Patients"
                value={stats.activePatients}
                icon="👥"
                description="Currently under your care"
                color="#4A90E2"
                iconBg="#E3F2FD"
            />
            <KPICard
                title="Reminder Compliance"
                value={`${stats.reminderCompliance}%`}
                icon="✅"
                description="Medication adherence rate"
                color="#10b981"
                iconBg="#E8F5E9"
            />
            <KPICard
                title="Games Played Today"
                value="23"
                icon="🎮"
                description="Cognitive engagement"
                color="#f59e0b"
                iconBg="#FFF3E0"
            />
            <KPICard
                title="Active Alerts"
                value={stats.activeAlerts}
                icon="⚠️"
                description="Requiring attention"
                color="#ef4444"
                iconBg="#FFEBEE"
            />
        </div>
    );
};

export default DashboardStats;