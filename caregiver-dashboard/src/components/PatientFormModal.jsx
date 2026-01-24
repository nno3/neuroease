import { useEffect, useMemo, useState, forwardRef } from "react";
import "./PatientFormModal.css";
import { createPatient, updatePatient } from "../services/patients";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

const DateInputWithButton = forwardRef(
    ({ value, onClick, onChange, placeholder, className, disabled }, ref) => (
        <div className={`pfm-datewrap ${disabled ? "is-disabled" : ""}`}>
            <input
                ref={ref}
                className={className}
                value={value || ""}
                onChange={onChange} // allows typing
                onClick={onClick} // opens calendar when clicking input
                placeholder={placeholder}
                disabled={disabled}
            />
            <button
                type="button"
                className="pfm-calbtn"
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
DateInputWithButton.displayName = "DateInputWithButton";

/* ---------- validators ---------- */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isValidName(name) {
    return String(name || "").trim().length >= 2;
}

function passwordError(password) {
    const p = String(password || "");
    if (p.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(p)) return "Password must include at least 1 uppercase letter.";
    if (!/[a-z]/.test(p)) return "Password must include at least 1 lowercase letter.";
    if (!/[0-9]/.test(p)) return "Password must include at least 1 number.";
    if (!/[^A-Za-z0-9]/.test(p)) return "Password must include at least 1 special character.";
    return "";
}

/**
 * Emergency contact(s) validation:
 * - Allows multiple contacts, one per line.
 * - Each line must include a name + phone (formats supported):
 *   "Name — +44 7700..." or "Name: +44..." or "Name - +44..."
 *   Fallback: splits at first digit if no delimiter.
 */
function emergencyContactError(value) {
    const text = String(value || "").trim();
    if (!text) return "Emergency contact is required.";

    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    if (lines.length === 0) return "Emergency contact is required.";
    if (text.length > 400) return "Emergency contact is too long (max 400 characters).";

    const parseLine = (line) => {
        const parts = line.split(/[:\-–—]/); // :, -, –, —
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const phone = parts.slice(1).join("-").trim();
            return { name, phone };
        }

        const idx = line.search(/\d/);
        if (idx === -1) return { name: "", phone: "" };
        const name = line.slice(0, idx).trim();
        const phone = line.slice(idx).trim();
        return { name, phone };
    };

    for (const line of lines) {
        const { name, phone } = parseLine(line);

        if (!name || name.length < 2) {
            return "Each emergency contact must include a name (min 2 characters).";
        }

        if (!phone) {
            return "Each emergency contact must include a phone number.";
        }

        if (!/^[0-9+\-\s()]+$/.test(phone)) {
            return "Phone number can only contain digits, spaces, +, -, and parentheses.";
        }

        const digits = phone.replace(/\D/g, "");
        if (digits.length < 7) {
            return "Each phone number must contain at least 7 digits.";
        }
    }

    return "";
}

function parseISODate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatISODate(d) {
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function PatientFormModal({ open, mode, patient, onClose, onSaved }) {
    const isEdit = mode === "edit";

    const initial = useMemo(() => {
        const profile = patient?.Patient ?? patient?.profile ?? null;

        const dobISO = profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : "";
        return {
            name: patient?.name || "",
            email: patient?.email || "",
            password: "",
            dateOfBirth: dobISO,
            emergencyContact: profile?.emergencyContact || "",
            medicalConditions: profile?.medicalConditions || "",
        };
    }, [patient]);

    const [form, setForm] = useState(initial);
    const [dobDate, setDobDate] = useState(parseISODate(initial.dateOfBirth));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (open) {
            setForm(initial);
            setDobDate(parseISODate(initial.dateOfBirth));
            setSaving(false);
            setError("");
            setFieldErrors({});
        }
    }, [open, initial]);

    if (!open) return null;

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleDobChange = (date) => {
        setDobDate(date);
        setField("dateOfBirth", date ? formatISODate(date) : "");
        setFieldErrors((e) => ({ ...e, dateOfBirth: undefined }));
    };

    const validate = () => {
        const errs = {};

        if (!form.name.trim()) errs.name = "Name is required.";
        else if (!isValidName(form.name)) errs.name = "Name must be at least 2 characters.";

        if (!isEdit) {
            if (!form.email.trim()) errs.email = "Email is required.";
            else if (!isValidEmail(form.email)) errs.email = "Enter a valid email address.";

            if (!form.password) errs.password = "Password is required.";
            else {
                const msg = passwordError(form.password);
                if (msg) errs.password = msg;
            }
        }

        const ecMsg = emergencyContactError(form.emergencyContact);
        if (ecMsg) errs.emergencyContact = ecMsg;

        if (!form.medicalConditions.trim()) errs.medicalConditions = "Medical conditions is required.";

        if (!form.dateOfBirth) {
            errs.dateOfBirth = "Date of birth is required.";
        } else {
            const d = parseISODate(form.dateOfBirth);
            if (!d) errs.dateOfBirth = "Enter a valid date of birth.";
            else if (d > new Date()) errs.dateOfBirth = "Date of birth cannot be in the future.";
            else if (d < new Date("1900-01-01")) errs.dateOfBirth = "Date of birth must be after 01/01/1900.";
        }

        if (form.dateOfBirth) {
            const d = parseISODate(form.dateOfBirth);
            if (!d) errs.dateOfBirth = "Enter a valid date of birth.";
            else if (d > new Date()) errs.dateOfBirth = "Date of birth cannot be in the future.";
            else if (d < new Date("1900-01-01")) errs.dateOfBirth = "Date of birth must be after 01/01/1900.";
        }

        return errs;
    };

    const handleSubmit = async () => {
        setError("");
        const errs = validate();
        setFieldErrors(errs);

        if (Object.keys(errs).length) {
            setError("Please fix the highlighted fields.");
            return;
        }

        setSaving(true);
        try {
            let res;

            if (!isEdit) {
                res = await createPatient({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    dateOfBirth: form.dateOfBirth || null,
                    emergencyContact: form.emergencyContact.trim(),
                    medicalConditions: form.medicalConditions.trim(),
                });
            } else {
                res = await updatePatient(patient.id, {
                    name: form.name.trim(),
                    dateOfBirth: form.dateOfBirth || null,
                    emergencyContact: form.emergencyContact.trim(),
                    medicalConditions: form.medicalConditions.trim(),
                });
            }

            const apiMsg =
                res?.data?.message ??
                res?.message ??
                (isEdit ? "Patient updated successfully." : "Patient created successfully.");

            const returnedPatient =
                res?.data?.data?.patient ?? res?.data?.patient ?? res?.data?.data ?? res?.data ?? null;

            onSaved?.({ patient: returnedPatient, message: apiMsg });
            onClose?.();
        } catch (err) {
            setError(err?.message || (isEdit ? "Unable to update patient." : "Unable to create patient."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pfm-overlay" onClick={onClose} role="presentation">
            <div className="pfm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pfm-header">
                    <div>
                        <div className="pfm-title">{isEdit ? "Edit patient" : "Add patient"}</div>
                        <div className="pfm-subtitle">
                            {isEdit ? "Update the patient profile." : "Create a patient and assign them to your care."}
                        </div>
                    </div>
                    <button className="pfm-close" onClick={onClose} type="button">
                        ×
                    </button>
                </div>

                <div className="pfm-body">
                    {error && <div className="pfm-error">{error}</div>}

                    <div className="pfm-grid">
                        <div className="pfm-field">
                            <label className="pfm-label">Name *</label>
                            <input
                                className={`pfm-input ${fieldErrors.name ? "is-error" : ""}`}
                                value={form.name}
                                onChange={(e) => setField("name", e.target.value)}
                                placeholder="e.g. Mary Johnson"
                            />
                            {fieldErrors.name && <div className="pfm-help">{fieldErrors.name}</div>}
                        </div>

                        <div className="pfm-field">
                            <label className="pfm-label">Email {!isEdit ? "*" : ""}</label>
                            <input
                                className={`pfm-input ${fieldErrors.email ? "is-error" : ""}`}
                                value={form.email}
                                onChange={(e) => setField("email", e.target.value)}
                                disabled={isEdit}
                                placeholder="e.g. mary@example.com"
                            />
                            {fieldErrors.email && <div className="pfm-help">{fieldErrors.email}</div>}
                        </div>

                        {!isEdit && (
                            <div className="pfm-field">
                                <label className="pfm-label">Password *</label>
                                <input
                                    className={`pfm-input ${fieldErrors.password ? "is-error" : ""}`}
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setField("password", e.target.value)}
                                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
                                />
                                {fieldErrors.password && <div className="pfm-help">{fieldErrors.password}</div>}
                            </div>
                        )}

                        <div className="pfm-field">
                            <label className="pfm-label">Date of birth *</label>

                            <DatePicker
                                selected={dobDate}
                                onChange={handleDobChange}
                                dateFormat="dd/MM/yyyy"
                                placeholderText="DD/MM/YYYY"
                                showMonthDropdown
                                showYearDropdown
                                scrollableYearDropdown
                                yearDropdownItemNumber={120}
                                maxDate={new Date()}
                                minDate={new Date("1900-01-01")}
                                customInput={
                                    <DateInputWithButton className={`pfm-input ${fieldErrors.dateOfBirth ? "is-error" : ""}`} />
                                }
                            />
                            {fieldErrors.dateOfBirth && <div className="pfm-help">{fieldErrors.dateOfBirth}</div>}
                        </div>

                        {/* multi-contact emergency contact field */}
                        <div className="pfm-field pfm-span2">
                            <label className="pfm-label">Emergency contact(s) *</label>
                            <textarea
                                className={`pfm-textarea ${fieldErrors.emergencyContact ? "is-error" : ""}`}
                                rows={3}
                                value={form.emergencyContact}
                                onChange={(e) => setField("emergencyContact", e.target.value)}
                                placeholder={`e.g. 
Mum — +44 7700 900123 
John Smith — 0116 123 4567`}


                            />
                            {fieldErrors.emergencyContact && <div className="pfm-help">{fieldErrors.emergencyContact}</div>}
                        </div>

                        <div className="pfm-field pfm-span2">
                            <label className="pfm-label">Medical conditions *</label>
                            <textarea
                                className={`pfm-textarea ${fieldErrors.medicalConditions ? "is-error" : ""}`}
                                rows={4}
                                value={form.medicalConditions}
                                onChange={(e) => setField("medicalConditions", e.target.value)}
                                placeholder="e.g. Diabetes, Hypertension, Asthma…"
                            />
                            {fieldErrors.medicalConditions && <div className="pfm-help">{fieldErrors.medicalConditions}</div>}
                        </div>
                    </div>
                </div>

                <div className="pfm-footer">
                    <button className="pfm-btn" onClick={onClose} type="button" disabled={saving}>
                        Cancel
                    </button>
                    <button className="pfm-btn pfm-btn-primary" onClick={handleSubmit} type="button" disabled={saving}>
                        {saving ? "Saving…" : isEdit ? "Save changes" : "Create patient"}
                    </button>
                </div>
            </div>
        </div>
    );
}
