import { useEffect, useMemo, useState } from "react";
import "./PatientFormModal.css";
import { createPatient, updatePatient } from "../services/patients";

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isValidName(name) {
    const v = String(name || "").trim();
    return v.length >= 2;
}

function passwordRules(password) {
    const p = String(password || "");
    return {
        minLen: p.length >= 8,
        upper: /[A-Z]/.test(p),
        lower: /[a-z]/.test(p),
        number: /[0-9]/.test(p),
        special: /[^A-Za-z0-9]/.test(p),
    };
}

function emergencyContactError(value) {
    const v = String(value || "").trim();
    if (!v) return "Emergency contact is required.";
    if (v.length < 6) return "Emergency contact is too short.";
    if (v.length > 30) return "Emergency contact is too long (max 30 characters).";
    if (!/[0-9]/.test(v)) return "Emergency contact must be a phone number.";
    return "";
}


function passwordError(password) {
    const r = passwordRules(password);
    if (!r.minLen) return "Password must be at least 8 characters.";
    if (!r.upper) return "Password must include at least 1 uppercase letter.";
    if (!r.lower) return "Password must include at least 1 lowercase letter.";
    if (!r.number) return "Password must include at least 1 number.";
    if (!r.special) return "Password must include at least 1 special character.";
    return "";
}

export default function PatientFormModal({ open, mode, patient, onClose, onSaved }) {
    const isEdit = mode === "edit";

    const initial = useMemo(() => {
        const profile = patient?.Patient ?? patient?.profile ?? null;

        return {
            name: patient?.name || "",
            email: patient?.email || "",
            password: "",
            dateOfBirth: profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : "",
            emergencyContact: profile?.emergencyContact || "",
            medicalConditions: profile?.medicalConditions || "",
        };
    }, [patient]);

    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);

    // top error banner (server errors OR "fix fields")
    const [error, setError] = useState("");

    // per-field errors
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (open) {
            setForm(initial);
            setSaving(false);
            setError("");
            setFieldErrors({});
        }
    }, [open, initial]);

    if (!open) return null;

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const validate = () => {
        const errs = {};

        // Name
        if (!form.name.trim()) errs.name = "Name is required.";
        else if (!isValidName(form.name)) errs.name = "Name must be at least 2 characters.";

        // Create mode only: email + password
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
                    emergencyContact: form.emergencyContact?.trim() || null,
                    medicalConditions: form.medicalConditions?.trim() || null,
                });
            } else {
                res = await updatePatient(patient.id, {
                    name: form.name.trim(),
                    dateOfBirth: form.dateOfBirth || null,
                    emergencyContact: form.emergencyContact?.trim() || null,
                    medicalConditions: form.medicalConditions?.trim() || null,
                });
            }

            const apiMsg =
                res?.data?.message || (isEdit ? "Patient updated successfully." : "Patient created successfully.");

            const returnedPatient = res?.data?.data?.patient;


            onSaved?.({ patient: returnedPatient, message: apiMsg });
            onClose?.();
        } catch (err) {
            // apiClient throws Error(message) so use err.message
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
                    <button className="pfm-close" onClick={onClose} type="button">×</button>
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
                                />
                                {fieldErrors.password && <div className="pfm-help">{fieldErrors.password}</div>}
                            </div>
                        )}

                        <div className="pfm-field">
                            <label className="pfm-label">Date of birth</label>
                            <input
                                className="pfm-input"
                                type="date"
                                value={form.dateOfBirth}
                                onChange={(e) => setField("dateOfBirth", e.target.value)}
                                min="1900-01-01"
                                max={new Date().toISOString().slice(0, 10)}
                            />
                        </div>

                        <div className="pfm-field">
                            <label className="pfm-label">Emergency contact *</label>
                            <input
                                className={`pfm-input ${fieldErrors.emergencyContact ? "is-error" : ""}`}
                                value={form.emergencyContact}
                                onChange={(e) => setField("emergencyContact", e.target.value)}
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
