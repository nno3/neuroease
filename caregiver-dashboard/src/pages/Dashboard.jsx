import { useEffect, useState } from 'react';
import DashboardStats from '../components/Dashboard/DashboardStats';
import { getDashboardStats } from '../services/dashboardService';

const Dashboard = () => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        getDashboardStats().then(setStats);
    }, []);

    if (!stats) return <p>Loading dashboard...</p>;

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <h1 style={{
                    margin: 0,
                    fontSize: '30px',
                    fontWeight: '600',
                    color: '#2c3e50'
                }}>
                    Dashboard Overview
                </h1>
                <button style={{
                    padding: '10px 20px',
                    backgroundColor: '#4A90E2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                }}>
                    + Add Patient
                </button>
            </div>

            {/* Alert Banner - From wireframe */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '8px',
                marginBottom: '24px',
                gap: '12px',
                backgroundColor: '#FFF3CD',
                borderLeft: '4px solid #FFC107',
                color: '#856404'
            }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>
                        2 Active Alerts
                    </strong>
                    <p style={{ margin: 0 }}>Margaret Thompson left safe zone • John Smith missed medication</p>
                </div>
                <button style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: 'inherit',
                    opacity: 0.6
                }}>
                    ×
                </button>
            </div>

            {/* Stats */}
            <DashboardStats stats={stats} />

            {/* Patients Section */}
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
                <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    marginBottom: '20px',
                    color: '#2c3e50'
                }}>
                    My Patients
                </h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                }}>
                    {/* Patient cards would go here */}
                    <p style={{ color: '#64748b', fontSize: '14px' }}>
                        Patient cards will be displayed here. Click "Patients" in the sidebar to view all patients.
                    </p>
                </div>
            </div>

            {/* Recent Activity */}
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
                <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    marginBottom: '20px',
                    color: '#2c3e50'
                }}>
                    Recent Activity
                </h3>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {}
                    <p style={{ color: '#64748b', fontSize: '14px' }}>
                        Recent activity will be displayed here.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;