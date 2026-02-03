import { useEffect, useState } from "react";
import DashboardStats from "../components/Dashboard/DashboardStats";
import { getDashboardStats } from "../services/dashboardService";
import { getPatients, getPatientById, archivePatient } from "../services/patients";
import { useNavigate, Link } from "react-router-dom";
import PatientFormModal from "../components/PatientFormModal";
import PatientDetailsModal from "../components/PatientDetailsModal";
import * as patientHelpers from "../utils/patientHelpers";
import "./Dashboard.css";
import "./Patients.css";

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [patients, setPatients] = useState([]);
    const [detailsPatient, setDetailsPatient] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState("create");
    const [formPatient, setFormPatient] = useState(null);

    const refreshPatients = () => {
        getPatients().then((res) => {
            const list = res?.data?.patients ?? [];
            setPatients(list);
            if (stats) setStats((s) => ({ ...s, activePatients: list.length }));
        });
    };

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

    const visiblePatients = patients.slice(0, 3);

    const openDetails = (p) => {
        setDetailsPatient(p);
    };

    const closeDetails = () => {
        setDetailsPatient(null);
    };

    const openEdit = (patient) => {
        const id = patient?.id ?? patient?.patientId;
        if (!id) {
            setFormMode("edit");
            setFormPatient(patient);
            setFormOpen(true);
            return;
        }
        getPatientById(id)
            .then((res) => {
                const full = res?.data?.data?.patient ?? res?.data?.patient;
                setFormMode("edit");
                setFormPatient(full ?? patient);
                setFormOpen(true);
            })
            .catch(() => {
                setFormMode("edit");
                setFormPatient(patient);
                setFormOpen(true);
            });
    };

    const openEditFromDetails = () => {
        if (!detailsPatient) return;
        closeDetails();
        openEdit(detailsPatient);
    };

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
                        <div className="dp-cards-grid">
                            {visiblePatients.map((p) => {
                                const id = p.id ?? p.patientId;
                                const name = p.name ?? "Unnamed patient";
                                const profile = p.Patient ?? p.profile ?? null;
                                const age = patientHelpers.calcAge(profile?.dateOfBirth);
                                const conditions = patientHelpers.getMedicalConditionsDisplay(profile?.medicalHistory ?? profile?.medicalConditions);
                                return (
                                    <div key={id} className="dp-card dp-card-pm">
                                        <div className="dp-card-top">
                                            <div className="dp-card-avatar" style={{ background: patientHelpers.getAvatarColor(id) }}>
                                                {patientHelpers.getInitials(name)}
                                            </div>
                                            <div className="dp-card-head">
                                                <div className="dp-card-name">{name}</div>
                                                <div className="dp-card-badges">
                                                    <span className="dp-card-badge">ID {patientHelpers.format3(id)}</span>
                                                    <span className="dp-card-status dp-card-status-active">
                                                        <span className="dp-card-status-dot" />
                                                        Active
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="dp-card-metrics">
                                            <div className="dp-card-metric">
                                                <div className="dp-card-metric-label">Age</div>
                                                <div className="dp-card-metric-value">{age ?? "—"}</div>
                                            </div>
                                            <div className="dp-card-metric">
                                                <div className="dp-card-metric-label">Conditions</div>
                                                <div className="dp-card-metric-value dp-card-metric-conditions">
                                                    {conditions?.trim() ? conditions : "—"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="dp-card-actions">
                                            <button
                                                type="button"
                                                className="dp-card-btn dp-card-btn-primary"
                                                onClick={() => openDetails(p)}
                                            >
                                                View Details
                                            </button>
                                            <button
                                                type="button"
                                                className="dp-card-btn dp-card-btn-ghost"
                                                onClick={() => openEdit(p)}
                                            >
                                                Edit
                                            </button>
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

            {detailsPatient && (
                <PatientDetailsModal
                    patient={detailsPatient}
                    onClose={closeDetails}
                    onEdit={openEditFromDetails}
                />
            )}

            <PatientFormModal
                open={formOpen}
                mode={formMode}
                patient={formPatient}
                onClose={() => setFormOpen(false)}
                onSaved={() => {
                    refreshPatients();
                    setFormOpen(false);
                }}
                onArchivePatient={archivePatient}
                onArchived={() => {
                    refreshPatients();
                    setFormOpen(false);
                }}
            />

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