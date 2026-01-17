import { useEffect, useState } from "react";
import DashboardStats from "../components/Dashboard/DashboardStats";
import { getDashboardStats } from "../services/dashboardService";
import { getPatients } from "../services/patients";
import { Link, useNavigate } from "react-router-dom";
import "./Dashboard.css";

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [patients, setPatients] = useState([]);

    useEffect(() => {
        Promise.allSettled([getPatients(), getDashboardStats()]).then(([patientsRes, statsRes]) => {
            const activeList =
                patientsRes.status === "fulfilled" ? (patientsRes.value?.data?.patients ?? []) : [];

            const otherStats =
                statsRes.status === "fulfilled"
                    ? statsRes.value
                    : { reminderCompliance: 0, activeAlerts: 0, gamesPlayedToday: 0 };

            setPatients(activeList);

            setStats({
                ...otherStats,
                activePatients: activeList.length,
            });
        });
    }, []);


    function getInitials(name = "") {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "P";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function format3(id) {
        if (id === null || id === undefined) return "000";
        return String(id).padStart(3, "0");
    }

    const visiblePatients = patients.slice(0, 4);

    if (!stats) return <p>Loading dashboard...</p>;

    return (
        <div style={{padding: "24px"}}>
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
                <button
                    onClick={() => navigate("/patients?add=1")}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#4A90E2",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                    }}
                >
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
                <span style={{fontSize: '24px'}}>⚠️</span>
                <div style={{flex: 1}}>
                    <strong style={{display: 'block', marginBottom: '4px'}}>
                        2 Active Alerts
                    </strong>
                    <p style={{margin: 0}}>Margaret Thompson left safe zone • John Smith missed medication</p>
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
            <DashboardStats stats={stats}/>

            {/* My Patients section (now real, consistent) */}

            <div className="dp-panel">
                <div className="dp-header">
                    <div>
                        <h3 className="dp-title">My Patients</h3>
                        <p className="dp-subtitle">Quick view of patients currently under your care</p>
                    </div>

                    <Link className="dp-viewall" to="/patients">
                        View all
                    </Link>
                    {/* If not using react-router:<a className="dp-viewall" href="/patients">View all</a>*/}
                </div>

                {patients.length === 0 ? (
                    <div className="dp-empty">
                        <div className="dp-empty-title">No active patients yet</div>
                        <div className="dp-empty-text">Add a patient to begin monitoring and managing care.</div>

                        <Link className="dp-empty-cta" to="/patients">
                            Go to Patients
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="dp-grid">
                            {visiblePatients.map((p) => {
                                const conditions = p?.Patient?.medicalConditions?.trim() || "";
                                return (
                                    <div key={p.id} className="dp-card">
                                        <div className="dp-card-top">
                                            <div className="dp-avatar">{getInitials(p.name)}</div>
                                            <div className="dp-head">
                                                <div className="dp-name">{p.name}</div>
                                                <div className="dp-id">ID {format3(p.id)}</div>
                                            </div>
                                        </div>

                                        <div className="dp-row">
                                            <span className="dp-label">Conditions</span>
                                            <span className={`dp-value ${conditions ? "" : "is-muted"}`}>{conditions || "—"}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="dp-footer">
                        <span className="dp-footnote">
                            Showing {visiblePatients.length} of {patients.length}.
                        </span>
                            <Link className="dp-footer-link" to="/patients">
                                Manage patients →
                            </Link>
                        </div>
                    </>
                )}
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
                    <p style={{color: '#64748b', fontSize: '14px'}}>
                        Recent activity will be displayed here.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;