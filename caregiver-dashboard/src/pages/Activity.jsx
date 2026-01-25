import { useEffect, useMemo, useState, forwardRef } from "react";
import { Link } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Activity.css";
import { Calendar as CalendarIcon, RefreshCw, ClipboardList, Pill, CalendarDays, CheckCircle2, AlertTriangle, Clock3,} from "lucide-react";
import { getPatients } from "../services/patients";

function format3(id) {
    if (id === null || id === undefined) return "000";
    return String(id).padStart(3, "0");
}

function safeDate(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toISODateOnly(d) {
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d, n) {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

function dateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function typeLabel(v) {
    if (v === "medication") return "Medication";
    if (v === "appointment") return "Appointment";
    return "Task";
}

function TypeIcon({ type, size = 16 }) {
    if (type === "medication") return <Pill size={size} />;
    if (type === "appointment") return <CalendarDays size={size} />;
    return <ClipboardList size={size} />;
}

function statusLabel(v) {
    if (v === "completed") return "Completed";
    if (v === "missed") return "Missed";
    return "Pending";
}

function StatusIcon({ status, size = 16 }) {
    if (status === "completed") return <CheckCircle2 size={size} />;
    if (status === "missed") return <AlertTriangle size={size} />;
    return <Clock3 size={size} />;
}

/** Custom input to match your older Patient date picker style */
const DateInputWithButton = forwardRef(
    ({ value, onClick, onChange, placeholder, className, disabled }, ref) => (
        <div className={`act-datewrap ${disabled ? "is-disabled" : ""}`}>
            <input
                ref={ref}
                className={className}
                value={value || ""}
                onChange={onChange} // allow typing
                onClick={onClick} // open calendar
                placeholder={placeholder}
                disabled={disabled}
            />
            <button
                type="button"
                className="act-calbtn"
                onClick={onClick}
                disabled={disabled}
                aria-label="Open calendar"
                title="Open calendar"
            >
                <CalendarIcon size={18} />
            </button>
        </div>
    )
);
DateInputWithButton.displayName = "DateInputWithButton";

const TYPES = [
    { label: "All", value: "all" },
    { label: "Medication", value: "medication" },
    { label: "Appointments", value: "appointment" },
    { label: "Tasks", value: "general" },
];

function makeMockRows({ patients, patientId, type, fromDate, toDate }) {
    const names =
        patients?.length
            ? patients.map((p) => ({ id: p.id, name: p.name }))
            : [
                { id: 101, name: "Patient A" },
                { id: 102, name: "Patient B" },
                { id: 103, name: "Patient C" },
            ];

    const chosen = patientId === "all" ? names : names.filter((x) => String(x.id) === String(patientId));

    const start = startOfDay(fromDate);
    const end = endOfDay(toDate);

    const poolTitles = {
        medication: ["Take medication", "Vitamin dose", "Blood pressure pill"],
        appointment: ["Clinic appointment", "Doctor check-up", "Physio session"],
        general: ["Hydration reminder", "Walk 10 minutes", "Cognitive exercise"],
    };

    const statuses = ["pending", "completed", "missed"];

    const out = [];
    let cur = new Date(start);
    while (cur <= end) {
        const count = 1 + (cur.getDate() % 3);
        for (let i = 0; i < count; i++) {
            const patient = chosen[(cur.getDate() + i) % chosen.length];
            const t =
                type !== "all"
                    ? type
                    : ["medication", "appointment", "general"][(cur.getDate() + i) % 3];

            const title = poolTitles[t][(cur.getDate() + i) % poolTitles[t].length];
            const occursAt = new Date(cur);
            occursAt.setHours(9 + ((i * 3) % 8), (i * 15) % 60, 0, 0);

            out.push({
                reminderId: `mock-${dateKey(cur)}-${i}`,
                title,
                reminderType: t,
                patientId: patient.id,
                patientName: patient.name,
                occursAt: occursAt.toISOString(),
                status: statuses[(cur.getDate() + i) % statuses.length],
            });
        }
        cur = addDays(cur, 1);
    }

    const filtered = out.filter((r) => {
        const matchesPatient = patientId === "all" ? true : String(r.patientId) === String(patientId);
        const matchesType = type === "all" ? true : r.reminderType === type;
        return matchesPatient && matchesType;
    });

    filtered.sort((a, b) => new Date(a.occursAt) - new Date(b.occursAt));
    return filtered;
}

export default function Activity() {
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("all");
    const [type, setType] = useState("all");

    const today = useMemo(() => new Date(), []);
    const [fromDate, setFromDate] = useState(() => addDays(today, -13));
    const [toDate, setToDate] = useState(() => today);

    const [rows, setRows] = useState([]);
    const [usingMock, setUsingMock] = useState(true);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const pRes = await getPatients();
                const list = pRes?.data?.patients ?? pRes?.data?.data?.patients ?? pRes?.data?.data ?? [];
                setPatients(Array.isArray(list) ? list : []);
            } catch {
                setPatients([]);
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError("");

            const safeFrom = fromDate ? startOfDay(fromDate) : addDays(new Date(), -13);
            const safeTo = toDate ? endOfDay(toDate) : endOfDay(new Date());

            if (safeFrom > safeTo) {
                setError("The 'From' date cannot be after the 'To' date.");
                setRows([]);
                setLoading(false);
                setUsingMock(true);
                return;
            }

            const params = new URLSearchParams({
                patientId: String(patientId),
                type: String(type),
                from: toISODateOnly(safeFrom),
                to: toISODateOnly(safeTo),
            });

            try {
                const token =
                    localStorage.getItem("token") ||
                    localStorage.getItem("authToken") ||
                    localStorage.getItem("accessToken");

                const res = await fetch(`/api/activity?${params.toString()}`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    credentials: "include",
                });

                if (!res.ok) throw new Error(`Activity API unavailable (${res.status})`);

                const json = await res.json();
                const occ = json?.data?.occurrences ?? [];

                const normalized = Array.isArray(occ)
                    ? occ.map((o) => ({
                        reminderId: o.reminderId ?? o.id ?? `${o.reminderId}-${o.occursAt}`,
                        title: o.title ?? "Reminder",
                        reminderType: o.reminderType ?? "general",
                        patientId: o.patientId ?? null,
                        patientName: o.patientName ?? "Patient",
                        occursAt: o.occursAt ?? o.scheduledTime ?? new Date().toISOString(),
                        status: o.status ?? "pending",
                    }))
                    : [];

                setRows(normalized);
                setUsingMock(false);
            } catch {
                const mock = makeMockRows({
                    patients,
                    patientId,
                    type,
                    fromDate: safeFrom,
                    toDate: safeTo,
                });
                setRows(mock);
                setUsingMock(true);
            } finally {
                setLoading(false);
            }
        })();
    }, [patients, patientId, type, fromDate, toDate, refreshKey]);

    const dateRangeLabel = useMemo(() => {
        const f = fromDate ? fromDate.toLocaleDateString("en-GB") : "—";
        const t = toDate ? toDate.toLocaleDateString("en-GB") : "—";
        return `${f} → ${t}`;
    }, [fromDate, toDate]);

    const summary = useMemo(() => {
        const s = {
            total: rows.length,
            byStatus: { completed: 0, pending: 0, missed: 0 },
            byType: { medication: 0, appointment: 0, general: 0 },
        };
        rows.forEach((r) => {
            const st = r.status || "pending";
            s.byStatus[st] = (s.byStatus[st] || 0) + 1;
            const ty = r.reminderType || "general";
            s.byType[ty] = (s.byType[ty] || 0) + 1;
        });
        return s;
    }, [rows]);

    const timeseries = useMemo(() => {
        const f = fromDate ? startOfDay(fromDate) : addDays(new Date(), -13);
        const t = toDate ? endOfDay(toDate) : endOfDay(new Date());

        const map = new Map();
        let cur = new Date(f);
        while (cur <= t) {
            const k = dateKey(cur);
            map.set(k, { date: k, completed: 0, pending: 0, missed: 0, total: 0 });
            cur = addDays(cur, 1);
        }

        rows.forEach((r) => {
            const d = safeDate(r.occursAt);
            if (!d) return;
            const k = dateKey(d);
            if (!map.has(k)) return;
            const entry = map.get(k);
            const st = r.status || "pending";
            entry[st] = (entry[st] || 0) + 1;
            entry.total += 1;
            map.set(k, entry);
        });

        return Array.from(map.values());
    }, [rows, fromDate, toDate]);

    const maxDaily = useMemo(() => Math.max(1, ...timeseries.map((d) => d.total)), [timeseries]);

    const selectedPatientName = useMemo(() => {
        if (patientId === "all") return "All patients";
        const p = patients.find((x) => String(x.id) === String(patientId));
        return p?.name ?? `Patient ${patientId}`;
    }, [patients, patientId]);

    return (
        <div className="act-page">
            <div className="act-topbar">
                <div>
                    <h1 className="act-title">Activity Monitoring</h1>
                    <p className="act-subtitle">Review scheduled activity from reminders and track adherence over time.</p>
                </div>

                <div className="act-actions">
                    <Link className="act-link" to="/patients">
                        Manage patients
                    </Link>

                    <button
                        className="act-btn"
                        type="button"
                        onClick={() => setRefreshKey((k) => k + 1)}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                        <span>{loading ? "Refreshing…" : "Refresh"}</span>
                    </button>
                </div>
            </div>

            <div className="act-panel">
                <div className="act-panel-head">
                    <div>
                        <div className="act-panel-title">Filters</div>
                        <div className="act-panel-meta">
                            Patient: <b>{selectedPatientName}</b> • Range: <b>{dateRangeLabel}</b>
                            {usingMock && <span className="act-pill act-pill--warn">Mock data</span>}
                            {!usingMock && <span className="act-pill act-pill--ok">Live</span>}
                        </div>
                    </div>
                </div>

                <div className="act-controls">
                    <div className="act-control">
                        <label className="act-label">Patient</label>
                        <select className="act-select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                            <option value="all">All patients</option>
                            {patients.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                    {p.name} (ID {format3(p.id)})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="act-control act-control--tabs">
                        <label className="act-label">Type</label>
                        <div className="act-tabs">
                            {TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    className={`act-tab ${type === t.value ? "is-active" : ""}`}
                                    onClick={() => setType(t.value)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="act-control">
                        <label className="act-label">From</label>
                        <DatePicker
                            selected={fromDate}
                            onChange={(d) => setFromDate(d)}
                            dateFormat="dd/MM/yyyy"
                            placeholderText="DD/MM/YYYY"
                            maxDate={toDate || new Date()}
                            calendarStartDay={1}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            scrollableYearDropdown
                            yearDropdownItemNumber={120}
                            customInput={<DateInputWithButton className="act-input" />}
                        />
                    </div>

                    <div className="act-control">
                        <label className="act-label">To</label>
                        <DatePicker
                            selected={toDate}
                            onChange={(d) => setToDate(d)}
                            dateFormat="dd/MM/yyyy"
                            placeholderText="DD/MM/YYYY"
                            minDate={fromDate || undefined}
                            maxDate={new Date()}
                            calendarStartDay={1}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            scrollableYearDropdown
                            yearDropdownItemNumber={120}
                            customInput={<DateInputWithButton className="act-input" />}
                        />
                    </div>
                </div>

                {error && <div className="act-error">{error}</div>}

                <div className="act-content">
                    <div className="act-kpis">
                        <div className="act-kpi">
                            <div className="act-kpi-label">Total items</div>
                            <div className="act-kpi-value">{summary.total}</div>
                        </div>
                        <div className="act-kpi">
                            <div className="act-kpi-label">Completed</div>
                            <div className="act-kpi-value">{summary.byStatus.completed}</div>
                        </div>
                        <div className="act-kpi">
                            <div className="act-kpi-label">Pending</div>
                            <div className="act-kpi-value">{summary.byStatus.pending}</div>
                        </div>
                        <div className="act-kpi">
                            <div className="act-kpi-label">Missed</div>
                            <div className="act-kpi-value">{summary.byStatus.missed}</div>
                        </div>
                    </div>

                    <div className="act-charts">
                        <div className="act-chart">
                            <div className="act-chart-head">
                                <div className="act-chart-title">Daily activity volume</div>
                                <div className="act-chart-sub">Stacked (Completed / Pending / Missed)</div>
                            </div>

                            <div className="act-bars" role="img" aria-label="Daily activity chart">
                                {timeseries.map((d) => {
                                    const hTotal = (d.total / maxDaily) * 100;
                                    const hCompleted = d.total ? (d.completed / d.total) * 100 : 0;
                                    const hPending = d.total ? (d.pending / d.total) * 100 : 0;
                                    const hMissed = d.total ? (d.missed / d.total) * 100 : 0;

                                    return (
                                        <div key={d.date} className="act-barcol" title={`${d.date} • total ${d.total}`}>
                                            <div className="act-bar" style={{ height: `${hTotal}%` }}>
                                                <div className="act-bar-seg is-completed" style={{ height: `${hCompleted}%` }} />
                                                <div className="act-bar-seg is-pending" style={{ height: `${hPending}%` }} />
                                                <div className="act-bar-seg is-missed" style={{ height: `${hMissed}%` }} />
                                            </div>
                                            <div className="act-barlabel">{d.date.slice(8, 10)}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="act-legend">
                                <div className="act-legend-item">
                                    <span className="act-dot is-completed" /> Completed
                                </div>
                                <div className="act-legend-item">
                                    <span className="act-dot is-pending" /> Pending
                                </div>
                                <div className="act-legend-item">
                                    <span className="act-dot is-missed" /> Missed
                                </div>
                            </div>
                        </div>

                        <div className="act-chart">
                            <div className="act-chart-head">
                                <div className="act-chart-title">Breakdown by type</div>
                                <div className="act-chart-sub">Medication / Appointment / Task</div>
                            </div>

                            <div className="act-typebars">
                                {["medication", "appointment", "general"].map((t) => {
                                    const val = summary.byType[t] || 0;
                                    const pct = summary.total ? Math.round((val / summary.total) * 100) : 0;
                                    return (
                                        <div key={t} className="act-typebar">
                                            <div className={`act-typebar-icon is-${t}`}>
                                                <TypeIcon type={t} />
                                            </div>
                                            <div className="act-typebar-main">
                                                <div className="act-typebar-top">
                                                    <span className="act-typebar-title">{typeLabel(t)}</span>
                                                    <span className="act-typebar-meta">
                            {val} • {pct}%
                          </span>
                                                </div>
                                                <div className="act-typebar-track">
                                                    <div className={`act-typebar-fill is-${t}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="act-listpanel">
                        <div className="act-listhead">
                            <div className="act-listtitle">Activity list</div>
                            <div className="act-listmeta">{loading ? "Loading…" : `${rows.length} items`}</div>
                        </div>

                        {loading ? (
                            <div className="act-state">Loading activity…</div>
                        ) : rows.length === 0 ? (
                            <div className="act-state">No activity found for the current filters.</div>
                        ) : (
                            <div className="act-list">
                                {rows.map((r) => {
                                    const occursAt = safeDate(r.occursAt);
                                    const timeStr = occursAt
                                        ? occursAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                                        : "—";
                                    const dateStr = occursAt
                                        ? occursAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                        : "—";

                                    return (
                                        <div className="act-card" key={r.reminderId}>
                                            <div className={`act-iconbox is-${r.reminderType || "general"}`}>
                                                <TypeIcon type={r.reminderType || "general"} size={18} />
                                            </div>

                                            <div className="act-card-main">
                                                <div className="act-card-title">{r.title}</div>

                                                <div className="act-lines">
                                                    <div className="act-line">
                                                        <span className="act-line-label">Patient:</span>
                                                        <span className="act-line-value">{r.patientName || "Patient"}</span>
                                                    </div>

                                                    <div className="act-line">
                                                        <span className="act-line-label">When:</span>
                                                        <span className="act-line-value">
                              {dateStr} • {timeStr}
                            </span>
                                                    </div>

                                                    <div className="act-line">
                                                        <span className="act-line-label">Type:</span>
                                                        <span className="act-line-value">{typeLabel(r.reminderType || "general")}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`act-status is-${r.status || "pending"}`}>
                                                <StatusIcon status={r.status || "pending"} />
                                                <span>{statusLabel(r.status || "pending")}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="act-footnote">
                        once backend endpoint exists (GET /api/activity), the page automatically switches from Mock → Live.
                    </div>
                </div>
            </div>
        </div>
    );
}