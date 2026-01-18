import { useEffect, useMemo, useState } from "react";
import { getPatients } from "../services/patients";
import { createReminder, deleteReminder, getRemindersForPatient, updateReminder } from "../services/reminders";
import ReminderFormModal from "../components/ReminderFormModal";
import { Link } from "react-router-dom";
import "./Reminders.css";

export default function Reminders() {
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("");
    const [reminders, setReminders] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // create | edit
    const [editingReminder, setEditingReminder] = useState(null);

    const [toast, setToast] = useState(null); // {type, text}

    const showToast = (type, text) => {
        setToast({ type, text });
        window.setTimeout(() => setToast(null), 3000);
    };

    const load = async (pid) => {
        if (!pid) return;
        setLoading(true);
        setError("");
        try {
            const res = await getRemindersForPatient(pid);
            const list = res?.data?.data ?? res?.data ?? [];
            setReminders(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e?.message || "Unable to load reminders.");
            setReminders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // load patients first (caregiver’s assigned)
        (async () => {
            try {
                const pRes = await getPatients();
                const list = pRes?.data?.patients ?? [];
                setPatients(list);

                // default to first patient
                if (list.length) {
                    const firstId = String(list[0].id);
                    setPatientId(firstId);
                    await load(firstId);
                } else {
                    setLoading(false);
                }
            } catch (e) {
                setError(e?.message || "Unable to load patients.");
                setLoading(false);
            }
        })();
    }, []);

    // reload reminders when patient changes
    useEffect(() => {
        if (patientId) load(patientId);
    }, [patientId]);

    const openCreate = () => {
        setModalMode("create");
        setEditingReminder(null);
        setModalOpen(true);
    };

    const openEdit = (r) => {
        setModalMode("edit");
        setEditingReminder(r);
        setModalOpen(true);
    };

    const handleDelete = async (r) => {
        const ok = window.confirm(`Delete reminder "${r?.title ?? "this reminder"}"?`);
        if (!ok) return;

        try {
            const res = await deleteReminder(r.id);
            showToast("success", res?.data?.message || res?.message || "Reminder deleted.");
            await load(patientId);
        } catch (e) {
            showToast("error", e?.message || "Unable to delete reminder.");
        }
    };

    const onSubmit = async (payload) => {
        // payload already normalized by modal
        try {
            let res;
            if (modalMode === "create") {
                res = await createReminder(payload);
                showToast("success", "Reminder created.");
            } else {
                res = await updateReminder(editingReminder.id, payload);
                showToast("success", res?.data?.message || "Reminder updated.");
            }
            setModalOpen(false);
            await load(patientId); // updates list immediately
            return res;
        } catch (e) {
            showToast("error", e?.message || "Save failed.");
            throw e;
        }
    };

    const selectedPatientName = useMemo(() => {
        const p = patients.find((x) => String(x.id) === String(patientId));
        return p?.name ?? "";
    }, [patients, patientId]);

    return (
        <div className="rm-page">
            <div className="rm-topbar">
                <div>
                    <h1 className="rm-title">Reminder Scheduling</h1>
                    <p className="rm-subtitle">
                        Create, edit and delete reminders with recurrence for patients under your care.
                    </p>
                </div>

                <div className="rm-actions">
                    <button className="rm-btn-primary" onClick={openCreate}>+ Schedule Reminder</button>
                </div>
            </div>

            {toast && (
                <div className={`rm-toast ${toast.type === "error" ? "rm-toast--error" : "rm-toast--success"}`}>
                    {toast.text}
                </div>
            )}

            <div className="rm-panel">
                <div className="rm-panel-head">
                    <div>
                        <div className="rm-panel-title">Reminders</div>
                        <div className="rm-panel-meta">
                            {selectedPatientName ? `Patient: ${selectedPatientName}` : "Select a patient to view reminders"}
                        </div>
                    </div>

                    <select className="rm-select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                        {patients.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                                {p.name} (ID {String(p.id).padStart(3, "0")})
                            </option>
                        ))}
                    </select>
                </div>

                {loading && <div className="rm-state">Loading reminders…</div>}
                {error && <div className="rm-state rm-state--error">{error}</div>}

                {!loading && !error && reminders.length === 0 && (
                    <div className="rm-state">No reminders yet. Click <b>Schedule Reminder</b> to create one.</div>
                )}

                {!loading && !error && reminders.length > 0 && (
                    <div className="rm-list">
                        {reminders.map((r) => (
                            <div className="rm-card" key={r.id}>
                                <div className="rm-card-top">
                                    <div>
                                        <div className="rm-card-title">{r.title}</div>
                                        <div className="rm-card-meta">
                                            {new Date(r.scheduledTime).toLocaleString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            {" • "}{r.reminderType}{" • "}{r.recurrence}
                                        </div>
                                        <div className="rm-card-msg">{r.message}</div>
                                    </div>

                                    <div className="rm-card-actions">
                                        <button className="rm-btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                                        <button className="rm-btn-danger" onClick={() => handleDelete(r)}>Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ReminderFormModal
                open={modalOpen}
                mode={modalMode}
                patientId={patientId ? Number(patientId) : null}
                reminder={editingReminder}
                onClose={() => setModalOpen(false)}
                onSubmit={onSubmit}
            />
        </div>

    );
}