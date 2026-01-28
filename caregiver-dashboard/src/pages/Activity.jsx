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
    if (v === "overdue" || v === "missed") return "Overdue";
    return "Pending";
}

function StatusIcon({ status, size = 16 }) {
    if (status === "completed") return <CheckCircle2 size={size} />;
    if (status === "overdue" || status === "missed") return <AlertTriangle size={size} />;
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

function normalizeStatusForCharts(s) {
    if (s === "completed") return "completed";
    if (s === "overdue" || s === "missed") return "overdue";
    return "pending";
}

function normalizeType(t) {
    return t === "medication" || t === "appointment" || t === "general" ? t : "general";
}

function initBreakdown() {
    return {
        medication: { total: 0, completed: 0, pending: 0, overdue: 0 },
        appointment: { total: 0, completed: 0, pending: 0, overdue: 0 },
        general: { total: 0, completed: 0, pending: 0, overdue: 0 },
    };
}

function buildEmptySeries(rangeStart, rangeEnd) {
    const out = [];
    const dayStart = startOfDay(rangeStart);
    const dayEnd = startOfDay(rangeEnd);
    for (let cur = new Date(dayStart); cur <= dayEnd; cur = addDays(cur, 1)) {
        out.push({ date: dateKey(cur), completed: 0, pending: 0, overdue: 0, total: 0 });
    }
    return out;
}

function buildAggregatesFromRows(rows, rangeStart, rangeEnd) {
    const seriesMap = new Map();
    const dayStart = startOfDay(rangeStart);
    const dayEnd = startOfDay(rangeEnd);

    for (let cur = new Date(dayStart); cur <= dayEnd; cur = addDays(cur, 1)) {
        const k = dateKey(cur);
        seriesMap.set(k, { date: k, completed: 0, pending: 0, overdue: 0, total: 0 });
    }

    const breakdownByType = initBreakdown();
    const totals = { total: 0, completed: 0, pending: 0, overdue: 0 };

    rows.forEach((r) => {
        const d = safeDate(r.occursAt);
        if (!d) return;
        const k = dateKey(d);
        if (!seriesMap.has(k)) return;

        const st = normalizeStatusForCharts(r.status);
        const entry = seriesMap.get(k);
        entry[st] += 1;
        entry.total += 1;
        seriesMap.set(k, entry);

        const ty = normalizeType(r.reminderType);
        breakdownByType[ty][st] += 1;
        breakdownByType[ty].total += 1;

        totals[st] += 1;
        totals.total += 1;
    });

    const seriesByDay = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return { seriesByDay, breakdownByType, totals };
}

export default function Activity() {
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("all");
    const [type, setType] = useState("all");

    const today = useMemo(() => new Date(), []);
    const [fromDate, setFromDate] = useState(() => addDays(today, -13));
    const [toDate, setToDate] = useState(() => today);

    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState("");
    const [summaryData, setSummaryData] = useState(null); // { seriesByDay, breakdownByType, totals, meta... }

    const [refreshKey, setRefreshKey] = useState(0);

    const LOG_LIMIT = 25;
    const [logItems, setLogItems] = useState([]);
    const [logPage, setLogPage] = useState(1);
    const [logHasMore, setLogHasMore] = useState(false);
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState("");

    useEffect(() => {
        setLogPage(1);
        setLogItems([]);
    }, [patientId, type, fromDate, toDate, refreshKey]);

    useEffect(() => {
        const ac = new AbortController();

        (async () => {
            setLogLoading(true);
            setLogError("");

            const safeFrom = fromDate ? startOfDay(fromDate) : addDays(new Date(), -13);
            const safeTo = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const params = new URLSearchParams({
                patientId: String(patientId),
                type: String(type),
                from: toISODateOnly(safeFrom),
                to: toISODateOnly(safeTo),
                page: String(logPage),
                limit: String(LOG_LIMIT),
            });

            try {
                const token =
                    localStorage.getItem("token") ||
                    localStorage.getItem("authToken") ||
                    localStorage.getItem("accessToken");

                const res = await fetch(`/api/activity/log?${params.toString()}`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    credentials: "include",
                    signal: ac.signal,
                });

                if (!res.ok) {
                    let msg = `Activity log error (${res.status})`;
                    try {
                        const j = await res.json();
                        msg = j?.message || msg;
                    } catch {}
                    throw new Error(msg);
                }

                const json = await res.json();
                const data = json?.data ?? json;

                const items = Array.isArray(data?.items) ? data.items : [];
                const hasMore = Boolean(data?.hasMore);

                setLogItems((prev) => (logPage === 1 ? items : [...prev, ...items]));
                setLogHasMore(hasMore);
            } catch (e) {
                if (e?.name === "AbortError") return;
                setLogError(e?.message || "Unable to load activity log.");
            } finally {
                setLogLoading(false);
            }
        })();

        return () => ac.abort();
    }, [patientId, type, fromDate, toDate, refreshKey, logPage]);


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
        const ac = new AbortController();

        (async () => {
            setSummaryLoading(true);
            setSummaryError("");

            const safeFrom = fromDate ? startOfDay(fromDate) : addDays(new Date(), -13);
            const safeTo = toDate ? endOfDay(toDate) : endOfDay(new Date());

            if (safeFrom > safeTo) {
                setSummaryError("The 'From' date cannot be after the 'To' date.");
                setSummaryData(null);
                setSummaryLoading(false);
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

                const res = await fetch(`/api/activity/summary?${params.toString()}`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    credentials: "include",
                    signal: ac.signal,
                });

                if (!res.ok) {
                    let msg = `Activity Summary API error (${res.status})`;
                    try {
                        const j = await res.json();
                        msg = j?.message || msg;
                    } catch {
                        // ignore
                    }
                    throw new Error(msg);
                }

                const json = await res.json();
                const data = json?.data;

                // basic shape guard
                if (!data || !Array.isArray(data.seriesByDay) || !data.breakdownByType || !data.totals) {
                    throw new Error("Activity Summary API returned unexpected data.");
                }

                setSummaryData(data);
            } catch (e) {
                if (e?.name === "AbortError") return;
                setSummaryData(null);
                setSummaryError(e?.message || "Unable to load activity summary.");
            } finally {
                setSummaryLoading(false);
            }
        })();

        return () => ac.abort();
    }, [patientId, type, fromDate, toDate, refreshKey]);

    const dateRangeLabel = useMemo(() => {
        const f = fromDate ? fromDate.toLocaleDateString("en-GB") : "—";
        const t = toDate ? toDate.toLocaleDateString("en-GB") : "—";
        return `${f} → ${t}`;
    }, [fromDate, toDate]);

    const selectedPatientName = useMemo(() => {
        if (patientId === "all") return "All patients";
        const p = patients.find((x) => String(x.id) === String(patientId));
        return p?.name ?? `Patient ${patientId}`;
    }, [patients, patientId]);

    const chartAgg = useMemo(() => {
        if (summaryData) {
            return {
                seriesByDay: summaryData.seriesByDay,
                breakdownByType: summaryData.breakdownByType,
                totals: summaryData.totals,
                usingLiveSummary: true,
            };
        }

        return {
            seriesByDay: buildEmptySeries(startOfDay(fromDate || new Date()), endOfDay(toDate || new Date())),
            breakdownByType: initBreakdown(),
            totals: { total: 0, completed: 0, pending: 0, overdue: 0 },
            usingLiveSummary: false,
        };
    }, [summaryData, fromDate, toDate]);

    const seriesByDay = chartAgg.seriesByDay || buildEmptySeries(startOfDay(fromDate || new Date()), endOfDay(toDate || new Date()));
    const breakdownByType = chartAgg.breakdownByType || initBreakdown();
    const totals = chartAgg.totals || { total: 0, completed: 0, pending: 0, overdue: 0 };

    const maxDaily = useMemo(
        () => Math.max(1, ...seriesByDay.map((d) => d.total || 0)),
        [seriesByDay]
    );

    return (
        <div className="act-page">
            <div className="act-topbar">
                <div>
                    <h1 className="act-title">Activity Monitoring</h1>
                    <p className="act-subtitle">
                        Review scheduled activity from reminders and track adherence over time.
                    </p>
                </div>

                <div className="act-actions">
                    <Link className="act-link" to="/patients">
                        Manage patients
                    </Link>

                    <button
                        className="act-btn"
                        type="button"
                        onClick={() => setRefreshKey((k) => k + 1)}
                        disabled={logLoading || summaryLoading}
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                        <span>{logLoading || summaryLoading ? "Refreshing…" : "Refresh"}</span>
                    </button>
                </div>
            </div>

            <div className="act-panel">
                <div className="act-panel-head">
                    <div>
                        <div className="act-panel-title">Filters</div>
                        <div className="act-panel-meta">
                            Patient: <b>{selectedPatientName}</b> • Range: <b>{dateRangeLabel}</b>
                            {!chartAgg.usingLiveSummary && <span className="act-pill act-pill--warn">Mock charts</span>}
                            {chartAgg.usingLiveSummary && <span className="act-pill act-pill--ok">Live charts</span>}
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

                {(logError || summaryError) && <div className="act-error">{logError || summaryError}</div>}

                <div className="act-content">
                    <div className="act-kpis">
                        <div className="act-kpi">
                            <div className="act-kpi-label">Total items</div>
                            <div className="act-kpi-value">{totals.total}</div>
                        </div>
                        <div className="act-kpi">
                            <div className="act-kpi-label">Completed</div>
                            <div className="act-kpi-value">{totals.completed}</div>
                        </div>
                        <div className="act-kpi">
                            <div className="act-kpi-label">Pending</div>
                            <div className="act-kpi-value">{totals.pending}</div>
                        </div>
                        <div className="act-kpi">
                            <div className="act-kpi-label">Overdue</div>
                            <div className="act-kpi-value">{totals.overdue}</div>
                        </div>
                    </div>

                    <div className="act-charts">
                        <div className="act-chart">
                            <div className="act-chart-head">
                                <div className="act-chart-title">Reminder adherence trend</div>
                                <div className="act-chart-sub">Stacked (Completed / Pending / Overdue)</div>
                            </div>

                            {summaryLoading ? (
                                <div className="act-state">Loading charts…</div>
                            ) : seriesByDay.length === 0 ? (
                                <div className="act-state">No chart data for this range.</div>
                            ) : (
                                <>
                                    <div className="act-bars" role="img" aria-label="Adherence trend chart">
                                        {seriesByDay.map((d) => {
                                            const total = Number(d.total || 0);
                                            const completed = Number(d.completed || 0);
                                            const pending = Number(d.pending || 0);
                                            const overdue = Number(d.overdue || 0);
                                            const hTotal = (total / maxDaily) * 100;
                                            const hCompleted = total ? (completed / total) * 100 : 0;
                                            const hPending = total ? (pending / total) * 100 : 0;
                                            const hOverdue = total ? (overdue / total) * 100 : 0;

                                            return (
                                                <div key={d.date} className="act-barcol"
                                                     title={`${d.date}\nTotal: ${total}\nCompleted: ${completed}\nPending: ${pending}\nOverdue: ${overdue}`}>
                                                    <div className="act-bar" style={{height: `${hTotal}%`}}>
                                                        <div className="act-bar-seg is-completed"
                                                             style={{height: `${hCompleted}%`}}/>
                                                        <div className="act-bar-seg is-pending"
                                                             style={{height: `${hPending}%`}}/>
                                                        <div className="act-bar-seg is-overdue"
                                                             style={{height: `${hOverdue}%`}}/>
                                                    </div>
                                                    <div className="act-barlabel">{d.date.slice(8, 10)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="act-legend">
                                        <div className="act-legend-item">
                                            <span className="act-dot is-completed"/> Completed
                                        </div>
                                        <div className="act-legend-item">
                                            <span className="act-dot is-pending"/> Pending
                                        </div>
                                        <div className="act-legend-item">
                                            <span className="act-dot is-overdue"/> Overdue
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="act-chart">
                            <div className="act-chart-head">
                                <div className="act-chart-title">Breakdown by reminder type</div>
                                <div className="act-chart-sub">Medication / Appointment / Task</div>
                            </div>

                            {summaryLoading ? (
                                <div className="act-state">Loading charts…</div>
                            ) : (
                                <div className="act-typebars">
                                    {["medication", "appointment", "general"].map((t) => {
                                        const val = breakdownByType?.[t]?.total ?? 0;
                                        const pct = totals.total ? Math.round((val / totals.total) * 100) : 0;

                                        return (
                                            <div key={t} className="act-typebar">
                                                <div className={`act-typebar-icon is-${t}`}>
                                                    <TypeIcon type={t}/>
                                                </div>
                                                <div className="act-typebar-main">
                                                    <div className="act-typebar-top">
                                                        <span className="act-typebar-title">{typeLabel(t)}</span>
                                                        <span className="act-typebar-meta">
                              {val} • {pct}%
                            </span>
                                                    </div>
                                                    <div className="act-typebar-track">
                                                        <div className={`act-typebar-fill is-${t}`}
                                                             style={{width: `${pct}%`}}/>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="act-listpanel">
                        <div className="act-listhead">
                            <div className="act-listtitle">Activity log</div>
                            <div className="act-listmeta">
                                {logLoading && logPage === 1 ? "Loading…" : `${logItems.length} items`}
                            </div>
                        </div>

                        {logLoading && logPage === 1 ? (
                            <div className="act-state">Loading activity…</div>
                        ) : logItems.length === 0 ? (
                            <div className="act-state">No activity found for the current filters.</div>
                        ) : (
                            <div className="act-list">
                                {logItems.map((it) => {
                                    const occursAt = safeDate(it.timestamp);
                                    const timeStr = occursAt
                                        ? occursAt.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"})
                                        : "—";
                                    const dateStr = occursAt
                                        ? occursAt.toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric"
                                        })
                                        : "—";

                                    const t = it.details?.reminderType || "general";
                                    const st = it.status || "pending";

                                    return (
                                        <div className="act-card" key={`${it.details?.reminderId}-${it.timestamp}`}>
                                            <div className={`act-iconbox is-${t}`}>
                                                <TypeIcon type={t} size={18}/>
                                            </div>

                                            <div className="act-card-main">
                                                <div className="act-card-title">{it.details?.title || "Reminder"}</div>

                                                <div className="act-lines">
                                                    <div className="act-line">
                                                        <span className="act-line-label">Patient:</span>
                                                        <span className="act-line-value">{it.patientName}</span>
                                                    </div>

                                                    <div className="act-line">
                                                        <span className="act-line-label">When:</span>
                                                        <span className="act-line-value">{dateStr} • {timeStr}</span>
                                                    </div>

                                                    <div className="act-line">
                                                        <span className="act-line-label">Action:</span>
                                                        <span className="act-line-value">{it.actionType}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`act-status is-${st}`}>
                                                <StatusIcon status={st}/>
                                                <span>{statusLabel(st)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {logError && <div className="act-error">{logError}</div>}

                        {logHasMore && (
                            <div style={{padding: "0 12px 12px"}}>
                                <button
                                    className="act-btn"
                                    type="button"
                                    disabled={logLoading}
                                    onClick={() => setLogPage((p) => p + 1)}
                                >
                                    {logLoading ? "Loading…" : "Load more"}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="act-footnote">
                        Charts use <b>GET /api/activity/summary</b>. Activity log uses <b>GET /api/activity/log</b>.
                    </div>
                </div>
            </div>
        </div>
    );
}