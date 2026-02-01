import { useEffect, useMemo, useRef, useState } from "react";
import { getPatients } from "../services/patients";
import {createReminder, deleteReminder, getRemindersForPatient, updateReminder } from "../services/reminders";
import ReminderFormModal from "../components/ReminderFormModal";
import { Link } from "react-router-dom";
import { format3 } from "../utils/patientHelpers";
import "./Reminders.css";

import {Pill, CalendarDays, ClipboardList, Plus, Trash2, UserRound, Repeat, CheckCircle2, Clock3,} from "lucide-react";
import ReminderCalendar from "../components/ReminderCalendar";

function sameDate(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

const TABS = [
    { label: "All", value: "all" },
    { label: "Medication", value: "medication" },
    { label: "Appointments", value: "appointment" },
    { label: "Tasks", value: "general" },
];
function recurrenceLabel(v) {
    if (v === "daily") return "Daily";
    if (v === "weekly") return "Weekly";
    return "One-time";
}
function typeLabel(v) {
    if (v === "medication") return "Medication";
    if (v === "appointment") return "Appointment";
    return "Task";
}
function formatSchedule(rem) {
    const d = new Date(rem.scheduledTime);
    if (Number.isNaN(d.getTime())) return "—";

    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    // Add end date display if available
    let endInfo = "";
    if (rem.endTime) {
        const endDate = new Date(rem.endTime);
        if (!Number.isNaN(endDate.getTime())) {
            const endDateStr = endDate.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
            endInfo = ` until ${endDateStr}`;
        }
    }

    if (rem.recurrence === "daily") return `Daily at ${time}${endInfo}`;
    if (rem.recurrence === "weekly") {
        const day = d.toLocaleDateString("en-GB", { weekday: "short" });
        return `Weekly on ${day} at ${time}${endInfo}`;
    }
    const date = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    return `${date} at ${time}`;
}
function TypeIcon({ reminderType, size = 18 }) {
    if (reminderType === "medication") return <Pill size={size} />;
    if (reminderType === "appointment") return <CalendarDays size={size} />;
    return <ClipboardList size={size} />;
}
function safeDate(v) {
    if (v === null || v === undefined || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function doesReminderOccurOnDate(reminder, targetDate) {
    const reminderDate = new Date(reminder.scheduledTime);
    if (Number.isNaN(reminderDate.getTime())) return false;

    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const targetEnd = endOfDay(targetDate);

    const endRaw = safeDate(reminder.endTime);
    const endInclusive = endRaw ? endOfDay(endRaw) : null;

    // If there is an end date and the selected day is after it -> doesn't occur
    if (endInclusive && targetStart > endInclusive) return false;

    const recur = reminder.recurrence || "once";

    if (recur === "once") {
        return reminderDate >= targetStart && reminderDate <= targetEnd;
    }

    if (recur === "daily") {
        const startDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
        return targetStart >= startDay;
    }

    if (recur === "weekly") {
        const startDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
        return targetStart >= startDay && reminderDate.getDay() === targetDate.getDay();
    }

    return false;
}

export default function Reminders() {
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("all"); // "all" or "123"
    const [reminders, setReminders] = useState([]);
    const [tab, setTab] = useState("all");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // create | edit
    const [editingReminder, setEditingReminder] = useState(null);
    const [prefillDate, setPrefillDate] = useState(null); // Date used when creating from calendar

    const [toast, setToast] = useState(null); // { type, text }
    const toastRef = useRef(null);
    // Calendar navigation
    const [calendarRefDate, setCalendarRefDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const showToast = (type, text) => {
        if (toastRef.current) clearTimeout(toastRef.current);
        setToast({ type, text });
        toastRef.current = setTimeout(() => setToast(null), 3000);
    };
    useEffect(() => {
        return () => {
            if (toastRef.current) clearTimeout(toastRef.current);
        };
    }, []);

    const normalizeReminders = (res) => {
        const list = res?.data?.data ?? res?.data ?? [];
        return Array.isArray(list) ? list : [];
    };

    const loadForPatient = async (pid, patientName) => {
        if (!pid) return;
        setLoading(true);
        setError("");
        try {
            const res = await getRemindersForPatient(pid);
            const list = normalizeReminders(res).map((r) => ({
                ...r,
                patientId: Number(pid),
                patientName: patientName ?? "",
            }));
            list.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
            setReminders(list);
        } catch (e) {
            setError(e?.message || "Unable to load reminders.");
            setReminders([]);
        } finally {
            setLoading(false);
        }
    };
    const loadAllPatients = async (patientsList) => {
        if (!patientsList?.length) {
            setReminders([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const results = await Promise.allSettled(
                patientsList.map(async (p) => {
                    const res = await getRemindersForPatient(p.id);
                    return normalizeReminders(res).map((r) => ({
                        ...r,
                        patientId: p.id,
                        patientName: p.name,
                    }));
                })
            );

            const merged = results
                .filter((x) => x.status === "fulfilled")
                .flatMap((x) => x.value);
            merged.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
            setReminders(merged);
        } catch (e) {
            setError(e?.message || "Unable to load reminders.");
            setReminders([]);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        (async () => {
            try {
                const pRes = await getPatients();
                const list = pRes?.data?.patients ?? [];
                setPatients(list);

                setPatientId("all");
                await loadAllPatients(list);
            } catch (e) {
                setError(e?.message || "Unable to load patients.");
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!patients.length) return;

        if (patientId === "all") {
            loadAllPatients(patients);
        } else {
            const p = patients.find((x) => String(x.id) === String(patientId));
            loadForPatient(patientId, p?.name);
        }
    }, [patientId, patients]);

    const openCreate = (date = null) => {
        setModalMode("create");
        setEditingReminder(null);
        setPrefillDate(date);
        setModalOpen(true);
    };

    const openEdit = (r) => {
        setModalMode("edit");
        setEditingReminder(r);
        setPrefillDate(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setPrefillDate(null);
    };
    const handleDelete = async (r) => {
        const ok = window.confirm(`Delete reminder "${r?.title ?? "this reminder"}"?`);
        if (!ok) return;

        try {
            const res = await deleteReminder(r.id);
            showToast("success", res?.data?.message || res?.message || "Reminder deleted successfully.");
            if (patientId === "all") await loadAllPatients(patients);
            else await loadForPatient(patientId, patients.find((x) => String(x.id) === String(patientId))?.name);
        } catch (e) {
            showToast("error", e?.message || "Unable to delete reminder.");
        }
    };

    const onSubmit = async (payload) => {
        try {
            let res;
            if (modalMode === "create") {
                res = await createReminder(payload);
                showToast("success", "Reminder created successfully.");
            } else {
                res = await updateReminder(editingReminder.id, payload);
                showToast("success", "Reminder updated successfully.");
            }
            closeModal();
            if (patientId === "all") await loadAllPatients(patients);
            else await loadForPatient(patientId, patients.find((x) => String(x.id) === String(patientId))?.name);
            return res;
        } catch (e) {
            showToast("error", e?.message || "Save failed.");
            throw e;
        }
    };

    const selectedPatientName = useMemo(() => {
        if (patientId === "all") return "All patients";
        const p = patients.find((x) => String(x.id) === String(patientId));
        return p?.name ?? "";
    }, [patients, patientId]);

    const visibleReminders = useMemo(() => {
        let filtered = reminders;

        // Filter by tab
        if (tab !== "all") {
            filtered = filtered.filter((r) => r.reminderType === tab);
        }

        // Filter by selected date if one is chosen
        if (selectedDate) {
            filtered = filtered.filter((r) => {
                return doesReminderOccurOnDate(r, selectedDate);
            });
        }

        return filtered;
    }, [reminders, tab, selectedDate]);




    return (
        <div className="rm-page">
            <div className="rm-topbar">
                <div>
                    <h1 className="rm-title">Reminder Scheduling</h1>
                    <p className="rm-subtitle">
                        Schedule reminders for patients under your care. Use the calendar to plan and review.
                    </p>
                </div>

                <div className="rm-actions">
                    <Link className="rm-link" to="/patients">
                        Manage patients
                    </Link>

                    <button className="rm-btn-primary" onClick={() => openCreate(null)} type="button">
                        <Plus size={16} />
                        <span>Schedule reminder</span>
                    </button>
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
                        <div className="rm-panel-title">Calendar</div>
                        <div className="rm-panel-meta">
                            {selectedPatientName ? `Patient: ${selectedPatientName}` : "Select a patient to view reminders"}
                            {patientId === "all" && <span className="rm-panel-hint"> • Filter by patient to focus the calendar</span>}
                        </div>
                    </div>

                    <select className="rm-select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                        <option value="all">All patients</option>
                        {patients.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                                {p.name} (ID {format3(p.id)})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="rm-filter">
                    {TABS.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            className={`rm-filter-btn ${tab === t.value ? "is-active" : ""}`}
                            onClick={() => setTab(t.value)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {loading && <div className="rm-state">Loading reminders…</div>}
                {error && <div className="rm-state rm-state--error">{error}</div>}
                {!loading && !error && (
                    <div className="rm-splitview">
                        <div className="rm-calendar-section">
                            <ReminderCalendar
                                reminders={tab === "all" ? reminders : reminders.filter((r) => r.reminderType === tab)}
                                referenceDate={calendarRefDate}
                                onChangeReferenceDate={setCalendarRefDate}
                                showPatient={patientId === "all"}
                                selectedDate={selectedDate}
                                onSelectDate={setSelectedDate}
                                onCreateAt={(date) => openCreate(date)}
                                onOpenReminder={(reminder) => openEdit(reminder)}
                            />
                        </div>

                        <div className="rm-schedule-section">
                            <div className="rm-schedule-head">
                                <div className="rm-schedule-title">
                                    {selectedDate
                                        ? selectedDate.toLocaleDateString("en-GB", {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric"
                                        })
                                        : "Select a date to view schedule"}
                                </div>

                                {selectedDate && (
                                    <button
                                        className="rm-clear-btn"
                                        type="button"
                                        onClick={() => setSelectedDate(null)}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            <div className={"rm-schedule-subtitle"}>
                                 Scheduled Reminders
                            </div>
                            {visibleReminders.length === 0 ? (
                                <div className="rm-state">
                                    {selectedDate
                                        ? "No reminders scheduled for this date."
                                        : "Select a date on the calendar to view scheduled reminders."}
                                </div>
                            ) : (
                                <div className="rm-schedule-list">
                                    {visibleReminders.map((r) => {
                                        const isCompleted = r.isCompleted === true;

                                        return (
                                            <div className="rm-schedule-card" key={r.id}>
                                                <div className="rm-schedule-left">
                                                    <div className={`rm-iconbox rm-iconbox--${r.reminderType}`}>
                                                        <TypeIcon reminderType={r.reminderType}/>
                                                    </div>
                                                </div>

                                                <div className="rm-schedule-main">
                                                    <div className="rm-schedule-card-title">{r.title}</div>

                                                    <div className="rm-lines">
                                                        {(patientId === "all" || selectedDate) && (
                                                            <div className="rm-line">
                                                                <UserRound size={14}/>
                                                                <span className="rm-line-label">Patient:</span>
                                                                <span className="rm-line-value">
                                                                    {r.patientName
                                                                        ? `${r.patientName} (ID ${format3(r.patientId)})`
                                                                        : selectedPatientName && patientId !== "all"
                                                                            ? `${selectedPatientName} (ID ${format3(patientId)})`
                                                                            : "—"}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="rm-line">
                                                            <Clock3 size={14}/>
                                                            <span className="rm-line-label">Time:</span>
                                                            <span className="rm-line-value">{formatSchedule(r)}</span>
                                                        </div>

                                                        <div className="rm-line">
                                                            <Repeat size={14}/>
                                                            <span className="rm-line-label">Recurrence:</span>
                                                            <span
                                                                className="rm-pill">{recurrenceLabel(r.recurrence)}</span>
                                                            <span
                                                                className="rm-muted">({typeLabel(r.reminderType)})</span>
                                                        </div>
                                                        <div className="rm-line">
                                                            <CalendarDays size={14}/>
                                                            <span className="rm-line-label">Duration:</span>
                                                            <span className="rm-line-value">{r.endTime ? `Until ${new Date(r.endTime).toLocaleDateString("en-GB", {day: "2-digit", month: "short", year: "numeric"})}` : "No end date"}</span>
                                                        </div>

                                                        <div className="rm-line">
                                                            <CheckCircle2 size={14}/>
                                                            <span className="rm-line-label">Status:</span>
                                                            <span
                                                                className={`rm-status ${isCompleted ? "is-complete" : "is-pending"}`}>
                                                                {isCompleted ? "Completed" : "Pending"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {r.message && <div className="rm-card-msg">{r.message}</div>}
                                                </div>

                                                <div className="rm-card-actions">
                                                    <button className="rm-actionbtn" type="button"
                                                            onClick={() => openEdit(r)}>
                                                        Edit
                                                    </button>

                                                    <button
                                                        className="rm-iconbtn rm-iconbtn--danger"
                                                        type="button"
                                                        onClick={() => handleDelete(r)}
                                                        aria-label="Delete"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18}/>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <ReminderFormModal
                open={modalOpen}
                mode={modalMode}
                patientId={patientId === "all" ? null : Number(patientId)}
                patients={patients}
                reminder={editingReminder}
                prefillDate={prefillDate}
                onClose={closeModal}
                onSubmit={onSubmit}
            />
        </div>
    );
}