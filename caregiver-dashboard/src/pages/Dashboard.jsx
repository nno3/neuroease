import { useEffect, useState } from "react";
import ActivitySummaryVisual from "../components/dashboard/ActivitySummaryVisual";
import { getDashboardStats } from "../services/dashboardService";
import { getLocationStatusForCaregiver } from "../services/locationService";
import { getPatients, getPatientById, archivePatient, sendInvite } from "../services/patients";
import { useNavigate, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import PatientFormModal from "../components/PatientFormModal";
import PatientDetailsModal from "../components/PatientDetailsModal";
import PatientActivityModal from "../components/PatientActivityModal";
import * as patientHelpers from "../utils/patientHelpers";
import "./Dashboard.css";
import "./Patients.css";

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [patients, setPatients] = useState([]);
    const [locationAlerts, setLocationAlerts] = useState([]);
    const [currentlyOutside, setCurrentlyOutside] = useState([]);
    const [alertBannerDismissed, setAlertBannerDismissed] = useState(false);
    const [detailsPatient, setDetailsPatient] = useState(null);
    const [activityModalPatient, setActivityModalPatient] = useState(null);
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
        Promise.allSettled([
            getPatients(),
            getDashboardStats(),
            getLocationStatusForCaregiver(),
        ]).then(([patientsRes, statsRes, statusRes]) => {
            const activeList =
                patientsRes.status === "fulfilled" ? (patientsRes.value?.data?.patients ?? []) : [];

            const otherStats =
                statsRes.status === "fulfilled"
                    ? statsRes.value
                    : { reminderCompliance: 0, activeAlerts: 0, gamesPlayedToday: 0 };

            const data = statusRes.status === "fulfilled"
                ? statusRes.value?.data?.data ?? statusRes.value?.data ?? {}
                : {};
            const alertList = Array.isArray(data.alerts) ? data.alerts : [];
            const outsideList = Array.isArray(data.currentlyOutside) ? data.currentlyOutside : [];

            setPatients(activeList);
            setLocationAlerts(alertList);
            setCurrentlyOutside(outsideList);

            const alertPatientIds = new Set(alertList.map((a) => a.patientId));
            outsideList.forEach((o) => alertPatientIds.add(o.patientId));
            const activeAlertsCount = alertPatientIds.size;

            setStats({
                ...otherStats,
                activePatients: activeList.length,
                activeAlerts: activeAlertsCount,
            });
        });
    }, []);

    const visiblePatients = patients.slice(0, 3);

    const openActivityModal = (patient) => {
        setActivityModalPatient(patient);
    };

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

            {/* Active location alerts banner (breach events + currently outside) */}
            {(locationAlerts.length > 0 || currentlyOutside.length > 0) && !alertBannerDismissed && (
                <div className="dp-alert-banner">
                    <AlertTriangle size={24} className="dp-alert-banner-icon" aria-hidden />
                    <div className="dp-alert-banner-content">
                        <strong className="dp-alert-banner-title">
                            {locationAlerts.length + currentlyOutside.length} active location alert
                            {locationAlerts.length + currentlyOutside.length !== 1 ? "s" : ""}
                        </strong>
                        <p className="dp-alert-banner-text">
                            {[
                                ...currentlyOutside.slice(0, 5).map((o) => {
                                    const time = o.timestamp
                                        ? new Date(o.timestamp).toLocaleString(undefined, {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        })
                                        : "";
                                    return `${o.patientName ?? "Patient"} currently outside safe zone${time ? ` (${time})` : ""}`;
                                }),
                                ...locationAlerts.slice(0, 5).map((a) => {
                                    const time = a.timestamp
                                        ? new Date(a.timestamp).toLocaleString(undefined, {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        })
                                        : "";
                                    return `${a.patientName ?? "Patient"} left safe zone${time ? ` at ${time}` : ""}`;
                                }),
                            ]
                                .slice(0, 5)
                                .join(" • ")}
                            {(currentlyOutside.length + locationAlerts.length) > 5 &&
                                ` • +${currentlyOutside.length + locationAlerts.length - 5} more`}
                        </p>
                        <Link to="/location" className="dp-alert-banner-link">
                            View on Location page →
                        </Link>
                    </div>
                    <button
                        type="button"
                        className="dp-alert-banner-dismiss"
                        onClick={() => setAlertBannerDismissed(true)}
                        aria-label="Dismiss alert banner"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Today at a glance — interactive summary (replaces top KPI row) */}
            <div className="dp-panel">
                <div className="dp-header">
                    <div>
                        <h3 className="dp-title">Today at a glance</h3>
                        <p className="dp-subtitle">Patients, reminders, games, and location — tap a card to see more</p>
                    </div>
                </div>
                <ActivitySummaryVisual stats={stats} activeAlerts={stats?.activeAlerts ?? 0} />
            </div>

            {/* My Patients section */}

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
                    onOpenActivity={() => {
                        closeDetails();
                        openActivityModal(detailsPatient);
                    }}
                    onResendInvite={async (id) => {
                        const res = await sendInvite(id);
                        return res?.data;
                    }}
                />
            )}

            {activityModalPatient && (
                <PatientActivityModal
                    patient={activityModalPatient}
                    onClose={() => setActivityModalPatient(null)}
                    onViewDetails={() => openDetails(activityModalPatient)}
                />
            )}

            <PatientFormModal
                open={formOpen}
                mode={formMode}
                patient={formPatient}
                onClose={() => setFormOpen(false)}
                onSaved={({ inviteLink, patient }) => {
                    if (inviteLink) {
                        alert(`Patient created. Copy this activate link to open in the patient app:\n\n${inviteLink}`);
                    }
                    if (patient) {
                        setPatients((prev) => prev.map((p) => (p.id === patient.id ? patient : p)));
                    } else {
                        refreshPatients();
                    }
                    setFormOpen(false);
                }}
                onArchivePatient={archivePatient}
                onArchived={() => {
                    refreshPatients();
                    setFormOpen(false);
                }}
            />
        </div>
    );
};

export default Dashboard;