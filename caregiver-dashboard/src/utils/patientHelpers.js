/* Shared helpers for patient cards and details (Dashboard, Patients) */

export function calcAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

export function getInitials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "P";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function format3(id) {
    if (id === null || id === undefined) return "000";
    return String(id).padStart(3, "0");
}

export function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr) {
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
export function getAvatarColor(id) {
    const n = Number(id);
    const idx = Number.isFinite(n) ? n % AVATAR_COLORS.length : 0;
    return AVATAR_COLORS[idx];
}

export function parseMedicalHistory(medicalConditions) {
    if (!medicalConditions) return {};
    try {
        return typeof medicalConditions === "string" ? JSON.parse(medicalConditions) : medicalConditions;
    } catch {
        return typeof medicalConditions === "string" ? { chronicConditions: medicalConditions } : {};
    }
}

/** Card preview: show main diagnosis only (not chronic conditions). */
export function getMedicalConditionsDisplay(medicalHistoryOrConditions) {
    if (medicalHistoryOrConditions == null) return "";
    const raw = medicalHistoryOrConditions;
    if (typeof raw === "string" && raw.trim() === "[object Object]") return "";
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed !== "object") return "";
        const diagnosis = parsed.diagnosis && String(parsed.diagnosis).trim();
        if (diagnosis) return diagnosis;
        return "";
    } catch {
        return "";
    }
}
