import { useEffect, useMemo, useRef, useState } from "react";
import { getPatients, getArchivedPatients, archivePatient, unarchivePatient } from "../services/patients";
import "./Patients.css";
import PatientFormModal from "../components/PatientFormModal";

/* helpers */
function calcAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

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

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const AVATAR_COLORS = ["#0066cc", "#2f80ed", "#334155", "#0f766e", "#6d28d9", "#b45309", "#0ea5e9"];
function getAvatarColor(id) {
    const n = Number(id);
    const idx = Number.isFinite(n) ? n % AVATAR_COLORS.length : 0;
    return AVATAR_COLORS[idx];
}
function UsersIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path
                d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11ZM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M3.5 20c0-2.6 2.7-4.7 6-4.7s6 2.1 6 4.7M13.5 20c0-1.8 1.5-3.3 3.8-4.1 1.8-.6 3.2.1 3.2 4.1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function CheckIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path
                d="M20 7 10 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ArchiveIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path
                d="M4 7h16M6 7l1-2h10l1 2M6 7v13h12V7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 11h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}
export default function Patients() {
    // keep lists separate so stats
    const [activePatients, setActivePatients] = useState([]);
    const [archivedPatients, setArchivedPatients] = useState([]);

    const [loadingList, setLoadingList] = useState(true);
    const [errorList, setErrorList] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("active"); // active or archived or all

    // Modal
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    // Restore flow
    const [restoreNotes, setRestoreNotes] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState("create"); // create or edit
    const [formPatient, setFormPatient] = useState(null);

    const [archiveReason, setArchiveReason] = useState("discharged");
    const [archiveNotes, setArchiveNotes] = useState("");


    const [toast, setToast] = useState(null); // { type: "success" | "error", text: string }
    const toastTimerRef = useRef(null);

    const showToast = (type, text) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, text });

        toastTimerRef.current = setTimeout(() => {
            setToast(null);
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const refreshAll = async () => {
        setLoadingList(true);
        setErrorList("");
        try {
            const [activeRes, archivedRes] = await Promise.all([getPatients(), getArchivedPatients()]);
            setActivePatients(activeRes?.data?.patients ?? []);
            setArchivedPatients(archivedRes?.data?.patients ?? []);
        } catch (e) {
            setErrorList(e?.message || "Unable to load patients.");
            setActivePatients([]);
            setArchivedPatients([]);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // correct stats always (not dependent on which tab is open)
    const stats = useMemo(() => {
        const active = activePatients.length;
        const archived = archivedPatients.length;
        const total = active + archived;
        return { active, archived, total };
    }, [activePatients, archivedPatients]);

    // list for current tab
    const baseList = useMemo(() => {
        if (filterStatus === "archived") return archivedPatients;
        if (filterStatus === "all") return [...activePatients, ...archivedPatients];
        return activePatients; // default active
    }, [filterStatus, activePatients, archivedPatients]);

    const filteredPatients = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return baseList.filter((p) => {
            const name = (p.name ?? "").toLowerCase();
            const email = (p.email ?? "").toLowerCase();
            const idStr = format3(p.id);

            return !q || name.includes(q) || email.includes(q) || idStr.includes(q);
        });
    }, [baseList, searchQuery]);

    const openDetails = (p) => {
        setSelectedPatient(p);
        setRestoreNotes("");
        setActionError("");
        setDetailsOpen(true);
        setArchiveReason("discharged");
        setArchiveNotes("");

    };

    const closeDetails = () => {
        setDetailsOpen(false);
        setSelectedPatient(null);
        setRestoreNotes("");
        setActionError("");
        setActionLoading(false);
        setArchiveReason("discharged");
        setArchiveNotes("");

    };

    const handleArchive = async () => {
        if (!selectedPatient?.id) return;

        if (!archiveReason) {
            setActionError("Please select an archive reason.");
            return;
        }

        // If reason is "other", make notes required (so they can explain)
        if (archiveReason === "other" && !archiveNotes?.trim()) {
            setActionError("Please add notes when selecting 'Other'.");
            return;
        }

        const ok = window.confirm(
            `Archive ${selectedPatient?.name ?? "this patient"} for "${archiveReason}"?\n\nYou can restore them later.`
        );
        if (!ok) return;

        setActionLoading(true);
        setActionError("");

        try {
            const res = await archivePatient(selectedPatient.id, {
                archiveReason,
                notes: archiveNotes?.trim() ? archiveNotes.trim() : null,
            });

            showToast("success", res?.message || "Patient archived successfully.");
            await refreshAll();
            closeDetails();
        } catch (e) {
            const msg = e?.message || "Unable to archive patient.";
            showToast("error", msg);
            setActionError(msg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnarchive = async () => {
        if (!selectedPatient?.id) return;

        setActionLoading(true);
        setActionError("");

        try {
            const res = await unarchivePatient(selectedPatient.id, {
                notes: restoreNotes?.trim() ? restoreNotes.trim() : "Reactivated by caregiver",
            });

            showToast("success", res?.message || "Patient restored successfully.");
            await refreshAll();
            closeDetails();
        } catch (e) {
            showToast("error", e?.message || "Unable to restore patient.");
            setActionError(e?.message || "Unable to restore patient.");
        } finally {
            setActionLoading(false);
        }
    };

    const openAdd = () => {
        setFormMode("create");
        setFormPatient(null);
        setFormOpen(true);
    };

    const openEdit = (patient) => {
        setFormMode("edit");
        setFormPatient(patient);
        setFormOpen(true);
    };

    const handleSaved = async ({ patient, message }) => {
        setToast(message);
        await refreshAll();
        window.setTimeout(() => setToast(""), 3000);
    };


    return (
        <div className="pm-page">
            <div className="pm-header">
                <div>
                    <h1 className="pm-title">Patient Management</h1>
                    <p className="pm-subtitle">
                        {stats.active} active patient{stats.active === 1 ? "" : "s"} assigned to your care
                    </p>
                </div>

                <button className="pm-btn pm-btn-primary" type="button" onClick={openAdd}>
                    + Add Patient
                </button>
            </div>

            {toast && (
                <div className={`pm-toast ${toast.type}`}>
                    {toast.text}
                </div>
            )}

            {/* KPI Cards */}
            <div className="pm-kpi-grid">
                <div className="pm-kpi-card">
                    <div className="pm-kpi-icon pm-kpi-icon-blue">
                        <UsersIcon className="pm-kpi-svg"/>
                    </div>
                    <div className="pm-kpi-text">
                        <div className="pm-kpi-value">{stats.total}</div>
                        <div className="pm-kpi-label">Total Patients</div>
                    </div>
                </div>

                <div className="pm-kpi-card">
                    <div className="pm-kpi-icon pm-kpi-icon-green">
                        <CheckIcon className="pm-kpi-svg"/>
                    </div>
                    <div className="pm-kpi-text">
                        <div className="pm-kpi-value">{stats.active}</div>
                        <div className="pm-kpi-label">Active</div>
                    </div>
                </div>

                <div className="pm-kpi-card">
                    <div className="pm-kpi-icon pm-kpi-icon-red">
                        <ArchiveIcon className="pm-kpi-svg"/>
                    </div>
                    <div className="pm-kpi-text">
                        <div className="pm-kpi-value">{stats.archived}</div>
                        <div className="pm-kpi-label">Archived</div>
                    </div>
                </div>
            </div>


            <div className="pm-controls">
                <input
                    className="pm-search"
                    type="text"
                    placeholder="Search by name, email, or ID (e.g., 005)…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="pm-filter">
                    <button
                        type="button"
                        className={`pm-filter-btn ${filterStatus === "all" ? "is-active" : ""}`}
                        onClick={() => setFilterStatus("all")}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        className={`pm-filter-btn ${filterStatus === "active" ? "is-active" : ""}`}
                        onClick={() => setFilterStatus("active")}
                    >
                        Active
                    </button>
                    <button
                        type="button"
                        className={`pm-filter-btn ${filterStatus === "archived" ? "is-active" : ""}`}
                        onClick={() => setFilterStatus("archived")}
                    >
                        Archived
                    </button>

                </div>
            </div>

            {loadingList && <div className="pm-state">Loading patients…</div>}
            {errorList && <div className="pm-state pm-state-error">{errorList}</div>}

            {!loadingList && !errorList && filteredPatients.length === 0 && (
                <div className="pm-empty">
                    <div className="pm-empty-title">No patients found</div>
                    <div className="pm-empty-text">Try adjusting your search or changing the filter.</div>
                </div>
            )}

            {!loadingList && !errorList && filteredPatients.length > 0 && (
                <div className="pm-grid">
                    {filteredPatients.map((p) => {
                        const id = p.id ?? p.patientId;
                        const name = p.name ?? "Unnamed patient";
                        const initials = getInitials(name);
                        const archived = p.isArchived === true;

                        const profile = (p.Patient ?? p.profile) ?? null;
                        const age = calcAge(profile?.dateOfBirth);
                        const conditions = profile?.medicalConditions ?? "";

                        return (
                            <div key={id} className={`pm-card ${archived ? "is-archived" : ""}`}>
                                <div className="pm-card-top">
                                    <div className="pm-avatar" style={{background: getAvatarColor(id)}}>
                                        {initials}
                                    </div>

                                    <div className="pm-card-head">
                                        <div className="pm-card-name">{name}</div>

                                        <div className="pm-card-badges">
                                            <span className="pm-badge">ID {format3(id)}</span>

                                            {/* status pill: green active, red archived */}
                                            <span className={`pm-status ${archived ? "is-archived" : "is-active"}`}>
                        <span className="pm-status-dot"/>
                                                {archived ? "Archived" : "Active"}
                      </span>
                                        </div>
                                    </div>
                                </div>

                                {/* AGE and CONDITIONS always visible */}
                                <div className="pm-metrics">
                                    <div className="pm-metric">
                                        <div className="pm-metric-label">Age</div>
                                        <div className="pm-metric-value">{age ?? "—"}</div>
                                    </div>

                                    <div className="pm-metric">
                                        <div className="pm-metric-label">Conditions</div>
                                        <div className="pm-metric-value pm-metric-conditions">
                                            {conditions?.trim() ? conditions : "—"}
                                        </div>
                                    </div>
                                </div>

                                <div className="pm-actions">
                                    <button className="pm-btn pm-btn-primary" type="button"
                                            onClick={() => openDetails(p)}>
                                        View Details
                                    </button>
                                    <button className="pm-btn pm-btn-ghost" type="button"
                                            onClick={() =>  openEdit(p)}>
                                        Edit
                                    </button>


                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {detailsOpen && selectedPatient && (
                <div className="pm-modal-overlay" onClick={closeDetails} role="presentation">
                    <div className="pm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="pm-modal-header">
                            <div>
                                <div className="pm-modal-title">
                                    {selectedPatient.isArchived ? "Archived Patient" : "Patient Details"}
                                </div>
                                <div className="pm-modal-subtitle">
                                    {selectedPatient.name ?? "Patient"} • ID {format3(selectedPatient.id)}
                                </div>
                            </div>

                            <button className="pm-btn pm-btn-ghost" type="button" onClick={closeDetails}>
                                Close
                            </button>
                        </div>

                        <div className="pm-modal-body">
                            {/* Archived details modal (uses data from /patients/archived list) */}
                            {selectedPatient.isArchived ? (
                                <>
                                    <div className="pm-section">
                                        <div className="pm-row">
                                            <div className="pm-row-label">Added to your care</div>
                                            <div className="pm-row-value">
                                                {formatDate(selectedPatient?.caregiver_patients?.createdAt)}
                                            </div>
                                        </div>
                                        <div className="pm-section-title">Archive Information</div>

                                        <div className="pm-row">
                                            <div className="pm-row-label">Reason</div>
                                            <div className="pm-row-value">{selectedPatient.archiveReason ?? "—"}</div>
                                        </div>

                                        <div className="pm-row">
                                            <div className="pm-row-label">Archived at</div>
                                            <div
                                                className="pm-row-value">{formatDateTime(selectedPatient.archivedAt)}</div>
                                        </div>

                                        <div className="pm-row">
                                            <div className="pm-row-label">Notes</div>
                                            <div className="pm-row-value">{selectedPatient.archiveNotes ?? "—"}</div>
                                        </div>
                                    </div>

                                    <div className="pm-section">
                                        <div className="pm-section-title">Restore Patient</div>

                                        <label className="pm-input-label" htmlFor="restoreNotes">
                                            Restore notes (optional)
                                        </label>
                                        <textarea
                                            id="restoreNotes"
                                            className="pm-textarea"
                                            rows={3}
                                            value={restoreNotes}
                                            onChange={(e) => setRestoreNotes(e.target.value)}
                                            placeholder="e.g., Reactivated by caregiver"
                                        />

                                        {actionError && <div className="pm-inline-error">{actionError}</div>}

                                        <div className="pm-modal-footer">
                                            <button
                                                className="pm-btn pm-btn-primary"
                                                type="button"
                                                onClick={handleUnarchive}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? "Restoring…" : "Restore (Unarchive)"}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Active details modal */
                                (() => {
                                    const profile = (selectedPatient.Patient ?? selectedPatient.profile) ?? null;
                                    const age = calcAge(profile?.dateOfBirth);

                                    return (
                                        <>
                                            <div className="pm-section">
                                                <div className="pm-row">
                                                    <div className="pm-row-label">Added to your care</div>
                                                    <div className="pm-row-value">
                                                        {formatDate(selectedPatient?.caregiver_patients?.createdAt)}
                                                    </div>
                                                </div>
                                                <div className="pm-section-title">Contact Information</div>
                                                <div className="pm-row">
                                                    <div className="pm-row-label">Email</div>
                                                    <div className="pm-row-value">{selectedPatient.email ?? "—"}</div>
                                                </div>
                                                <div className="pm-row">
                                                    <div className="pm-row-label">Emergency contact</div>
                                                    <div
                                                        className="pm-row-value">{profile?.emergencyContact ?? "—"}</div>
                                                </div>
                                            </div>

                                            <div className="pm-section">
                                                <div className="pm-section-title">Personal Information</div>
                                                <div className="pm-row">
                                                    <div className="pm-row-label">Date of birth</div>
                                                    <div
                                                        className="pm-row-value">{formatDate(profile?.dateOfBirth)}</div>
                                                </div>
                                                <div className="pm-row">
                                                    <div className="pm-row-label">Age</div>
                                                    <div className="pm-row-value">{age ?? "—"}</div>
                                                </div>
                                            </div>

                                            <div className="pm-section">
                                                <div className="pm-section-title">Medical Information</div>
                                                <div className="pm-row">
                                                    <div className="pm-row-label">Diagnoses / conditions</div>
                                                    <div
                                                        className="pm-row-value">{profile?.medicalConditions ?? "—"}</div>
                                                </div>
                                            </div>

                                            <div className="pm-section">
                                                <div className="pm-section-title">Archive Patient</div>

                                                <div className="pm-row" style={{alignItems: "center"}}>
                                                    <div className="pm-row-label">Reason</div>

                                                    <div className="pm-row-value" style={{textAlign: "right"}}>
                                                        <select
                                                            className="pm-select"
                                                            value={archiveReason}
                                                            onChange={(e) => setArchiveReason(e.target.value)}
                                                            disabled={actionLoading}
                                                        >
                                                            <option value="discharged">Discharged</option>
                                                            <option value="transferred">Transferred</option>
                                                            <option value="deceased">Deceased</option>
                                                            <option value="inactive">Inactive</option>
                                                            <option value="other">Other</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <label className="pm-input-label" htmlFor="archiveNotes">
                                                    Notes {archiveReason === "other" ? "*" : "(optional)"}
                                                </label>

                                                <textarea
                                                    id="archiveNotes"
                                                    className="pm-textarea"
                                                    rows={3}
                                                    value={archiveNotes}
                                                    onChange={(e) => {
                                                        setArchiveNotes(e.target.value);
                                                        setActionError("");
                                                    }}
                                                    placeholder={archiveReason === "other" ? "Please specify the reason..." : "e.g., Completed care programme"}
                                                    disabled={actionLoading}
                                                />

                                                {archiveReason === "other" && actionError && (
                                                    <div className="pm-inline-error">{actionError}</div>
                                                )}
                                                <div className="pm-modal-footer">
                                                    <button
                                                        className="pm-btn pm-btn-danger"
                                                        type="button"
                                                        onClick={handleArchive}
                                                        disabled={actionLoading}
                                                    >
                                                        {actionLoading ? "Archiving…" : "Archive patient"}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                </div>
            )}
            <PatientFormModal
                open={formOpen}
                mode={formMode}
                patient={formPatient}
                onClose={() => setFormOpen(false)}
                onSaved={({ message }) => {
                    showToast("success", message);
                    refreshAll();
                    setFormOpen(false);
                }}
            />
        </div>
    );
}
