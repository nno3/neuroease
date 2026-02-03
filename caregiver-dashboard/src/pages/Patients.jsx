import { useEffect, useMemo, useRef, useState } from "react";
import { getPatients, getArchivedPatients, getPatientById, archivePatient, unarchivePatient } from "../services/patients";
import "./Patients.css";
import PatientFormModal from "../components/PatientFormModal";
import PatientDetailsModal from "../components/PatientDetailsModal";
import { useSearchParams } from "react-router-dom";
import { ArchiveIcon, UsersIcon, CheckIcon } from "lucide-react";
import {
    calcAge,
    format3,
    getAvatarColor,
    getInitials,
    getMedicalConditionsDisplay,
} from "../utils/patientHelpers";

export default function Patients() {
    const [activePatients, setActivePatients] = useState([]);
    const [archivedPatients, setArchivedPatients] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [errorList, setErrorList] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("active");

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState("create");
    const [formPatient, setFormPatient] = useState(null);


    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const showToast = (type, text) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, text });

        toastTimerRef.current = setTimeout(() => {
            setToast(null);
        }, 3000);
    };

    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const add = searchParams.get("add");
        const detailsId = searchParams.get("details");
        const editId = searchParams.get("edit");

        if (add === "1") {
            setFormMode("create");
            setFormPatient(null);
            setFormOpen(true);
            const next = new URLSearchParams(searchParams);
            next.delete("add");
            setSearchParams(next, { replace: true });
            return;
        }

        if (detailsId) {
            const next = new URLSearchParams(searchParams);
            next.delete("details");
            setSearchParams(next, { replace: true });
            getPatientById(detailsId)
                .then((res) => {
                    const p = res?.data?.data?.patient ?? res?.data?.patient;
                    if (p) {
                        setSelectedPatient(p);
                        setRestoreNotes("");
                        setActionError("");
                        setDetailsOpen(true);
                    }
                })
                .catch(() => {});
            return;
        }

        if (editId) {
            const next = new URLSearchParams(searchParams);
            next.delete("edit");
            setSearchParams(next, { replace: true });
            getPatientById(editId)
                .then((res) => {
                    const full = res?.data?.data?.patient ?? res?.data?.patient;
                    setFormMode("edit");
                    setFormPatient(full ?? null);
                    setFormOpen(true);
                })
                .catch(() => {
                    setFormMode("edit");
                    setFormPatient({ id: editId });
                    setFormOpen(true);
                });
        }
    }, [searchParams, setSearchParams]);

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
    }, []);

    const stats = useMemo(() => {
        const active = activePatients.length;
        const archived = archivedPatients.length;
        const total = active + archived;
        return { active, archived, total };
    }, [activePatients, archivedPatients]);

    const baseList = useMemo(() => {
        if (filterStatus === "archived") return archivedPatients;
        if (filterStatus === "all") return [...activePatients, ...archivedPatients];
        return activePatients;
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
        setDetailsOpen(true);
    };

    const openEditFromDetails = () => {
        if (!selectedPatient) return;
        closeDetails();
        openEdit(selectedPatient);
    };

    const closeDetails = () => {
        setDetailsOpen(false);
        setSelectedPatient(null);
    };

    const handleUnarchiveFromModal = async (patientId, notes) => {
        const res = await unarchivePatient(patientId, {
            notes: notes?.trim() ? notes.trim() : "Reactivated by caregiver",
        });
            showToast("success", res?.message || "Patient restored successfully.");
            await refreshAll();
            closeDetails();
    };

    const openAdd = () => {
        setFormMode("create");
        setFormPatient(null);
        setFormOpen(true);
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
                        <CheckIcon className="pm-kpi-svg"></CheckIcon>
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

                        // medicalHistory is the single source; fallback to medicalConditions summary for card text
                        const conditions = getMedicalConditionsDisplay(profile?.medicalHistory ?? profile?.medicalConditions);

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
                                            <span className={`pm-status ${archived ? "is-archived" : "is-active"}`}>
                                                <span className="pm-status-dot"/>
                                                {archived ? "Archived" : "Active"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

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
                                            onClick={() => openEdit(p)}>
                                        Edit
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {detailsOpen && selectedPatient && (
                <PatientDetailsModal
                    patient={selectedPatient}
                    onClose={closeDetails}
                    onEdit={openEditFromDetails}
                    onUnarchive={handleUnarchiveFromModal}
                />
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
                onArchivePatient={archivePatient}
                onArchived={() => {
                    showToast("success", "Patient archived successfully.");
                    refreshAll();
                    setFormOpen(false);
                }}
            />
        </div>
    );
}