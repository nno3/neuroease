import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getRemindersForPatient } from "../services/reminders";
import { getLatestLocation, getLocationAlerts, getSafeZones } from "../services/locationService";
import { getRecentGameSessions } from "../services/activityService";
import { getInitials, getAvatarColor } from "../utils/patientHelpers";
import {
    CalendarClock,
    Gamepad2,
    MapPin,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
} from "lucide-react";
const isReturnAlert = (a) => (a.message || "").toLowerCase().includes("returned");

/** Format duration in ms as "Xm" or "Xh Ym" for caregiver to see how long they were out. */
function formatDurationOutside(ms) {
    if (ms == null || ms < 0 || !Number.isFinite(ms)) return null;
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

/** For a "Returned" alert, find the most recent "Left" before it (by time) and return duration in ms. */
function getDurationOutsideMs(alerts, returnedAlert) {
    const retTime = returnedAlert.timestamp ? new Date(returnedAlert.timestamp).getTime() : null;
    if (retTime == null) return null;
    const leftsBefore = alerts
        .filter((a) => !isReturnAlert(a) && a.timestamp)
        .map((a) => ({ ...a, t: new Date(a.timestamp).getTime() }))
        .filter((a) => a.t < retTime)
        .sort((a, b) => b.t - a.t);
    const left = leftsBefore[0];
    if (!left) return null;
    return retTime - left.t;
}
import "./PatientActivityModal.css";

const DEFAULT_ZOOM = 13;

function createMarkerIcon(color) {
    return L.divIcon({
        className: "pa-map-marker",
        html: `<span style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:block"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

const iconInZone = createMarkerIcon("#22c55e");
const iconOutsideZone = createMarkerIcon("#ef4444");

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function isInsideZone(lat, lng, zone) {
    const centerLat = Number(zone.centerLat);
    const centerLng = Number(zone.centerLng);
    const radius = Number(zone.radius);
    if (Number.isNaN(centerLat) || Number.isNaN(centerLng) || Number.isNaN(radius)) return false;
    return haversineMeters(Number(lat), Number(lng), centerLat, centerLng) <= radius;
}

function formatReminderTime(d) {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
    });
}

/** Format completedAt for display: time only if same day as occurrence, else date + time. */
function formatCompletedAt(completedAt, effectiveScheduledTime) {
    if (!completedAt) return null;
    const d = new Date(completedAt);
    if (Number.isNaN(d.getTime())) return null;
    const effective = new Date(effectiveScheduledTime);
    const sameDay = d.getDate() === effective.getDate() && d.getMonth() === effective.getMonth() && d.getFullYear() === effective.getFullYear();
    if (sameDay) {
        return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** True if reminder is completed for this occurrence. Once: use isCompleted. Daily/weekly: completedAt on same calendar day. */
function isCompletedForOccurrence(reminder, effectiveScheduledTime) {
    if (!reminder) return false;
    if (reminder.recurrence === "once") return !!reminder.isCompleted;
    if (!reminder.completedAt) return false;
    const completed = new Date(reminder.completedAt);
    const effective = new Date(effectiveScheduledTime);
    return (
        completed.getDate() === effective.getDate() &&
        completed.getMonth() === effective.getMonth() &&
        completed.getFullYear() === effective.getFullYear()
    );
}

function reminderStatusForOccurrence(reminder, effectiveScheduledTime) {
    const now = new Date();
    const effective = new Date(effectiveScheduledTime);
    const completed = isCompletedForOccurrence(reminder, effective);
    if (completed) {
        if (reminder.completedAt && new Date(reminder.completedAt) > effective) return "completed-late";
        return "completed";
    }
    if (effective.getTime() < now.getTime()) return "overdue";
    return "pending";
}

const GAME_TYPE_LABELS = {
    memory: "Memory Match",
    math: "Math Practice",
    sequencing: "Sequencing",
};

const ALERT_FILTERS = [
    { value: "day", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
];

/** Monday of the week containing d (week = Mon–Sun). */
function getWeekStart(d) {
    const x = new Date(d);
    const day = x.getDay();
    const daysFromMonday = (day + 6) % 7;
    x.setDate(x.getDate() - daysFromMonday);
    x.setHours(0, 0, 0, 0);
    return x;
}

function filterAlertsByRange(alerts, range) {
    if (!Array.isArray(alerts) || alerts.length === 0) return [];
    const now = new Date();
    let start;
    let end;
    if (range === "day") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start);
        end.setDate(end.getDate() + 1);
    } else if (range === "week") {
        start = getWeekStart(now);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
    } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    return alerts.filter((a) => {
        const t = new Date(a.timestamp).getTime();
        return t >= start.getTime() && t < end.getTime();
    });
}

/** True if a reminder has an occurrence on the given date (same calendar day). */
function reminderOccursOnDate(reminder, date) {
    const scheduled = new Date(reminder.scheduledTime);
    const recurrence = reminder.recurrence || "once";
    if (recurrence === "once") {
        return scheduled.getDate() === date.getDate() &&
            scheduled.getMonth() === date.getMonth() &&
            scheduled.getFullYear() === date.getFullYear();
    }
    if (recurrence === "daily") return true;
    if (recurrence === "weekly") return scheduled.getDay() === date.getDay();
    return false;
}

/** True if a reminder has an occurrence in [startDate, endDate) (endDate exclusive). */
function reminderOccursInRange(reminder, startDate, endDate) {
    const scheduled = new Date(reminder.scheduledTime);
    const recurrence = reminder.recurrence || "once";
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (recurrence === "once") {
        const t = scheduled.getTime();
        return t >= startMs && t < endMs;
    }
    if (recurrence === "daily") {
        const today = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const todayEnd = new Date(today);
        todayEnd.setDate(todayEnd.getDate() + 1);
        return todayEnd.getTime() <= endMs;
    }
    if (recurrence === "weekly") {
        const dayOfWeek = scheduled.getDay();
        const d = new Date(startDate);
        while (d.getTime() < endMs) {
            if (d.getDay() === dayOfWeek) return true;
            d.setDate(d.getDate() + 1);
        }
        return false;
    }
    return false;
}

function filterRemindersByRange(reminders, range) {
    if (!Array.isArray(reminders) || reminders.length === 0) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    if (range === "day") {
        return reminders.filter((r) => reminderOccursOnDate(r, now));
    }
    if (range === "week") {
        return reminders.filter((r) => reminderOccursInRange(r, weekStart, weekEnd));
    }
    if (range === "month") {
        return reminders.filter((r) => reminderOccursInRange(r, monthStart, monthEnd));
    }
    return reminders;
}

/** Build list of { reminder, effectiveScheduledTime } — one per occurrence in the range. Daily shows each day; weekly each matching weekday; once once. */
function buildOccurrencesForRange(reminders, range) {
    if (!Array.isArray(reminders) || reminders.length === 0) return [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const hours = (r) => new Date(r.scheduledTime).getHours();
    const minutes = (r) => new Date(r.scheduledTime).getMinutes();
    const weekday = (r) => new Date(r.scheduledTime).getDay();

    const result = [];
    for (const r of reminders) {
        const recurrence = r.recurrence || "once";
        const h = hours(r);
        const m = minutes(r);

        if (recurrence === "once") {
            const t = new Date(r.scheduledTime).getTime();
            const inRange = (range === "day" && reminderOccursOnDate(r, now)) ||
                (range === "week" && t >= weekStart.getTime() && t < weekEnd.getTime()) ||
                (range === "month" && t >= monthStart.getTime() && t < monthEnd.getTime());
            if (inRange) result.push({ reminder: r, effectiveScheduledTime: r.scheduledTime });
            continue;
        }

        if (recurrence === "daily") {
            const startDate = range === "day" ? todayStart : range === "week" ? weekStart : monthStart;
            const endDate = range === "day"
                ? new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
                : range === "week"
                    ? weekEnd
                    : monthEnd;
            let d = new Date(startDate);
            while (d.getTime() < endDate.getTime()) {
                const occ = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
                result.push({ reminder: r, effectiveScheduledTime: occ.toISOString() });
                d.setDate(d.getDate() + 1);
            }
            continue;
        }

        if (recurrence === "weekly") {
            const targetWeekday = weekday(r);
            const startDate = range === "day" ? todayStart : range === "week" ? weekStart : monthStart;
            const end = range === "day"
                ? new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
                : range === "week"
                    ? weekEnd
                    : monthEnd;
            let d = new Date(startDate);
            while (d.getTime() < end.getTime()) {
                if (d.getDay() === targetWeekday) {
                    d.setHours(h, m, 0, 0);
                    result.push({ reminder: r, effectiveScheduledTime: d.toISOString() });
                }
                d.setDate(d.getDate() + 1);
            }
        }
    }
    return result.sort((a, b) => new Date(a.effectiveScheduledTime) - new Date(b.effectiveScheduledTime));
}

/**
 * Full patient activity: reminders list, game sessions, current location map, alert history with filter.
 */
export default function PatientActivityModal({ patient, onClose, onViewDetails }) {
    const patientId = patient?.id ?? patient?.patientId;
    const patientName = patient?.name ?? "Patient";

    const [reminders, setReminders] = useState([]);
    const [gameSessions, setGameSessions] = useState([]);
    const [location, setLocation] = useState(null);
    const [safeZones, setSafeZones] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [alertFilter, setAlertFilter] = useState("day");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const pid = patientId != null ? Number(patientId) : null;
        if (!pid || Number.isNaN(pid)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        Promise.allSettled([
            getRemindersForPatient(pid),
            getLatestLocation(pid).catch(() => null),
            getSafeZones(pid).catch(() => ({ data: [] })),
            getLocationAlerts(pid),
            getRecentGameSessions(20, pid),
        ]).then(([remRes, locRes, zonesRes, alertRes, gamesRes]) => {
            const remList = remRes.status === "fulfilled" ? remRes.value?.data ?? [] : [];
            setReminders(Array.isArray(remList) ? remList : []);

            if (locRes.status === "fulfilled" && locRes.value?.data) {
                const d = locRes.value.data;
                if (d.latitude != null && d.longitude != null) {
                    setLocation({ lat: d.latitude, lng: d.longitude, timestamp: d.timestamp });
                } else {
                    setLocation(null);
                }
            } else {
                setLocation(null);
            }

            const zonesList = zonesRes.status === "fulfilled" && zonesRes.value != null
                ? (Array.isArray(zonesRes.value?.data) ? zonesRes.value.data : (zonesRes.value?.data?.data ?? []))
                : [];
            setSafeZones(Array.isArray(zonesList) ? zonesList : []);

            if (alertRes.status === "fulfilled" && alertRes.value != null) {
                const r = alertRes.value;
                const list = Array.isArray(r?.data) ? r.data : (r?.data?.data ?? []);
                setAlerts(Array.isArray(list) ? list : []);
            } else {
                setAlerts([]);
            }

            if (gamesRes.status === "fulfilled" && gamesRes.value != null) {
                const r = gamesRes.value;
                const items = Array.isArray(r?.data?.items) ? r.data.items : (Array.isArray(r?.data) ? r.data : []);
                setGameSessions(items);
            } else {
                setGameSessions([]);
            }
        }).catch((err) => setError(err?.data?.message ?? err?.message ?? "Failed to load activity"))
            .finally(() => setLoading(false));
    }, [patientId]);

    const sortedReminders = useMemo(() => {
        return [...reminders].sort(
            (a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)
        );
    }, [reminders]);

    const filteredReminders = useMemo(
        () => filterRemindersByRange(sortedReminders, alertFilter),
        [sortedReminders, alertFilter]
    );

    const reminderOccurrences = useMemo(
        () => buildOccurrencesForRange(filteredReminders, alertFilter),
        [filteredReminders, alertFilter]
    );

    const filteredAlerts = useMemo(
        () => filterAlertsByRange(alerts, alertFilter),
        [alerts, alertFilter]
    );

    const filteredGameSessions = useMemo(() => {
        if (!gameSessions.length) return [];
        const now = new Date();
        let start, end;
        if (alertFilter === "day") {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(start);
            end.setDate(end.getDate() + 1);
        } else if (alertFilter === "week") {
            start = getWeekStart(now);
            end = new Date(start);
            end.setDate(end.getDate() + 7);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
        return gameSessions.filter((s) => {
            const t = new Date(s.timestamp || s.playedAt).getTime();
            return t >= start.getTime() && t < end.getTime();
        });
    }, [gameSessions, alertFilter]);

    const locationStatus = useMemo(() => {
        if (!location) return null;
        if (!safeZones.length) return "no-zones";
        const inAny = safeZones.some((z) => isInsideZone(location.lat, location.lng, z));
        return inAny ? "in" : "out";
    }, [location, safeZones]);

    if (!patient) return null;

    return (
        <div className="pa-modal-overlay" onClick={onClose} role="presentation">
            <div
                className="pa-modal pa-modal-full"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pa-modal-title"
            >
                <div className="pa-modal-header">
                    <div className="pa-header-left">
                        <div
                            className="pa-avatar"
                            style={{ background: getAvatarColor(patientId) }}
                        >
                            {getInitials(patientName)}
                        </div>
                        <div>
                            <h2 id="pa-modal-title" className="pa-title">
                                Patient activity
                            </h2>
                            <p className="pa-subtitle">{patientName}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="pa-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Period filter at top — applies to Scheduled reminders and Location alerts */}
                {!loading && !error && (
                    <div className="pa-filter-bar">
                        <span className="pa-filter-label">Period:</span>
                        <div className="pa-alert-filters">
                            {ALERT_FILTERS.map((f) => (
                                <button
                                    key={f.value}
                                    type="button"
                                    className={`pa-filter-btn ${alertFilter === f.value ? "pa-filter-btn-active" : ""}`}
                                    onClick={() => setAlertFilter(f.value)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pa-modal-body">
                    {loading && (
                        <p className="pa-loading">Loading activity…</p>
                    )}
                    {error && <p className="pa-error">{error}</p>}
                    {!loading && !error && (
                        <>
                            {/* Reminders — full list */}
                            <section className="pa-section">
                                <h3 className="pa-section-title">
                                    <CalendarClock size={18} aria-hidden /> Scheduled reminders
                                </h3>
                                {reminderOccurrences.length === 0 ? (
                                    <p className="pa-empty">
                                        {sortedReminders.length === 0
                                            ? "No reminders scheduled."
                                            : "No reminders in this period. Try \"This week\" or \"This month\" for more."}
                                    </p>
                                ) : (
                                    <ul className={`pa-reminder-list ${reminderOccurrences.length > 5 ? "pa-reminder-list--scroll" : ""}`}>
                                        {reminderOccurrences.map((occ) => {
                                            const r = occ.reminder;
                                            const effectiveTime = occ.effectiveScheduledTime;
                                            const status = reminderStatusForOccurrence(r, effectiveTime);
                                            const statusLabel = status === "completed-late" ? "Completed late" : status;
                                            const completedAtStr = status === "completed-late" && r.completedAt
                                                ? formatCompletedAt(r.completedAt, effectiveTime) : null;
                                            return (
                                                <li key={`${r.id}-${effectiveTime}`} className={`pa-reminder-item pa-reminder-${status}`}>
                                                    <span className="pa-reminder-icon">
                                                        {(status === "completed" || status === "completed-late") && <CheckCircle2 size={18} aria-hidden />}
                                                        {status === "overdue" && <XCircle size={18} aria-hidden />}
                                                        {status === "pending" && <Clock size={18} aria-hidden />}
                                                    </span>
                                                    <div className="pa-reminder-content">
                                                        <span className="pa-reminder-title">{r.title}</span>
                                                        <span className="pa-reminder-meta">
                                                            {formatReminderTime(effectiveTime)}
                                                            {r.reminderType && ` · ${r.reminderType}`}
                                                            {r.recurrence && r.recurrence !== "once" && ` · ${r.recurrence}`}
                                                            {completedAtStr && ` · Completed at ${completedAtStr}`}
                                                        </span>
                                                    </div>
                                                    <span className={`pa-reminder-badge pa-badge-${status}`}>
                                                        {statusLabel}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            {/* Games — real sessions */}
                            <section className="pa-section">
                                <h3 className="pa-section-title">
                                    <Gamepad2 size={18} aria-hidden /> Games
                                </h3>
                                {filteredGameSessions.length === 0 ? (
                                    <p className="pa-empty">
                                        {gameSessions.length === 0
                                            ? "No game sessions yet. Games will appear here once the patient plays them."
                                            : "No games played in this period. Try \u201CThis week\u201D or \u201CThis month\u201D for more."}
                                    </p>
                                ) : (
                                    <ul className={`pa-games-list ${filteredGameSessions.length > 5 ? "pa-games-list--scroll" : ""}`}>
                                        {filteredGameSessions.map((s, i) => {
                                            const label = GAME_TYPE_LABELS[s.gameType] || s.gameType;
                                            const mins = Math.floor((s.duration || 0) / 60);
                                            const secs = (s.duration || 0) % 60;
                                            const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                                            const accuracyStr = s.accuracy != null ? `${Math.round(s.accuracy * 100)}%` : null;
                                            const playedAt = s.timestamp || s.playedAt;
                                            const dateStr = playedAt
                                                ? new Date(playedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                                                : "—";
                                            return (
                                                <li key={s.id ?? i} className="pa-game-item">
                                                    <span className="pa-game-name">{label}</span>
                                                    <span className="pa-game-desc">
                                                        Score: {s.score ?? "—"}
                                                        {accuracyStr && ` · Accuracy: ${accuracyStr}`}
                                                        {` · ${durationStr}`}
                                                    </span>
                                                    <span className="pa-game-date">{dateStr}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            {/* Location & safe zones — status line + map + set safe zone */}
                            <section className="pa-section">
                                <div className="pa-section-head-row">
                                    <h3 className="pa-section-title">
                                        <MapPin size={18} aria-hidden /> Location &amp; safe zone
                                    </h3>
                                    {patientId != null && (
                                        <Link to={`/location?patientId=${patientId}`} className="pa-set-safe-zone-link" onClick={onClose}>
                                            Set safe zone
                                        </Link>
                                    )}
                                </div>
                                {location ? (
                                    <>
                                        {locationStatus != null && (
                                            <p className={`pa-location-status pa-location-status-${locationStatus}`}>
                                                {locationStatus === "in" && <><CheckCircle2 size={16} aria-hidden /> Currently in safe zone</>}
                                                {locationStatus === "out" && <><AlertTriangle size={16} aria-hidden /> Currently outside safe zone</>}
                                                {locationStatus === "no-zones" && <><Clock size={16} aria-hidden /> No safe zone set — add one on the Location page</>}
                                            </p>
                                        )}
                                        <div className="pa-map-wrap">
                                            <MapContainer
                                                center={[location.lat, location.lng]}
                                                zoom={DEFAULT_ZOOM}
                                                className="pa-map"
                                                scrollWheelZoom={false}
                                            >
                                                <TileLayer
                                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                />
                                                {safeZones.map((z) => (
                                                    <Circle
                                                        key={z.id}
                                                        center={[z.centerLat, z.centerLng]}
                                                        radius={z.radius}
                                                        pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.2, weight: 2 }}
                                                    >
                                                        <Popup><strong>{z.name}</strong><br />Radius: {z.radius} m</Popup>
                                                    </Circle>
                                                ))}
                                                <Marker
                                                    position={[location.lat, location.lng]}
                                                    icon={locationStatus === "in" ? iconInZone : iconOutsideZone}
                                                >
                                                    <Popup>
                                                        Last update: {location.timestamp ? new Date(location.timestamp).toLocaleString() : "—"}
                                                        {locationStatus === "in" && <><br />In safe zone</>}
                                                        {locationStatus === "out" && <><br />Outside safe zone</>}
                                                    </Popup>
                                                </Marker>
                                            </MapContainer>
                                        </div>
                                    </>
                                ) : (
                                    <p className="pa-empty">Location not available. Patient may have location sharing off or no data yet.</p>
                                )}
                            </section>

                            {/* Alerts list — all events kept (left + returned) so caregivers can spot patterns and duration */}
                            <section className="pa-section">
                                <h3 className="pa-section-title">
                                    <AlertTriangle size={18} aria-hidden /> Location alerts
                                </h3>
                                <p className="pa-alerts-intro">
                                    All events are kept: when they left the zone and when they returned, so you can spot patterns and how long they were out.
                                </p>
                                {filteredAlerts.length === 0 ? (
                                    <p className="pa-empty">No alerts in this period. Try &quot;This week&quot; or &quot;This month&quot; for more history.</p>
                                ) : (
                                    <ul className="pa-alert-list">
                                        {filteredAlerts.map((a) => {
                                            const returned = isReturnAlert(a);
                                            const atTime = a.timestamp ? new Date(a.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";
                                            const durationMs = returned ? getDurationOutsideMs(filteredAlerts, a) : null;
                                            const durationStr = durationMs != null ? formatDurationOutside(durationMs) : null;
                                            return (
                                                <li key={a.id} className={`pa-alert-item ${returned ? "pa-alert-item-returned" : ""}`}>
                                                    {returned ? (
                                                        <CheckCircle2 size={16} className="pa-alert-icon pa-alert-icon-returned" aria-hidden />
                                                    ) : (
                                                        <AlertTriangle size={16} className="pa-alert-icon" aria-hidden />
                                                    )}
                                                    <div className="pa-alert-content">
                                                        <span className="pa-alert-message">{a.message ?? "Left safe zone"}</span>
                                                        <span className="pa-alert-time">
                                                            {returned ? `Returned at ${atTime}` : `Left at ${atTime}`}
                                                        </span>
                                                        {returned && durationStr && (
                                                            <span className="pa-alert-duration">Was out for {durationStr}</span>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>
                        </>
                    )}
                </div>

                <div className="pa-modal-footer">
                    {onViewDetails && (
                        <button
                            type="button"
                            className="pa-btn pa-btn-primary"
                            onClick={() => {
                                onClose();
                                onViewDetails();
                            }}
                        >
                            View full profile
                        </button>
                    )}
                    <button type="button" className="pa-btn pa-btn-ghost" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
