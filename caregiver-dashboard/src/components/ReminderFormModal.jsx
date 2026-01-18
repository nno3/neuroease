import { useEffect, useMemo, useState, forwardRef } from "react";
import { Calendar } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./ReminderFormModal.css";

const TYPES = [
    { label: "Medication", value: "medication" },
    { label: "Appointment", value: "appointment" },
    // UI says “task”, backend expects “general”
    { label: "General", value: "general" },
];

const RECURRENCE = [
    { label: "Once", value: "once" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    {label: "Monthly", value: "monthly"},
];

// datetime-local => "YYYY-MM-DDTHH:mm"
function isValidDateTimeLocal(v) {
    if (!v) return false;
    const d = new Date(v);
    return !Number.isNaN(d.getTime());
}

function toISOFromLocal(v) {
    // interpret as local time, convert to ISO for backend DATE
    const d = new Date(v);
    return d.toISOString();
}

const DateTimeInputWithButton = forwardRef(
    ({ value, onClick, onChange, placeholder, className, disabled }, ref) => (
        <div className={`rfm-datewrap ${disabled ? "is-disabled" : ""}`}>
            <input
                ref={ref}
                className={className}
                value={value || ""}
                onChange={onChange}     // allow typing
                onClick={onClick}       // clicking opens picker
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


export default function ReminderFormModal({ open, mode, patientId, reminder, onClose, onSubmit }) {
    const isEdit = mode === "edit";

    const initial = useMemo(() => {
        const scheduled = reminder?.scheduledTime ? new Date(reminder.scheduledTime) : null;

        // convert to datetime-local string (local)
        const dtLocal = scheduled
            ? new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            : "";

        return {
            title: reminder?.title ?? "",
            message: reminder?.message ?? "",
            reminderType: reminder?.reminderType ?? "general",
            scheduledTimeLocal: dtLocal,
            recurrence: reminder?.recurrence ?? "once",
        };
    }, [reminder]);

    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [dtDate, setDtDate] = useState(() => {
        return form.scheduledTimeLocal ? new Date(form.scheduledTimeLocal) : null;
    });

    useEffect(() => {
        if (open) {
            setForm(initial);
            setDtDate(initial.scheduledTimeLocal ? new Date(initial.scheduledTimeLocal) : null);
            setSaving(false);
            setError("");
            setFieldErrors({});
        }
    }, [open, initial]);

    if (!open) return null;

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const validate = () => {
        const errs = {};
        if (!patientId) errs.patientId = "Select a patient first.";

        if (!form.title.trim()) errs.title = "Title is required.";
        if (!form.message.trim()) errs.message = "Message is required.";

        if (!form.reminderType) errs.reminderType = "Type is required.";

        if (!form.scheduledTimeLocal) errs.scheduledTimeLocal = "Scheduled time is required.";
        else if (!isValidDateTimeLocal(form.scheduledTimeLocal)) errs.scheduledTimeLocal = "Enter a valid date/time.";
        else {
            const d = new Date(form.scheduledTimeLocal);
            // Prevent past reminders (common requirement)
            if (d.getTime() < Date.now() - 60_000) errs.scheduledTimeLocal = "Scheduled time cannot be in the past.";
        }

        if (!form.recurrence) errs.recurrence = "Recurrence is required.";
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

        const payload = {
            patientId,
            title: form.title.trim(),
            message: form.message.trim(),
            reminderType: form.reminderType,               // medication|appointment|general
            scheduledTime: toISOFromLocal(form.scheduledTimeLocal), // ISO string
            recurrence: form.recurrence,                   // once|daily|weekly
        };

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
                        <div className="rfm-subtitle">{isEdit ? "Update the reminder details." : "Create a reminder with recurrence."}</div>
                    </div>
                    <button className="rfm-close" onClick={onClose} type="button">×</button>
                </div>

                <div className="rfm-body">
                    {error && <div className="rfm-error">{error}</div>}

                    <div className="rfm-grid">
                        <div className="rfm-field">
                            <label className="rfm-label">Title *</label>
                            <input
                                className={`rfm-input ${fieldErrors.title ? "is-error" : ""}`}
                                value={form.title}
                                onChange={(e) => setField("title", e.target.value)}
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
                                    <option key={t.value} value={t.value}>{t.label}</option>
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
                            <label className="rfm-label">Scheduled time *</label>
                            <DatePicker
                                selected={dtDate}
                                onChange={(date) => {
                                    setDtDate(date);
                                    // convert to "YYYY-MM-DDTHH:mm" in local time for your existing logic
                                    const local = date
                                        ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                                        : "";
                                    setField("scheduledTimeLocal", local);
                                    setFieldErrors((e) => ({ ...e, scheduledTimeLocal: undefined }));
                                }}
                                showTimeSelect
                                timeIntervals={5}
                                timeCaption="Time"
                                dateFormat="dd/MM/yyyy HH:mm"
                                placeholderText="DD/MM/YYYY HH:mm"
                                minDate={new Date()}
                                customInput={
                                    <DateTimeInputWithButton
                                        className={`rfm-input ${fieldErrors.scheduledTimeLocal ? "is-error" : ""}`}
                                    />
                                }
                            />
                            {fieldErrors.scheduledTimeLocal && <div className="rfm-help">{fieldErrors.scheduledTimeLocal}</div>}
                        </div>

                        <div className="rfm-field">
                            <label className="rfm-label">Recurrence *</label>
                            <select
                                className={`rfm-select ${fieldErrors.recurrence ? "is-error" : ""}`}
                                value={form.recurrence}
                                onChange={(e) => setField("recurrence", e.target.value)}
                            >
                                {RECURRENCE.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>

                            {form.recurrence === "weekly" && (
                                <div className="rfm-help-muted">
                                    Weekly repeats on the same weekday as the scheduled time.
                                </div>
                            )}

                            {fieldErrors.recurrence && <div className="rfm-help">{fieldErrors.recurrence}</div>}
                        </div>
                    </div>
                </div>

                <div className="rfm-footer">
                    <button className="rfm-btn" onClick={onClose} type="button" disabled={saving}>Cancel</button>
                    <button className="rfm-btn rfm-btn-primary" onClick={handleSave} type="button" disabled={saving}>
                        {saving ? "Saving…" : isEdit ? "Save changes" : "Create reminder"}
                    </button>
                </div>
            </div>
        </div>
    );
}
