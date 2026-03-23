/**
 * Add/Edit Patient modal – four tabs: Personal, Medical, Medical History, Care & Emergency.
 * Medical history is stored as a structured object: diagnosis, chronicConditions (array of
 * { diagnosis, dateDiagnosed }), pastConditions, etc. Emergency contacts are "Name - Phone"
 * per line. Create sends to POST /api/patients; update to PUT /api/patients/:id. Validation
 * matches backend (email, password strength, required fields). Archive is a separate flow at bottom.
 */
import { useEffect, useMemo, useState, forwardRef, useRef } from "react";
import "./PatientFormModal.css";
import { createPatient, updatePatient } from "../services/patients";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, Plus, Trash2 } from "lucide-react";

const TABS = ["Personal", "Medical", "Medical History", "Care & Emergency"];

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

//validators
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isValidName(name) {
    const trimmedName = String(name || "").trim();
    if (trimmedName.length < 2) return false;
    if (/\d/.test(trimmedName)) return false;
    return /^[A-Za-zÀ-ÿ\s\-'.]+$/.test(trimmedName);
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
        const parts = line.split(/[:\-–—]/);
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

// Parse medical history; normalize chronicConditions and medications array
function parseMedicalHistory(medicalConditions) {
    if (!medicalConditions) return {};

    try {
        const parsed = typeof medicalConditions === "string" ? JSON.parse(medicalConditions) : medicalConditions;
        const cc = parsed.chronicConditions;
        if (cc != null) {
            if (typeof cc === "string") {
                parsed.chronicConditions = cc.trim()
                    ? [{ diagnosis: cc.trim(), diagnosedDate: null, dateNotApplicable: true }]
                    : [];
            } else if (!Array.isArray(cc)) {
                parsed.chronicConditions = [];
            } else {
                parsed.chronicConditions = cc.map((item) => ({
                    diagnosis: item?.diagnosis ?? "",
                    diagnosedDate: item?.diagnosedDate ?? null,
                    dateNotApplicable: Boolean(item?.dateNotApplicable),
                }));
            }
        } else {
            parsed.chronicConditions = [];
        }
        // Migrate legacy currentMedications string to medications array
        if (!Array.isArray(parsed.medications)) {
            const legacy = (parsed.currentMedications ?? "").trim();
            if (legacy) {
                parsed.medications = legacy.split("\n").map((line) => {
                    const t = line.trim();
                    return t ? { name: t, dosage: "", frequency: "" } : null;
                }).filter(Boolean);
            } else {
                parsed.medications = [];
            }
        }
        if (!Array.isArray(parsed.medications)) parsed.medications = [];
        return parsed;
    } catch {
        return { chronicConditions: [], medications: [] };
    }
}

const GENDER_OPTIONS = [
    { value: "", label: "Select gender" },
    { value: "Female", label: "Female" },
    { value: "Male", label: "Male" },
    { value: "Non-binary", label: "Non-binary" },
    { value: "Other", label: "Other" },
    { value: "Prefer not to say", label: "Prefer not to say" },
];

const COMMUNICATION_OPTIONS = [
    { value: "Phone", label: "Phone" },
    { value: "SMS", label: "SMS" },
    { value: "Email", label: "Email" },
];

const RELATIONSHIP_OPTIONS = [
    { value: "", label: "Select relationship" },
    { value: "Son", label: "Son" },
    { value: "Daughter", label: "Daughter" },
    { value: "Spouse", label: "Spouse" },
    { value: "Partner", label: "Partner" },
    { value: "Parent", label: "Parent" },
    { value: "Sibling", label: "Sibling" },
    { value: "Friend", label: "Friend" },
    { value: "Other", label: "Other" },
];

// Cognitive impairment / dementia diagnoses (no blood type); "Other" allows custom text
const DIAGNOSIS_OPTIONS = [
    { value: "", label: "Select diagnosis" },
    { value: "MCI (Mild Cognitive Impairment)", label: "MCI (Mild Cognitive Impairment)" },
    { value: "Early-stage dementia", label: "Early-stage dementia" },
    { value: "Moderate dementia", label: "Moderate dementia" },
    { value: "Advanced dementia", label: "Advanced dementia" },
    { value: "Alzheimer's disease", label: "Alzheimer's disease" },
    { value: "Vascular dementia", label: "Vascular dementia" },
    { value: "Lewy body dementia", label: "Lewy body dementia" },
    { value: "Frontotemporal dementia", label: "Frontotemporal dementia" },
    { value: "Mixed dementia", label: "Mixed dementia" },
    { value: "Other cognitive impairment", label: "Other cognitive impairment" },
    { value: "Other", label: "Other (specify below)" },
];

const DIAGNOSIS_VALUES = new Set(DIAGNOSIS_OPTIONS.map((o) => o.value).filter(Boolean));

const STAGE_OPTIONS = [
    { value: "", label: "Select stage" },
    { value: "Mild", label: "Mild" },
    { value: "Moderate", label: "Moderate" },
    { value: "Severe", label: "Severe" },
    { value: "Early", label: "Early" },
    { value: "Late", label: "Late" },
];

export default function PatientFormModal({ open, mode, patient, onClose, onSaved, onArchivePatient, onArchived }) {
    const isEdit = mode === "edit";

    const initial = useMemo(() => {
        const profile = patient?.Patient ?? patient?.profile ?? null;

        // Backend may return medicalHistory as JSON string; parse so we can read diagnosis, etc.
        let medicalHistory = profile?.medicalHistory;
        if (typeof medicalHistory === "string") {
            try {
                medicalHistory = medicalHistory.trim() ? JSON.parse(medicalHistory) : {};
            } catch {
                medicalHistory = {};
            }
        }
        if (medicalHistory == null) {
            medicalHistory = profile?.medicalConditions ? parseMedicalHistory(profile.medicalConditions) : {};
        }
        if (typeof medicalHistory !== "object" || medicalHistory === null) {
            medicalHistory = {};
        }

        const dobISO = profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : "";
        return {
            name: patient?.name || "",
            email: patient?.email || "",
            password: "",
            dateOfBirth: dobISO,
            address: profile?.address ?? "",
            gender: profile?.gender ?? "",
            phoneNumber: profile?.phoneNumber ?? "",
            emergencyContact: profile?.emergencyContact || "",
            preferredCommunication: profile?.preferredCommunication ?? "",
            careNotes: profile?.careNotes ?? "",
            emergencyContactName: profile?.emergencyContactName ?? "",
            emergencyContactRelationship: profile?.emergencyContactRelationship ?? "",
            emergencyContactPhone: profile?.emergencyContactPhone ?? "",

            diagnosis: (() => {
                const d = profile?.diagnosis ?? medicalHistory?.diagnosis ?? "";
                return DIAGNOSIS_VALUES.has(d) ? d : (d ? "Other" : "");
            })(),
            diagnosisOther: (() => {
                const d = profile?.diagnosis ?? medicalHistory?.diagnosis ?? "";
                return d && !DIAGNOSIS_VALUES.has(d) ? String(d).trim() : "";
            })(),
            diagnosisDate: (() => {
                const d = medicalHistory?.diagnosisDate ?? profile?.diagnosisDate ?? null;
                if (!d) return "";
                const str = typeof d === "string" ? d : (d instanceof Date ? d.toISOString().slice(0, 10) : "");
                return str.slice(0, 10) || "";
            })(),
            stageSeverity: profile?.stageSeverity ?? medicalHistory?.stageSeverity ?? "",
            primaryConsultant: profile?.primaryConsultant ?? medicalHistory?.primaryConsultant ?? "",
            medications: (() => {
                const mh = parseMedicalHistory(profile?.medicalHistory);
                return (mh?.medications ?? []).map((m) => ({
                    name: (m?.name ?? "").trim(),
                    dosage: (m?.dosage ?? "").trim(),
                    frequency: (m?.frequency ?? "").trim(),
                }));
            })(),
            chronicConditions: Array.isArray(medicalHistory?.chronicConditions)
                ? medicalHistory.chronicConditions.map((c) => ({
                    diagnosis: c?.diagnosis ?? "",
                    diagnosedDate: c?.diagnosedDate ?? null,
                    dateNotApplicable: Boolean(c?.dateNotApplicable),
                }))
                : [],
            surgicalHistory: profile?.surgicalHistory ?? medicalHistory?.surgicalHistory ?? "",
            hospitalizations: profile?.hospitalizations ?? medicalHistory?.hospitalizations ?? "",
            previousMedications: profile?.previousMedications ?? medicalHistory?.previousMedications ?? "",
            allergies: profile?.allergies ?? medicalHistory?.allergies ?? "",
            familyHistory: profile?.familyHistory ?? medicalHistory?.familyHistory ?? "",
            lifestyleFactors: profile?.lifestyleFactors ?? medicalHistory?.lifestyleFactors ?? "",
            immunizations: profile?.immunizations ?? medicalHistory?.immunizations ?? "",
            reminderNotificationChannel: profile?.reminderNotificationChannel ?? "none",
        };
    }, [patient]);

    const [activeTab, setActiveTab] = useState("Personal");
    const [form, setForm] = useState(initial);
    const [dobDate, setDobDate] = useState(parseISODate(initial.dateOfBirth));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [archiveReason, setArchiveReason] = useState("discharged");
    const [archiveNotes, setArchiveNotes] = useState("");
    const [archiveLoading, setArchiveLoading] = useState(false);
    const [archiveError, setArchiveError] = useState("");

    const bodyRef = useRef(null);

    const scrollToSection = (tab) => {
        setActiveTab(tab);
        setTimeout(() => {
            const el = bodyRef.current?.querySelector(`[data-section="${tab}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
    };

    useEffect(() => {
        if (open) {
            setForm(initial);
            setDobDate(parseISODate(initial.dateOfBirth));
            setSaving(false);
            setError("");
            setFieldErrors({});
            setActiveTab("Personal");
            setArchiveReason("discharged");
            setArchiveNotes("");
            setArchiveError("");
        }
    }, [open, initial]);

    if (!open) return null;

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleDobChange = (date) => {
        setDobDate(date);
        setField("dateOfBirth", date ? formatISODate(date) : "");
        setFieldErrors((e) => ({ ...e, dateOfBirth: undefined }));
    };

    const addChronicCondition = () => {
        setForm((p) => ({
            ...p,
            chronicConditions: [...p.chronicConditions, { diagnosis: "", diagnosedDate: null, dateNotApplicable: false }],
        }));
        setFieldErrors((e) => ({ ...e, chronicConditions: undefined, medicalHistory: undefined }));
    };

    const updateChronicCondition = (index, updates) => {
        setForm((p) => ({
            ...p,
            chronicConditions: p.chronicConditions.map((c, i) => (i === index ? { ...c, ...updates } : c)),
        }));
        setFieldErrors((e) => ({ ...e, chronicConditions: undefined, medicalHistory: undefined }));
    };

    const removeChronicCondition = (index) => {
        setForm((p) => ({
            ...p,
            chronicConditions: p.chronicConditions.filter((_, i) => i !== index),
        }));
        setFieldErrors((e) => ({ ...e, chronicConditions: undefined, medicalHistory: undefined }));
    };

    const addMedication = () => {
        setForm((p) => ({
            ...p,
            medications: [...p.medications, { name: "", dosage: "", frequency: "" }],
        }));
    };

    const updateMedication = (index, updates) => {
        setForm((p) => ({
            ...p,
            medications: p.medications.map((m, i) => (i === index ? { ...m, ...updates } : m)),
        }));
    };

    const removeMedication = (index) => {
        setForm((p) => ({
            ...p,
            medications: p.medications.filter((_, i) => i !== index),
        }));
    };


    const validate = () => {
        const errs = {};

        if (!form.name.trim()) errs.name = "Name is required.";
        else if (!isValidName(form.name)) errs.name = "Name must be at least 2 characters and contain only letters, spaces, hyphens, apostrophes, and periods.";

        if (!form.address.trim()) errs.address = "Address is required (at least 2 characters).";
        else if (form.address.trim().length < 2) errs.address = "Address must be at least 2 characters.";

        if (!isEdit) {
            if (!form.email.trim()) errs.email = "Email is required.";
            else if (!isValidEmail(form.email)) errs.email = "Enter a valid email address.";

            if (!form.password) errs.password = "Password is required.";
            else {
                const msg = passwordError(form.password);
                if (msg) errs.password = msg;
            }
        }

        if (!(form.emergencyContactName || "").trim()) errs.emergencyContactName = "Emergency contact name is required (at least 2 characters).";
        else if ((form.emergencyContactName || "").trim().length < 2) errs.emergencyContactName = "Emergency contact name must be at least 2 characters.";
        const phoneDigits = (form.emergencyContactPhone || "").replace(/\D/g, "");
        if (!(form.emergencyContactPhone || "").trim()) errs.emergencyContactPhone = "Emergency contact phone is required (at least 10 characters).";
        else if (phoneDigits.length < 7) errs.emergencyContactPhone = "Emergency contact phone must contain at least 7 digits.";

        const diagnosisSelected = (form.diagnosis || "").trim();
        const diagnosisOtherFilled = (form.diagnosisOther || "").trim();
        if (!diagnosisSelected || diagnosisSelected === "Select diagnosis") {
            errs.diagnosis = "Please select a diagnosis.";
        } else if (diagnosisSelected === "Other" && !diagnosisOtherFilled) {
            errs.diagnosis = "Please specify the diagnosis.";
        }

        // Validate each chronic condition that has a diagnosis (optional section)
        const invalidConditionIndex = form.chronicConditions.findIndex(
            (c) => (c.diagnosis || "").trim() && (c.diagnosis || "").trim().length < 2
        );
        if (invalidConditionIndex !== -1) {
            errs.chronicConditions = "Each diagnosis must be at least 2 characters.";
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        let dobDate = null;
        if (!form.dateOfBirth) {
            errs.dateOfBirth = "Date of birth is required.";
        } else {
            const d = parseISODate(form.dateOfBirth);
            const today = new Date();
            const maxAge = 130;
            const minDob = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate());
            if (!d) errs.dateOfBirth = "Enter a valid date of birth.";
            else if (d > today) errs.dateOfBirth = "Date of birth cannot be in the future.";
            else if (d < minDob) errs.dateOfBirth = "Patient age cannot exceed 130 years.";
            else dobDate = d;
        }

        if (form.diagnosisDate && form.diagnosisDate.trim()) {
            const d = parseISODate(form.diagnosisDate.trim());
            if (d) {
                if (d > today) errs.diagnosisDate = "Diagnosis date cannot be in the future.";
                else if (dobDate && d < dobDate) errs.diagnosisDate = "Diagnosis date cannot be before date of birth.";
            }
        }

        const invalidCondDate = form.chronicConditions.findIndex((c) => {
            if (c.dateNotApplicable || !(c.diagnosedDate || "").trim()) return false;
            const d = parseISODate(c.diagnosedDate.trim());
            if (!d) return false;
            if (d > today) return true;
            if (dobDate && d < dobDate) return true;
            return false;
        });
        if (invalidCondDate !== -1) {
            errs.chronicConditions = "Diagnosis date cannot be in the future or before date of birth.";
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
            const chronicConditionsPayload = form.chronicConditions
                .filter((c) => (c.diagnosis || "").trim())
                .map((c) => ({
                    diagnosis: c.diagnosis.trim(),
                    diagnosedDate: c.dateNotApplicable ? null : (c.diagnosedDate || null),
                    dateNotApplicable: c.dateNotApplicable,
                }));

            const diagnosisValue =
                (form.diagnosis || "").trim() === "Other"
                    ? (form.diagnosisOther || "").trim() || null
                    : (form.diagnosis || "").trim() || null;

            const medicalHistory = {
                diagnosis: diagnosisValue,
                diagnosisDate: form.diagnosisDate && form.diagnosisDate.trim() ? form.diagnosisDate.trim() : null,
                stageSeverity: form.stageSeverity.trim() || null,
                primaryConsultant: form.primaryConsultant.trim() || null,
                medications: form.medications
                    .filter((m) => (m?.name ?? "").trim())
                    .map((m) => ({
                        name: (m.name ?? "").trim(),
                        dosage: (m.dosage ?? "").trim() || null,
                        frequency: (m.frequency ?? "").trim() || null,
                    })),
                chronicConditions: chronicConditionsPayload,
                surgicalHistory: form.surgicalHistory.trim(),
                hospitalizations: form.hospitalizations.trim() || null,
                previousMedications: form.previousMedications.trim() || null,
                allergies: form.allergies.trim(),
                familyHistory: form.familyHistory.trim(),
                lifestyleFactors: form.lifestyleFactors.trim(),
                immunizations: form.immunizations.trim(),
            };

            const carePayload = {
                preferredCommunication: form.preferredCommunication.trim() || null,
                careNotes: form.careNotes.trim() || null,
                emergencyContactName: form.emergencyContactName.trim() || null,
                emergencyContactRelationship: form.emergencyContactRelationship.trim() || null,
                emergencyContactPhone: form.emergencyContactPhone.trim() || null,
                emergencyContact: form.emergencyContact.trim() || null,
            };

            let inviteLink = null;
            let updatedPatient = null;
            if (!isEdit) {
                const createRes = await createPatient({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    dateOfBirth: form.dateOfBirth || null,
                    address: form.address.trim(),
                    gender: form.gender.trim() || null,
                    phoneNumber: form.phoneNumber.trim() || null,
                    medicalHistory,
                    ...carePayload,
                });
                inviteLink = createRes?.data?.inviteLink ?? null;
            } else {
                const updateRes = await updatePatient(patient.id, {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    dateOfBirth: form.dateOfBirth || null,
                    address: form.address.trim(),
                    gender: form.gender.trim() || null,
                    phoneNumber: form.phoneNumber.trim() || null,
                    medicalHistory,
                    ...carePayload,
                });
                updatedPatient = updateRes?.data?.patient ?? null;
            }

            const apiMsg = isEdit ? "Patient updated successfully." : "Patient created successfully.";
            onSaved?.({ message: apiMsg, inviteLink, patient: updatedPatient });
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
                        <div className="pfm-title">{isEdit ? "Edit Patient Profile" : "Add Patient"}</div>
                        <div className="pfm-subtitle">
                            {isEdit ? "Update the patient profile." : "Create a patient and assign them to your care."}
                        </div>
                    </div>
                    <button className="pfm-close" onClick={onClose} type="button" aria-label="Close">
                        ×
                    </button>
                </div>

                <nav className="pfm-tabs" role="tablist">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab}
                            className={`pfm-tab ${activeTab === tab ? "is-active" : ""}`}
                            onClick={() => scrollToSection(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                <div className="pfm-body" ref={bodyRef}>
                    {error && <div className="pfm-error">{error}</div>}

                    <div data-section="Personal" className="pfm-section-wrap">
                        <div className="pfm-section-header pfm-span2">
                            <h3>Personal Information</h3>
                        </div>
                    <div className="pfm-grid">
                        <div className="pfm-field">
                                <label className="pfm-label">Full Name *</label>
                            <input
                                className={`pfm-input ${fieldErrors.name ? "is-error" : ""}`}
                                value={form.name}
                                onChange={(e) => setField("name", e.target.value)}
                                    placeholder="e.g. Margaret Thompson"
                            />
                            {fieldErrors.name && <div className="pfm-help">{fieldErrors.name}</div>}
                        </div>

                        <div className="pfm-field">
                            <label className="pfm-label">Email {!isEdit ? "*" : ""}</label>
                            <input
                                type="email"
                                className={`pfm-input ${fieldErrors.email ? "is-error" : ""}`}
                                value={form.email}
                                onChange={(e) => setField("email", e.target.value)}
                                placeholder="e.g. margaret.thompson@email.com"
                            />
                            {import.meta.env.VITE_USABILITY_TESTING === "1" && (
                                <div className="disclaimer-box disclaimer-box--info">
                                    <strong>Important:</strong> Use your own real email address so you receive the activation link for the Patient App. Use fake data for name, date of birth, phone, address, etc.
                                </div>
                            )}
                            {isEdit && (
                                <div className="pfm-help pfm-help-muted">If you change the email, use &quot;Resend invite&quot; in the patient details to send the activation link to the new address.</div>
                            )}
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
                                <label className="pfm-label">Date of Birth *</label>
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
                                        <DateInputWithButton
                                            className={`pfm-input ${fieldErrors.dateOfBirth ? "is-error" : ""}`}/>
                                }
                            />
                            {fieldErrors.dateOfBirth && <div className="pfm-help">{fieldErrors.dateOfBirth}</div>}
                        </div>

                            <div className="pfm-field">
                                <label className="pfm-label">Gender</label>
                                <select
                                    className={`pfm-input pfm-select ${fieldErrors.gender ? "is-error" : ""}`}
                                    value={form.gender}
                                    onChange={(e) => setField("gender", e.target.value)}
                                >
                                    {GENDER_OPTIONS.map((opt) => (
                                        <option key={opt.value || "blank"} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pfm-field">
                                <label className="pfm-label">Phone number</label>
                                <input
                                    className="pfm-input"
                                    type="tel"
                                    value={form.phoneNumber}
                                    onChange={(e) => setField("phoneNumber", e.target.value)}
                                    placeholder="e.g. +44 7700 900123"
                                />
                            </div>

                        <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Address *</label>
                            <textarea
                                    className={`pfm-textarea pfm-textarea-sm ${fieldErrors.address ? "is-error" : ""}`}
                                    rows={2}
                                    value={form.address}
                                    onChange={(e) => setField("address", e.target.value)}
                                    placeholder="e.g. 42 Oak Lane, Manchester M1 2AB"
                                />
                                {fieldErrors.address && <div className="pfm-help">{fieldErrors.address}</div>}
                            </div>
                        </div>
                        </div>

                    <div data-section="Medical" className="pfm-section-wrap">
                        <div className="pfm-grid">
                        <div className="pfm-section-header pfm-span2">
                                <h3>Medical Information</h3>
                        </div>
                            <div className="pfm-field">
                                <label className="pfm-label">Diagnosis <span className="pfm-required">*</span></label>
                                <select
                                    className={`pfm-input pfm-select ${fieldErrors.diagnosis ? "is-error" : ""}`}
                                    value={form.diagnosis}
                                    onChange={(e) => {
                                        setField("diagnosis", e.target.value);
                                        setFieldErrors((prev) => ({ ...prev, diagnosis: undefined }));
                                    }}
                                >
                                    {DIAGNOSIS_OPTIONS.map((opt) => (
                                        <option key={opt.value || "blank"} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {fieldErrors.diagnosis && <div className="pfm-help">{fieldErrors.diagnosis}</div>}
                            </div>
                            {form.diagnosis === "Other" && (
                                <div className="pfm-field pfm-span2">
                                    <label className="pfm-label">Specify diagnosis <span className="pfm-required">*</span></label>
                                    <input
                                        className={`pfm-input ${fieldErrors.diagnosis ? "is-error" : ""}`}
                                        type="text"
                                        value={form.diagnosisOther}
                                        onChange={(e) => {
                                            setField("diagnosisOther", e.target.value);
                                            setFieldErrors((prev) => ({ ...prev, diagnosis: undefined }));
                                        }}
                                        placeholder="Enter diagnosis"
                                    />
                                    {fieldErrors.diagnosis && <div className="pfm-help">{fieldErrors.diagnosis}</div>}
                            </div>
                        )}
                            <div className="pfm-field">
                                <label className="pfm-label">Date diagnosed</label>
                                <DatePicker
                                    selected={form.diagnosisDate ? parseISODate(form.diagnosisDate) : null}
                                    onChange={(date) => {
                                        setField("diagnosisDate", date ? formatISODate(date) : "");
                                        setFieldErrors((prev) => ({ ...prev, diagnosisDate: undefined }));
                                    }}
                                    dateFormat="dd/MM/yyyy"
                                    placeholderText="Date diagnosed"
                                    showMonthDropdown
                                    showYearDropdown
                                    scrollableYearDropdown
                                    yearDropdownItemNumber={120}
                                    maxDate={new Date()}
                                    minDate={dobDate || new Date("1900-01-01")}
                                    customInput={
                                        <DateInputWithButton
                                            className={`pfm-input ${fieldErrors.diagnosisDate ? "is-error" : ""}`}
                                        />
                                    }
                                />
                                {fieldErrors.diagnosisDate && <div className="pfm-help">{fieldErrors.diagnosisDate}</div>}
                            </div>
                            <div className="pfm-field">
                                <label className="pfm-label">Stage / Severity</label>
                                <select
                                    className="pfm-input pfm-select"
                                    value={form.stageSeverity}
                                    onChange={(e) => setField("stageSeverity", e.target.value)}
                                >
                                    {STAGE_OPTIONS.map((opt) => (
                                        <option key={opt.value || "blank"} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        <div className="pfm-field pfm-span2">
                            <label className="pfm-label">Current medications</label>
                            <p className="pfm-help pfm-help-muted">Add each medication separately with optional dosage and frequency.</p>
                            <div className="pfm-medications-list">
                                {form.medications.map((med, index) => (
                                    <div key={index} className="pfm-medication-row">
                                        <input
                                            className={`pfm-input pfm-medication-name ${fieldErrors.medications ? "is-error" : ""}`}
                                            value={med.name}
                                            onChange={(e) => updateMedication(index, { name: e.target.value })}
                                            placeholder="Medication name (e.g. Donepezil)"
                                        />
                                        <input
                                            className="pfm-input pfm-medication-dosage"
                                            value={med.dosage}
                                            onChange={(e) => updateMedication(index, { dosage: e.target.value })}
                                            placeholder="Dosage (e.g. 5mg)"
                                        />
                                        <input
                                            className="pfm-input pfm-medication-frequency"
                                            value={med.frequency}
                                            onChange={(e) => updateMedication(index, { frequency: e.target.value })}
                                            placeholder="How often (e.g. daily)"
                                        />
                                        <button
                                            type="button"
                                            className="pfm-btn-icon"
                                            onClick={() => removeMedication(index)}
                                            aria-label="Remove medication"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="pfm-btn-add"
                                    onClick={addMedication}
                                >
                                    <Plus size={16} />
                                    Add medication
                                </button>
                            </div>
                        </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Allergies & adverse reactions</label>
                                <textarea
                                    className={`pfm-textarea ${fieldErrors.allergies ? "is-error" : ""}`}
                                    rows={2}
                                    value={form.allergies}
                                    onChange={(e) => setField("allergies", e.target.value)}
                                    placeholder="e.g. Penicillin"
                                />
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Primary Physician / Consultant</label>
                                <input
                                    className="pfm-input"
                                    value={form.primaryConsultant}
                                    onChange={(e) => setField("primaryConsultant", e.target.value)}
                                    placeholder="e.g. Dr. James Wilson"
                                />
                            </div>
                        </div>
                    </div>

                    <div data-section="Medical History" className="pfm-section-wrap">
                        <div className="pfm-grid">
                            <div className="pfm-section-header pfm-span2">
                                <h3>Medical History</h3>
                                <p className="pfm-section-subtitle">Optional. Add chronic conditions and other history below.</p>
                            </div>
                            {fieldErrors.chronicConditions && (
                                <div className="pfm-span2">
                                    <div className="pfm-help">{fieldErrors.chronicConditions}</div>
                                </div>
                            )}

                        <div className="pfm-field pfm-span2">
                            <label className="pfm-label">Chronic conditions</label>
                                <div className="pfm-chronic-list">
                                    {form.chronicConditions.map((condition, index) => (
                                        <div key={index} className="pfm-chronic-row">
                                            <input
                                                className={`pfm-input pfm-chronic-diagnosis ${fieldErrors.chronicConditions ? "is-error" : ""}`}
                                                value={condition.diagnosis}
                                                onChange={(e) => updateChronicCondition(index, { diagnosis: e.target.value })}
                                                placeholder="Diagnosis (e.g. MCI, Type 2 Diabetes)"
                                            />
                                            <div className="pfm-chronic-date">
                                                <DatePicker
                                                    selected={condition.dateNotApplicable ? null : parseISODate(condition.diagnosedDate)}
                                                    onChange={(date) => updateChronicCondition(index, { diagnosedDate: date ? formatISODate(date) : null })}
                                                    dateFormat="dd/MM/yyyy"
                                                    placeholderText="Date diagnosed"
                                                    showMonthDropdown
                                                    showYearDropdown
                                                    scrollableYearDropdown
                                                    yearDropdownItemNumber={120}
                                                    maxDate={new Date()}
                                                    minDate={dobDate || new Date("1900-01-01")}
                                                    disabled={condition.dateNotApplicable}
                                                    customInput={
                                                        <DateInputWithButton
                                                            className="pfm-input"
                                                            disabled={condition.dateNotApplicable}
                                                        />
                                                    }
                            />
                        </div>
                                            <label className="pfm-checkbox-wrap">
                                                <input
                                                    type="checkbox"
                                                    checked={condition.dateNotApplicable}
                                                    onChange={(e) =>
                                                        updateChronicCondition(index, {
                                                            dateNotApplicable: e.target.checked,
                                                            diagnosedDate: e.target.checked ? null : condition.diagnosedDate,
                                                        })
                                                    }
                                                />
                                                <span>Date N/A</span>
                                            </label>
                                            <button
                                                type="button"
                                                className="pfm-remove-condition"
                                                onClick={() => removeChronicCondition(index)}
                                                aria-label="Remove condition"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    <button type="button" className="pfm-add-condition" onClick={addChronicCondition}>
                                        <Plus size={20} />
                                        Add condition
                                    </button>
                                </div>
                        </div>

                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Past Conditions & Surgeries</label>
                            <textarea
                                    className="pfm-textarea"
                                rows={3}
                                value={form.surgicalHistory}
                                onChange={(e) => setField("surgicalHistory", e.target.value)}
                                    placeholder="Previous diagnoses, surgeries, procedures (with dates if known)"
                                />
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Hospitalizations</label>
                                <textarea
                                    className="pfm-textarea"
                                    rows={2}
                                    value={form.hospitalizations}
                                    onChange={(e) => setField("hospitalizations", e.target.value)}
                                    placeholder="Recent hospital admissions, A&E visits (with dates if known)"
                            />
                        </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Family medical history</label>
                            <textarea
                                    className="pfm-textarea"
                                    rows={2}
                                value={form.familyHistory}
                                onChange={(e) => setField("familyHistory", e.target.value)}
                                    placeholder="Relevant family history (e.g. dementia, cardiovascular)"
                            />
                        </div>
                            <div className="pfm-field pfm-span2">
                            <label className="pfm-label">Lifestyle factors</label>
                            <textarea
                                    className="pfm-textarea"
                                    rows={2}
                                value={form.lifestyleFactors}
                                onChange={(e) => setField("lifestyleFactors", e.target.value)}
                                    placeholder="e.g. Non-smoker, exercise, diet"
                            />
                        </div>
                        <div className="pfm-field pfm-span2">
                            <label className="pfm-label">Immunization history</label>
                            <textarea
                                    className="pfm-textarea"
                                    rows={2}
                                value={form.immunizations}
                                onChange={(e) => setField("immunizations", e.target.value)}
                                    placeholder="e.g. COVID-19, Influenza, Tetanus"
                                />
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Previous medications (discontinued)</label>
                                <textarea
                                    className="pfm-textarea"
                                    rows={2}
                                    value={form.previousMedications}
                                    onChange={(e) => setField("previousMedications", e.target.value)}
                                    placeholder="Medications no longer taken and reason if known"
                                />
                            </div>
                        </div>
                    </div>

                    <div data-section="Care & Emergency" className="pfm-section-wrap">
                        <div className="pfm-grid">
                            <div className="pfm-section-header pfm-span2">
                                <h3>Care preferences & emergency contact</h3>
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Preferred communication</label>
                                <div className="pfm-radio-group">
                                    {COMMUNICATION_OPTIONS.map((opt) => (
                                        <label key={opt.value} className="pfm-radio-wrap">
                                            <input
                                                type="radio"
                                                name="preferredCommunication"
                                                value={opt.value}
                                                checked={(form.preferredCommunication || "") === opt.value}
                                                onChange={() => setField("preferredCommunication", opt.value)}
                                            />
                                            <span>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Reminder notifications</label>
                                <p className="pfm-readonly-value" aria-live="polite">
                                    {(form.reminderNotificationChannel || "none") === "email"
                                        ? "Email"
                                        : (form.reminderNotificationChannel || "none") === "push"
                                            ? "In-app push"
                                            : "None"}
                                </p>
                                <div className="pfm-help-muted" style={{ marginTop: "0.25rem" }}>
                                    Set by the patient in the app (Profile). When Email or In-app push is on, they are notified when a reminder is due; if not completed, a follow-up is sent 15 minutes later.
                                </div>
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Care notes</label>
                                <textarea
                                    className="pfm-textarea"
                                    rows={3}
                                    value={form.careNotes}
                                    onChange={(e) => setField("careNotes", e.target.value)}
                                    placeholder="e.g. Prefers morning reminders. Enjoys crossword puzzles."
                                />
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Emergency contact</label>
                            </div>
                            <div className="pfm-field">
                                <label className="pfm-label">Contact name *</label>
                                <input
                                    className={`pfm-input ${fieldErrors.emergencyContactName ? "is-error" : ""}`}
                                    value={form.emergencyContactName}
                                    onChange={(e) => setField("emergencyContactName", e.target.value)}
                                    placeholder="Full name"
                                />
                                {fieldErrors.emergencyContactName && <div className="pfm-help">{fieldErrors.emergencyContactName}</div>}
                            </div>
                            <div className="pfm-field">
                                <label className="pfm-label">Relationship</label>
                                <select
                                    className="pfm-input pfm-select"
                                    value={form.emergencyContactRelationship}
                                    onChange={(e) => setField("emergencyContactRelationship", e.target.value)}
                                >
                                    {RELATIONSHIP_OPTIONS.map((opt) => (
                                        <option key={opt.value || "blank"} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Contact phone *</label>
                                <input
                                    className={`pfm-input ${fieldErrors.emergencyContactPhone ? "is-error" : ""}`}
                                    type="tel"
                                    value={form.emergencyContactPhone}
                                    onChange={(e) => setField("emergencyContactPhone", e.target.value)}
                                    placeholder="+44 7700 900000"
                                />
                                {fieldErrors.emergencyContactPhone && <div className="pfm-help">{fieldErrors.emergencyContactPhone}</div>}
                            </div>
                            <div className="pfm-field pfm-span2">
                                <label className="pfm-label">Additional emergency contacts (optional)</label>
                                <textarea
                                    className="pfm-textarea pfm-textarea-sm"
                                    rows={2}
                                    value={form.emergencyContact}
                                    onChange={(e) => setField("emergencyContact", e.target.value)}
                                    placeholder="Name — Phone (one per line)"
                                />
                            </div>
                        </div>
                    </div>

                    {isEdit && onArchivePatient && (
                        <div className="pfm-section-header pfm-span2" style={{ marginTop: "20px", paddingTop: "20px", borderTop: "2px solid #e9ecef" }}>
                            <h3>Archive patient</h3>
                            <div className="pfm-grid" style={{ marginTop: "12px" }}>
                                <div className="pfm-field">
                                    <label className="pfm-label">Reason</label>
                                    <select
                                        className="pfm-input pfm-select"
                                        value={archiveReason}
                                        onChange={(e) => setArchiveReason(e.target.value)}
                                        disabled={archiveLoading}
                                    >
                                        <option value="discharged">Discharged</option>
                                        <option value="transferred">Transferred</option>
                                        <option value="deceased">Deceased</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="pfm-field pfm-span2">
                                    <label className="pfm-label">Notes {archiveReason === "other" ? "*" : "(optional)"}</label>
                                    <textarea
                                        className="pfm-textarea pfm-textarea-sm"
                                        rows={2}
                                        value={archiveNotes}
                                        onChange={(e) => { setArchiveNotes(e.target.value); setArchiveError(""); }}
                                        placeholder={archiveReason === "other" ? "Please specify the reason..." : "e.g. Completed care programme"}
                                        disabled={archiveLoading}
                                    />
                                    {archiveReason === "other" && archiveError && <div className="pfm-help">{archiveError}</div>}
                                </div>
                                <div className="pfm-field pfm-span2">
                                    <button
                                        type="button"
                                        className="pfm-btn pfm-btn-danger"
                                        disabled={archiveLoading}
                                        onClick={async () => {
                                            if (archiveReason === "other" && !archiveNotes.trim()) {
                                                setArchiveError("Please add notes when selecting Other.");
                                                return;
                                            }
                                            if (!window.confirm(`Archive ${patient?.name ?? "this patient"}? You can restore them later.`)) return;
                                            setArchiveLoading(true);
                                            setArchiveError("");
                                            try {
                                                await onArchivePatient(patient.id, { archiveReason, notes: archiveNotes.trim() || null });
                                                onArchived?.();
                                                onClose?.();
                                            } catch (err) {
                                                setArchiveError(err?.message || "Unable to archive patient.");
                                            } finally {
                                                setArchiveLoading(false);
                                            }
                                        }}
                                    >
                                        {archiveLoading ? "Archiving…" : "Archive patient"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
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
