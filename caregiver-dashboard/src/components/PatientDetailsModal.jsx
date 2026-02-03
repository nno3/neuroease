import { Fragment, useState } from "react";
import {
    calcAge,
    formatDate,
    formatDateTime,
    getInitials,
    getAvatarColor,
    format3,
    parseMedicalHistory,
} from "../utils/patientHelpers";

/**
 * View-details modal for a single patient. Parent must import Patients.css for pm-* classes.
 * Props: patient, onClose, onEdit, onUnarchive (optional; (patientId, notes) => Promise)
 */
export default function PatientDetailsModal({ patient, onClose, onEdit, onUnarchive }) {
    const [restoreNotes, setRestoreNotes] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");

    if (!patient) return null;

    // Support nested (Patient / patient / profile) or flat patient object from API
    const profile = patient.Patient ?? patient.patient ?? patient.profile ?? patient;

    const handleUnarchive = async () => {
        if (!patient?.id || !onUnarchive) return;
        setActionLoading(true);
        setActionError("");
        try {
            await onUnarchive(patient.id, restoreNotes?.trim() || "Reactivated by caregiver");
            onClose?.();
        } catch (err) {
            setActionError(err?.message || "Unable to restore patient.");
        } finally {
            setActionLoading(false);
        }
    };

    const openEditFromDetails = () => {
        onClose?.();
        onEdit?.(patient);
    };

    const parseMh = (p) => {
        if (!p) return {};
        const raw = p.medicalHistory ?? p.medicalConditions;
        if (typeof raw === "string") {
            try {
                return raw.trim() ? JSON.parse(raw) : {};
            } catch {
                return {};
            }
        }
        if (raw && typeof raw === "object") return raw;
        return {};
    };

    return (
        <div className="pm-modal-overlay" onClick={onClose} role="presentation">
            <div className="pm-modal pm-modal-details" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pm-details-header">
                    <div className="pm-details-header-left">
                        {!patient.isArchived && (
                            <div
                                className="pm-details-avatar"
                                style={{ background: getAvatarColor(patient.id) }}
                            >
                                {getInitials(patient.name ?? "P")}
                            </div>
                        )}
                        <div className="pm-details-header-text">
                            <div className="pm-details-title">{patient.name ?? "Patient"}</div>
                            <div className="pm-details-subtitle">
                                ID {format3(patient.id)}
                                {!patient.isArchived && (
                                    <span className="pm-status is-active">
                                        <span className="pm-status-dot" />
                                        Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="pm-details-header-actions">
                        {!patient.isArchived && (
                            <button type="button" className="pm-btn pm-btn-outline" onClick={openEditFromDetails}>
                                Edit Profile
                            </button>
                        )}
                        <button type="button" className="pm-details-close" onClick={onClose} aria-label="Close">
                            ×
                        </button>
                    </div>
                </div>

                <div className="pm-modal-body pm-details-body">
                    {patient.isArchived ? (
                        <>
                            <div className="pm-details-grid">
                                <div className="pm-details-section-header">
                                    <h3>Archive Information</h3>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Added to your care</span>
                                    <div className="pm-detail-value">{formatDate(patient?.caregiver_patients?.createdAt) || "—"}</div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Reason</span>
                                    <div className="pm-detail-value">{patient.archiveReason ?? "—"}</div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Archived at</span>
                                    <div className="pm-detail-value">{formatDateTime(patient.archivedAt)}</div>
                                </div>
                                <div className="pm-detail-field pm-detail-span2">
                                    <span className="pm-detail-label">Notes</span>
                                    <div className="pm-detail-value">{patient.archiveNotes ?? "—"}</div>
                                </div>
                            </div>
                            <div className="pm-details-grid">
                                <div className="pm-details-section-header">
                                    <h3>Restore Patient</h3>
                                </div>
                                <div className="pm-detail-field pm-detail-span2">
                                    <span className="pm-detail-label">Restore notes (optional)</span>
                                    <textarea
                                        id="restoreNotes"
                                        className="pm-textarea"
                                        rows={3}
                                        value={restoreNotes}
                                        onChange={(e) => setRestoreNotes(e.target.value)}
                                        placeholder="e.g., Reactivated by caregiver"
                                    />
                                </div>
                                {actionError && (
                                    <div className="pm-detail-field pm-detail-span2">
                                        <div className="pm-inline-error">{actionError}</div>
                                    </div>
                                )}
                                <div className="pm-detail-field pm-detail-span2">
                                    <button
                                        type="button"
                                        className="pm-btn pm-btn-primary"
                                        onClick={handleUnarchive}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? "Restoring…" : "Restore (Unarchive)"}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="pm-details-grid">
                                <div className="pm-details-section-header">
                                    <h3>Personal Information</h3>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Age</span>
                                    <div className="pm-detail-value">
                                        {calcAge(profile?.dateOfBirth) != null
                                            ? `${calcAge(profile?.dateOfBirth)} years`
                                            : "—"}
                                    </div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Joined</span>
                                    <div className="pm-detail-value">
                                        {patient?.caregiver_patients?.createdAt
                                            ? formatDate(patient.caregiver_patients.createdAt)
                                            : "—"}
                                    </div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Date of Birth</span>
                                    <div className={`pm-detail-value ${!profile?.dateOfBirth ? "pm-detail-value-empty" : ""}`}>
                                        {formatDate(profile?.dateOfBirth) || "—"}
                                    </div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Gender</span>
                                    <div className={`pm-detail-value ${!(profile?.gender ?? "").trim() ? "pm-detail-value-empty" : ""}`}>
                                        {profile?.gender?.trim() || "—"}
                                    </div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Phone</span>
                                    <div className={`pm-detail-value ${!(profile?.phoneNumber ?? "").trim() ? "pm-detail-value-empty" : ""}`}>
                                        {profile?.phoneNumber?.trim() || "—"}
                                    </div>
                                </div>
                                <div className="pm-detail-field">
                                    <span className="pm-detail-label">Email</span>
                                    <div className={`pm-detail-value ${!(patient.email ?? "").trim() ? "pm-detail-value-empty" : ""}`}>
                                        {patient.email?.trim() || "—"}
                                    </div>
                                </div>
                                <div className="pm-detail-field pm-detail-span2">
                                    <span className="pm-detail-label">Address</span>
                                    <div className={`pm-detail-value ${!(profile?.address ?? "").trim() ? "pm-detail-value-empty" : ""}`}>
                                        {profile?.address?.trim() || "—"}
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const mh = parseMh(profile);
                                const diagnosis = (profile?.diagnosis ?? mh?.diagnosis ?? "").trim();
                                const diagnosisDate = mh?.diagnosisDate ?? profile?.diagnosisDate ?? null;
                                const stage = (profile?.stageSeverity ?? mh?.stageSeverity ?? "").trim();
                                const consultant = (profile?.primaryConsultant ?? mh?.primaryConsultant ?? "").trim();
                                const meds = (profile?.currentMedications ?? mh?.currentMedications ?? "").trim();
                                const allergies = (profile?.allergies ?? mh?.allergies ?? "").trim();
                                return (
                                    <div className="pm-details-grid">
                                        <div className="pm-details-section-header">
                                            <h3>Medical Information</h3>
                                        </div>
                                        <div className="pm-detail-field">
                                            <span className="pm-detail-label">Diagnosis</span>
                                            <div className={`pm-detail-value ${!diagnosis ? "pm-detail-value-empty" : ""}`}>{diagnosis || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field">
                                            <span className="pm-detail-label">Date diagnosed</span>
                                            <div className={`pm-detail-value ${!diagnosisDate ? "pm-detail-value-empty" : ""}`}>{formatDate(diagnosisDate) || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field">
                                            <span className="pm-detail-label">Stage</span>
                                            <div className={`pm-detail-value ${!stage ? "pm-detail-value-empty" : ""}`}>{stage || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Current medications</span>
                                            <div className={`pm-detail-value ${!meds ? "pm-detail-value-empty" : ""}`}>{meds || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Allergies & adverse reactions</span>
                                            <div className={`pm-detail-value ${!allergies ? "pm-detail-value-empty" : ""}`}>{allergies || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Primary Physician / Consultant</span>
                                            <div className={`pm-detail-value ${!consultant ? "pm-detail-value-empty" : ""}`}>{consultant || "—"}</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {(() => {
                                let medicalHistory = parseMh(profile);
                                if (!medicalHistory || typeof medicalHistory !== "object") medicalHistory = {};
                                const cc = medicalHistory.chronicConditions;
                                const hasCc = Array.isArray(cc) && cc.some((c) => c && (c.diagnosis || "").trim());
                                const surgical = (medicalHistory?.surgicalHistory ?? profile?.surgicalHistory ?? "").trim();
                                const hospitalizations = (medicalHistory?.hospitalizations ?? "").trim();
                                const family = (medicalHistory?.familyHistory ?? profile?.familyHistory ?? "").trim();
                                const lifestyle = (medicalHistory?.lifestyleFactors ?? profile?.lifestyleFactors ?? "").trim();
                                const immun = (medicalHistory?.immunizations ?? profile?.immunizations ?? "").trim();
                                const previousMeds = (medicalHistory?.previousMedications ?? "").trim();
                                const conditionsList = hasCc ? cc.filter((c) => c && (c.diagnosis || "").trim()) : [];
                                return (
                                    <div className="pm-details-grid">
                                        <div className="pm-details-section-header">
                                            <h3>Medical History</h3>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Past Conditions & Surgeries</span>
                                            <div className={`pm-detail-value ${!surgical ? "pm-detail-value-empty" : ""}`}>{surgical || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Hospitalizations</span>
                                            <div className={`pm-detail-value ${!hospitalizations ? "pm-detail-value-empty" : ""}`}>{hospitalizations || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Family medical history</span>
                                            <div className={`pm-detail-value ${!family ? "pm-detail-value-empty" : ""}`}>{family || "—"}</div>
                                        </div>
                                        {conditionsList.length > 0 && (
                                            <>
                                                <div className="pm-details-section-header" style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                                                    <h3>Chronic conditions</h3>
                                                </div>
                                                {conditionsList.map((c, i) => {
                                                    const label = (c.diagnosis || "").trim();
                                                    const dateVal = c.diagnosedDate ? formatDate(c.diagnosedDate) : (c.dateNotApplicable ? "Date N/A" : "—");
                                                    const dateEmpty = !c.diagnosedDate && !c.dateNotApplicable;
                                                    return (
                                                        <Fragment key={i}>
                                                            <div className="pm-detail-field">
                                                                <span className="pm-detail-label">Condition</span>
                                                                <div className="pm-detail-value">{label || "—"}</div>
                                                            </div>
                                                            <div className="pm-detail-field">
                                                                <span className="pm-detail-label">Date diagnosed</span>
                                                                <div className={`pm-detail-value ${dateEmpty ? "pm-detail-value-empty" : ""}`}>{dateVal}</div>
                                                            </div>
                                                        </Fragment>
                                                    );
                                                })}
                                            </>
                                        )}
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Lifestyle factors</span>
                                            <div className={`pm-detail-value ${!lifestyle ? "pm-detail-value-empty" : ""}`}>{lifestyle || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Immunization history</span>
                                            <div className={`pm-detail-value ${!immun ? "pm-detail-value-empty" : ""}`}>{immun || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Previous medications (discontinued)</span>
                                            <div className={`pm-detail-value ${!previousMeds ? "pm-detail-value-empty" : ""}`}>{previousMeds || "—"}</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {(() => {
                                const preferred = (profile?.preferredCommunication ?? "").trim();
                                const careNotes = (profile?.careNotes ?? "").trim();
                                const ecName = (profile?.emergencyContactName ?? "").trim();
                                const ecRel = (profile?.emergencyContactRelationship ?? "").trim();
                                const ecPhone = (profile?.emergencyContactPhone ?? "").trim();
                                const legacyEc = (profile?.emergencyContact ?? "").trim();
                                return (
                                    <div className="pm-details-grid">
                                        <div className="pm-details-section-header">
                                            <h3>Care & Emergency</h3>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Preferred contact</span>
                                            <div className={`pm-detail-value ${!preferred ? "pm-detail-value-empty" : ""}`}>{preferred || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Care notes</span>
                                            <div className={`pm-detail-value ${!careNotes ? "pm-detail-value-empty" : ""}`}>{careNotes || "—"}</div>
                                        </div>
                                        <div className="pm-detail-field pm-detail-span2">
                                            <span className="pm-detail-label">Emergency contact</span>
                                            <div className={`pm-detail-value ${!ecName && !ecPhone ? "pm-detail-value-empty" : ""}`}>
                                                {ecName || ecRel || ecPhone
                                                    ? [ecName, ecRel ? `(${ecRel})` : null, ecPhone].filter(Boolean).join(" ")
                                                    : legacyEc || "—"}
                                            </div>
                                        </div>
                                        {legacyEc && (ecName || ecPhone) && (
                                            <div className="pm-detail-field pm-detail-span2">
                                                <span className="pm-detail-label">Additional emergency contacts</span>
                                                <div className="pm-detail-value">{legacyEc}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

