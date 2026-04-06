import React from 'react';
import { useEffect, useMemo, useState, forwardRef } from "react";
import "./ReminderFormModal.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, X } from "lucide-react";

const TYPES = [
    { label: "Medication", value: "medication" },
    { label: "Appointment", value: "appointment" },
    // UI says "task", backend expects "general"
    { label: "Task", value: "general" },
];

const RECURRENCE = [
    { label: "Once", value: "once" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
];

function parseISODateTime(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Custom input (typed input + calendar button) like Patient Management */
const DateTimeInputWithButton = forwardRef(
    ({ value, onClick, placeholder, className, disabled }, ref) => (
        <div className={`rfm-datewrap ${disabled ? "is-disabled" : ""}`}>
            <input
                ref={ref}
                className={className}
                value={value || ""}
                onClick={onClick}
                readOnly // keeps react-datepicker stable; users still pick via calendar/time selector
                placeholder={placeholder}
                disabled={disabled}
            />
            <button
                type="button"
                className="rfm-calbtn"
                onClick={onClick}
                disabled={disabled}
                aria-label="Open calendar"
                title="Open calendar"
            >
                <Calendar size={18} />
            </button>
        </div>
    )
);
DateTimeInputWithButton.displayName = "DateTimeInputWithButton";

function parseMedicationsFromPatient(patient) {
    if (!patient) return [];
    const profile = patient?.Patient ?? patient?.profile ?? null;
    const mh = profile?.medicalHistory;
    if (!mh) return [];
    try {
        const parsed = typeof mh === "string" ? JSON.parse(mh || "{}") : mh;
        if (Array.isArray(parsed?.medications) && parsed.medications.length > 0) {
            return parsed.medications.filter((m) => (m?.name ?? "").trim());
        }
        const legacy = (parsed?.currentMedications ?? "").trim();
        if (legacy) {
            return legacy.split("\n").map((line) => ({ name: line.trim(), dosage: "", frequency: "" })).filter((m) => m.name);
        }
    } catch {}
    return [];
}

export default function ReminderFormModal({ open, mode, patientId, patients = [], reminder, prefillDate = null, onClose, onSubmit }) {
    const isEdit = mode === "edit";

    const initial = useMemo(() => {
        const fromReminder = reminder?.scheduledTime ? new Date(reminder.scheduledTime) : null;
        const fromPrefill = prefillDate ? new Date(prefillDate) : null;
        const scheduledAt = isEdit ? fromReminder : (fromPrefill || fromReminder);
        const safeScheduledAt = scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null;

        // Add end time logic
        const fromReminderEnd = reminder?.endTime ? new Date(reminder.endTime) : null;
        const safeEndAt = fromReminderEnd && !Number.isNaN(fromReminderEnd.getTime()) ? fromReminderEnd : null;

        // If editing a "once" recurrence that has an endTime, clear it
        const shouldClearEndTime = reminder?.recurrence === "once" && safeEndAt;

        return {
            title: reminder?.title ?? "",
            message: reminder?.message ?? "",
            reminderType: reminder?.reminderType ?? "general",
            selectedMedicationId: "",
            recurrence: reminder?.recurrence ?? "once",
            scheduledAt: safeScheduledAt,
            endAt: shouldClearEndTime ? null : safeEndAt, // Clear end time for "once" recurrence
            pickedPatientId: reminder?.patientId ? String(reminder.patientId) : "",
        };
    }, [reminder, prefillDate, isEdit]);

    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [pickedPatientId, setPickedPatientId] = useState(initial.pickedPatientId);

    const effectivePatientId = patientId ?? pickedPatientId;
    const selectedPatient = patients.find((p) => String(p.id) === String(effectivePatientId));
    const medications = useMemo(() => parseMedicationsFromPatient(selectedPatient), [selectedPatient]);

    useEffect(() => {
        if (open) {
            setForm(initial);
            setPickedPatientId(initial.pickedPatientId);
            setSaving(false);
            setError("");
            setFieldErrors({});
        }
    }, [open, initial]);

    if (!open) return null;

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const resolvePatientId = () => {
        const pid = patientId ?? pickedPatientId;
        return pid ? Number(pid) : null;
    };

    const validate = () => {
        const errs = {};
        const pid = resolvePatientId();

        if (!pid) errs.patientId = "Please select a patient.";
        if (!form.title.trim()) errs.title = "Title is required.";
        if (!form.message.trim()) errs.message = "Message is required.";
        if (!form.reminderType) errs.reminderType = "Type is required.";

        if (!form.scheduledAt) errs.scheduledAt = "Scheduled date/time is required.";
        else if (form.scheduledAt.getTime() < Date.now() - 60_000) {
            errs.scheduledAt = "Scheduled time cannot be in the past.";
        }

        if (!form.recurrence) errs.recurrence = "Recurrence is required.";

        // Add end date validation
        if (form.endAt) {
            // For recurring reminders, end date must be after or equal to start date
            if (form.recurrence !== "once" && form.endAt < form.scheduledAt) {
                errs.endAt = "End date must be after start date.";
            }
            // For one-time reminders, end date doesn't make sense
            if (form.recurrence === "once") {
                errs.endAt = "End date is not applicable for one-time reminders.";
            }
        }

        return errs;
    };

    const handleSave = async () => {
        setError("");
        const errs = validate();
        setFieldErrors(errs);
        if (Object.keys(errs).length) {
            setError("Please fix the highlighted fields.");
            return;
        }
        const pid = resolvePatientId();

        const payload = {
            patientId: pid,
            title: form.title.trim(),
            message: form.message.trim(),
            reminderType: form.reminderType,
            scheduledTime: form.scheduledAt.toISOString(),
            recurrence: form.recurrence,
        };

        // Only add endTime for recurring reminders (not for "once")
        if (form.recurrence !== "once" && form.endAt) {
            payload.endTime = form.endAt.toISOString();
        }

        setSaving(true);
        try {
            await onSubmit(payload);
        } catch (e) {
            setError(e?.message || (isEdit ? "Unable to update reminder." : "Unable to create reminder."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rfm-overlay" onClick={onClose} role="presentation">
            <div className="rfm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="rfm-header">
                    <div>
                        <div className="rfm-title">{isEdit ? "Edit reminder" : "Schedule reminder"}</div>
                        <div className="rfm-subtitle">
                            {isEdit ? "Update the reminder details." : "Create a reminder with recurrence."}
                        </div>
                    </div>

                    <button className="rfm-close" onClick={onClose} type="button" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="rfm-body">
                    {error && <div className="rfm-error">{error}</div>}

                    <div className="rfm-grid">
                        {/* Patient selector ONLY when patientId not provided (All patients view) */}
                        {!patientId && (
                            <div className="rfm-field">
                                <label className="rfm-label">Patient *</label>
                                <select
                                    className={`rfm-select ${fieldErrors.patientId ? "is-error" : ""}`}
                                    value={pickedPatientId}
                                    onChange={(e) => {
                                        setPickedPatientId(e.target.value);
                                        setFieldErrors((prev) => ({ ...prev, patientId: undefined }));
                                    }}
                                >
                                    <option value="">Select a patient…</option>
                                    {patients.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} (ID {String(p.id).padStart(3, "0")})
                                        </option>
                                    ))}
                                </select>
                                {fieldErrors.patientId && <div className="rfm-help">{fieldErrors.patientId}</div>}
                            </div>
                        )}

                        {form.reminderType === "medication" && medications.length > 0 && (
                            <div className="rfm-field">
                                <label className="rfm-label">Select medication</label>
                                <select
                                    className="rfm-select"
                                    value={form.selectedMedicationId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setField("selectedMedicationId", val);
                                        if (val && val !== "custom") {
                                            const idx = parseInt(val, 10);
                                            const med = medications[idx];
                                            if (med) {
                                                const parts = [med.name];
                                                if (med.dosage) parts.push(med.dosage);
                                                if (med.frequency) parts.push(med.frequency);
                                                setField("title", parts.join(" – "));
                                                setField("message", `Take ${med.name}${med.dosage ? ` (${med.dosage})` : ""}${med.frequency ? ` ${med.frequency}` : ""}`);
                                            }
                                        }
                                    }}
                                >
                                    <option value="">Choose a medication…</option>
                                    {medications.map((med, idx) => {
                                        const label = [med.name, med.dosage, med.frequency].filter(Boolean).join(" – ");
                                        return (
                                            <option key={idx} value={String(idx)}>
                                                {label || med.name}
                                            </option>
                                        );
                                    })}
                                    <option value="custom">Other (type below)</option>
                                </select>
                            </div>
                        )}

                        <div className="rfm-field">
                            <label className="rfm-label">Title *</label>
                            <input
                                className={`rfm-input ${fieldErrors.title ? "is-error" : ""}`}
                                value={form.title}
                                onChange={(e) => {
                                    setField("title", e.target.value);
                                    if (form.reminderType === "medication" && medications.length > 0) {
                                        setField("selectedMedicationId", "custom");
                                    }
                                }}
                            />
                            {fieldErrors.title && <div className="rfm-help">{fieldErrors.title}</div>}
                        </div>

                        <div className="rfm-field">
                            <label className="rfm-label">Type *</label>
                            <select
                                className={`rfm-select ${fieldErrors.reminderType ? "is-error" : ""}`}
                                value={form.reminderType}
                                onChange={(e) => setField("reminderType", e.target.value)}
                            >
                                {TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                            {fieldErrors.reminderType && <div className="rfm-help">{fieldErrors.reminderType}</div>}
                        </div>

                        <div className="rfm-field rfm-span2">
                            <label className="rfm-label">Message *</label>
                            <textarea
                                className={`rfm-textarea ${fieldErrors.message ? "is-error" : ""}`}
                                rows={4}
                                value={form.message}
                                onChange={(e) => setField("message", e.target.value)}
                            />
                            {fieldErrors.message && <div className="rfm-help">{fieldErrors.message}</div>}
                        </div>

                        <div className="rfm-field">
                            <label className="rfm-label">Scheduled date/time *</label>
                            <DatePicker
                                selected={form.scheduledAt}
                                onChange={(date) => {
                                    setField("scheduledAt", date);
                                    // If end date exists and is now before the new start date, clear it
                                    if (form.endAt && form.endAt < date) {
                                        setField("endAt", null);
                                    }
                                    setFieldErrors((prev) => ({ ...prev, scheduledAt: undefined }));
                                }}
                                showTimeSelect
                                timeIntervals={1}
                                timeCaption="Time"
                                dateFormat="dd/MM/yyyy h:mm aa"
                                placeholderText="DD/MM/YYYY hh:mm"
                                showMonthDropdown
                                showYearDropdown
                                scrollableYearDropdown
                                yearDropdownItemNumber={15}
                                minDate={new Date()} // blocks past days; validation blocks past times
                                customInput={
                                    <DateTimeInputWithButton
                                        className={`rfm-input ${fieldErrors.scheduledAt ? "is-error" : ""}`}
                                    />
                                }
                            />
                            {fieldErrors.scheduledAt && <div className="rfm-help">{fieldErrors.scheduledAt}</div>}
                        </div>

                        <div className="rfm-field">
                            <label className="rfm-label">Recurrence *</label>
                            <select
                                className={`rfm-select ${fieldErrors.recurrence ? "is-error" : ""}`}
                                value={form.recurrence}
                                onChange={(e) => {
                                    setField("recurrence", e.target.value);
                                    // If recurrence is "once", clear end date
                                    if (e.target.value === "once") {
                                        setField("endAt", null);
                                    }
                                    setFieldErrors((prev) => ({ ...prev, recurrence: undefined, endAt: undefined }));
                                }}
                            >
                                {RECURRENCE.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>

                            {form.recurrence === "weekly" && (
                                <div className="rfm-help-muted">
                                    Weekly repeats on the same weekday as the scheduled time.
                                </div>
                            )}

                            {fieldErrors.recurrence && <div className="rfm-help">{fieldErrors.recurrence}</div>}
                        </div>

                        <div className="rfm-field">
                            <label className="rfm-label">
                                End date/time {form.recurrence !== "once" ? "(optional)" : ""}
                            </label>
                            <DatePicker
                                selected={form.endAt}
                                onChange={(date) => {
                                    setField("endAt", date);
                                    setFieldErrors((prev) => ({ ...prev, endAt: undefined }));
                                }}
                                showTimeSelect
                                timeIntervals={1}
                                timeCaption="Time"
                                dateFormat="dd/MM/yyyy h:mm aa"
                                placeholderText="DD/MM/YYYY hh:mm"
                                showMonthDropdown
                                showYearDropdown
                                scrollableYearDropdown
                                yearDropdownItemNumber={15}
                                minDate={form.scheduledAt || new Date()} // End date should be after start date
                                disabled={form.recurrence === "once"}
                                customInput={
                                    <DateTimeInputWithButton
                                        className={`rfm-input ${fieldErrors.endAt ? "is-error" : ""}`}
                                        disabled={form.recurrence === "once"}
                                    />
                                }
                            />
                            {fieldErrors.endAt && <div className="rfm-help">{fieldErrors.endAt}</div>}
                            <div className="rfm-help-muted">
                                {form.recurrence === "once"
                                    ? "End date is not applicable for one-time reminders."
                                    : "Leave empty for indefinite recurring reminders."}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rfm-footer">
                    <button className="rfm-btn" onClick={onClose} type="button" disabled={saving}>
                        Cancel
                    </button>
                    <button className="rfm-btn rfm-btn-primary" onClick={handleSave} type="button" disabled={saving}>
                        {saving ? "Saving…" : isEdit ? "Save changes" : "Create reminder"}
                    </button>
                </div>
            </div>
        </div>
    );
}