import { useEffect, useMemo, useState, forwardRef, Fragment } from "react";
import { Link } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Activity.css";
import { Calendar, RefreshCw, ClipboardList, Pill, CalendarDays, CheckCircle2, AlertTriangle, Clock3 } from "lucide-react";
import { getPatients } from "../services/patients";
import { format3 } from "../utils/patientHelpers";

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

function formatBarLabel(isoDateStr) {
    const str = typeof isoDateStr === "string" ? isoDateStr : "";
    if (!str || str.length < 10) return str || "";
    const d = new Date(str + "T12:00:00");
    if (Number.isNaN(d.getTime())) return str.slice(8, 10);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Returns a short x-axis label for a bar based on the period. */
function getXLabel(d, period) {
    if (period === "day") return d.label ?? "";
    if (period === "6month") {
        // d.label is "Week of 3 Mar" — just show "Mar" for the first week of each month
        if (!d.key) return "";
        const dt = new Date(d.key + "T12:00:00");
        if (Number.isNaN(dt.getTime())) return "";
        return dt.toLocaleDateString("en-GB", { month: "short" }); // "Mar"
    }
    if (period === "year") {
        // d.label is "Mar 2026" — shorten to "Mar"
        if (!d.key) return "";
        const dt = new Date(d.key + "-01T12:00:00");
        if (Number.isNaN(dt.getTime())) return "";
        return dt.toLocaleDateString("en-GB", { month: "short" }); // "Mar"
    }
    if (!d.date) return "";
    const dt = new Date(d.date + "T12:00:00");
    if (Number.isNaN(dt.getTime())) return "";
    if (period === "week") return dt.toLocaleDateString("en-GB", { weekday: "short" }); // Mon, Tue…
    if (period === "month") return String(dt.getDate()); // 1, 2, … 30
    return "";
}

/** Decide which bar indices should show an x-axis label, like Health app. */
function getVisibleLabelIndices(series, period) {
    const n = series.length;
    if (n === 0) return new Set();
    if (period === "day") {
        // Show 12am, 6am, 12pm, 6pm — hours 0, 6, 12, 18
        return new Set(series.map((d, i) => (d.hour % 6 === 0 ? i : -1)).filter((i) => i >= 0));
    }
    if (period === "week") return new Set([...Array(n).keys()]); // all 7 days
    if (period === "month") {
        // Show more date labels: every 3-4 days
        const s = new Set();
        for (let i = 0; i < n; i += 3) s.add(i);
        s.add(n - 1);
        return s;
    }
    if (period === "6month") {
        // Show first week of each month
        const s = new Set();
        let lastMonth = -1;
        series.forEach((d, i) => {
            if (!d.key) return;
            const dt = new Date(d.key + "T12:00:00");
            if (dt.getMonth() !== lastMonth) { s.add(i); lastMonth = dt.getMonth(); }
        });
        return s;
    }
    if (period === "year") return new Set([...Array(n).keys()]); // all 12 months
    return new Set([0, n - 1]);
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

const DateInputWithIcon = forwardRef(
    ({ value, onClick, placeholder, disabled }, ref) => (
        <div className="act-datewrap" onClick={onClick} role="button" tabIndex={0}>
            <input
                ref={ref}
                className="act-date-input"
                value={value || ""}
                readOnly
                placeholder={placeholder}
                disabled={disabled}
            />
            <span className="act-date-icon">
                <Calendar size={16} />
            </span>
        </div>
    )
);
DateInputWithIcon.displayName = "DateInputWithIcon";

const TYPES = [
    { label: "All", value: "all" },
    { label: "Medication", value: "medication" },
    { label: "Appointments", value: "appointment" },
    { label: "Tasks", value: "general" },
];

const PERIODS = [
    { label: "D", value: "day", title: "Day" },
    { label: "W", value: "week", title: "Week" },
    { label: "M", value: "month", title: "Month" },
    { label: "6M", value: "6month", title: "6 Months" },
    { label: "Y", value: "year", title: "Year" },
];

function getDateRangeForPeriod(period, anchor) {
    const d = anchor || new Date();
    const sd = startOfDay(d);
    let from, to;
    if (period === "day") {
        from = to = sd;
    } else if (period === "week") {
        to = sd;
        from = addDays(sd, -6);
    } else if (period === "month") {
        to = sd;
        from = addDays(sd, -29);
    } else if (period === "6month") {
        to = sd;
        from = addDays(sd, -181);
    } else if (period === "year") {
        to = sd;
        from = addDays(sd, -364);
    } else {
        from = addDays(sd, -13);
        to = sd;
    }
    return { from: startOfDay(from), to: endOfDay(to) };
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

/** Aggregate seriesByDay into buckets by week (for 6M) or month (for Y). */
function aggregateSeries(seriesByDay, groupBy) {
    if (!Array.isArray(seriesByDay) || seriesByDay.length === 0) return [];
    const buckets = new Map();
    seriesByDay.forEach((d) => {
        const dt = new Date(d.date + "T12:00:00");
        if (Number.isNaN(dt.getTime())) return;
        let key;
        let label;
        if (groupBy === "week") {
            const weekStart = new Date(dt);
            weekStart.setDate(dt.getDate() - dt.getDay() + 1);
            key = dateKey(weekStart);
            label = `Week of ${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
        } else {
            key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
            label = dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
        }
        const existing = buckets.get(key) || { key, label, completed: 0, pending: 0, overdue: 0, total: 0 };
        existing.completed += Number(d.completed || 0);
        existing.pending += Number(d.pending || 0);
        existing.overdue += Number(d.overdue || 0);
        existing.total += Number(d.total || 0);
        buckets.set(key, existing);
    });
    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** Aggregate log items by hour for Day view. Returns 24 buckets. */
function aggregateLogByHour(logItems) {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`,
        completed: 0, pending: 0, overdue: 0, total: 0,
    }));
    logItems.forEach((it) => {
        const ts = new Date(it.timestamp);
        const h = ts.getHours();
        if (h >= 0 && h < 24) {
            buckets[h].total += 1;
            if (it.status === "completed") buckets[h].completed += 1;
            else if (it.status === "overdue" || it.status === "missed") buckets[h].overdue += 1;
            else buckets[h].pending += 1;
        }
    });
    return buckets;
}

export default function Activity() {
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("all");
    const [type, setType] = useState("all");
    const [period, setPeriod] = useState("week");
    const [anchorDate, setAnchorDate] = useState(() => new Date());

    const today = useMemo(() => new Date(), []);
    const isToday = dateKey(anchorDate) === dateKey(today);

    const { from: fromDate, to: toDate } = useMemo(
        () => getDateRangeForPeriod(period, anchorDate),
        [period, anchorDate]
    );

    const dateRangeLabel = useMemo(() => {
        const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        if (period === "day") return fmt(fromDate);
        return `${fmt(fromDate)} – ${fmt(toDate)}`;
    }, [period, fromDate, toDate]);

    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState("");
    const [summaryData, setSummaryData] = useState(null); // { seriesByDay, breakdownByType, totals, meta... }

    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedBarDate, setSelectedBarDate] = useState(null);
    const [chartMaximised, setChartMaximised] = useState(false);

    const LOG_LIMIT = 25;
    const [logItems, setLogItems] = useState([]);
    const [logPage, setLogPage] = useState(1);
    const [logHasMore, setLogHasMore] = useState(false);
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState("");

    const logLimit = period === "day" ? 500 : LOG_LIMIT;

    useEffect(() => {
        setLogPage(1);
        setLogItems([]);
    }, [patientId, type, fromDate, toDate, refreshKey, period]);

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
                limit: String(logLimit),
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
    }, [patientId, type, fromDate, toDate, refreshKey, logPage, logLimit]);


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
            seriesByDay: buildEmptySeries(startOfDay(fromDate || new Date()), startOfDay(toDate || new Date())),
            breakdownByType: initBreakdown(),
            totals: { total: 0, completed: 0, pending: 0, overdue: 0 },
            usingLiveSummary: false,
        };
    }, [summaryData, fromDate, toDate]);

    const rawSeriesByDay = chartAgg.seriesByDay || buildEmptySeries(startOfDay(fromDate || new Date()), startOfDay(toDate || new Date()));
    const breakdownByType = chartAgg.breakdownByType || initBreakdown();
    const totals = chartAgg.totals || { total: 0, completed: 0, pending: 0, overdue: 0 };

    const seriesByDay = useMemo(() => {
        if (period === "day") {
            return aggregateLogByHour(logItems);
        }
        if (period === "6month") {
            return aggregateSeries(rawSeriesByDay, "week");
        }
        if (period === "year") {
            return aggregateSeries(rawSeriesByDay, "month");
        }
        return rawSeriesByDay;
    }, [period, rawSeriesByDay, logItems]);

    const chartBarLabel = useMemo(() => {
        if (period === "day") return (d) => d.label ?? "";
        if (period === "6month" || period === "year") return (d) => d.label ?? "";
        return formatBarLabel;
    }, [period]);

    const maxDaily = useMemo(
        () => Math.max(1, ...seriesByDay.map((d) => Number(d.total || 0))),
        [seriesByDay]
    );



    const visibleLabelSet = useMemo(
        () => getVisibleLabelIndices(seriesByDay, period),
        [seriesByDay, period]
    );

    const barMinWidth = null;

    // Y-axis: pick 3 nice round ticks (top, mid, 0)
    const yTicks = useMemo(() => {
        const top = maxDaily;
        const mid = Math.round(top / 2);
        return [top, mid, 0];
    }, [maxDaily]);

    const selectedBar = selectedBarDate
        ? seriesByDay.find((x) => (x.date ?? x.key ?? `h${x.hour}`) === selectedBarDate)
        : null;

    const chartContent = (
        <div className="hc-wrap">
            {/* Y-axis title */}
            <div className="hc-yaxis-label">Reminders</div>
            
            {/* Y-axis labels on the right, like Health app */}
            <div className="hc-yaxis">
                {yTicks.map((v) => (
                    <span key={v} className="hc-ytick">{v}</span>
                ))}
            </div>

            {/* Bar area */}
            <div className="hc-body">
                {/* Horizontal grid lines */}
                <div className="hc-grid">
                    <div className="hc-gridline" />
                    <div className="hc-gridline" />
                    <div className="hc-gridline hc-gridline--base" />
                </div>

                {/* Bars row — scrollable for 6M/Y */}
                <div className={barMinWidth ? "hc-bars-scroll" : "hc-bars-fit"}>
                    <div className="hc-bars" role="img" aria-label="Adherence trend chart">
                        {seriesByDay.map((d, idx) => {
                            const barKey = d.date ?? d.key ?? `h${d.hour}` ?? idx;
                            const total = Number(d.total || 0);
                            const completed = Number(d.completed || 0);
                            const pending = Number(d.pending || 0);
                            const overdue = Number(d.overdue || 0);
                            const hTotal = total > 0 ? Math.max(3, (total / maxDaily) * 100) : 0;
                            const hCompleted = total ? (completed / total) * 100 : 0;
                            const hPending = total ? (pending / total) * 100 : 0;
                            const hOverdue = total ? (overdue / total) * 100 : 0;
                            const xLabel = getXLabel(d, period);
                            const isSelected = selectedBarDate === barKey;
                            const showLabel = visibleLabelSet.has(idx);
                            return (
                                <div
                                    key={barKey}
                                    className={`hc-col ${isSelected ? "is-selected" : ""}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedBarDate((prev) => (prev === barKey ? null : barKey))}
                                    onKeyDown={(e) => e.key === "Enter" && setSelectedBarDate((prev) => (prev === barKey ? null : barKey))}
                                    title={`${xLabel || chartBarLabel(d)} — Total: ${total}`}
                                    style={barMinWidth ? { flex: "none", width: `${barMinWidth}px` } : undefined}
                                >
                                    <div className="hc-bar-area">
                                        {hTotal > 0 ? (
                                            <div className="hc-bar" style={{ height: `${hTotal}%` }}>
                                                <div className="hc-seg hc-seg--overdue" style={{ height: `${hOverdue}%` }} />
                                                <div className="hc-seg hc-seg--pending" style={{ height: `${hPending}%` }} />
                                                <div className="hc-seg hc-seg--completed" style={{ height: `${hCompleted}%` }} />
                                            </div>
                                        ) : (
                                            <div className="hc-bar hc-bar--empty" style={{ height: "3px" }} />
                                        )}
                                    </div>
                                    <div className={`hc-xlabel ${showLabel ? "" : "hc-xlabel--hidden"}`}>
                                        {showLabel ? xLabel : ""}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tap/click summary callout */}
            {selectedBar && (() => {
                const d = selectedBar;
                const total = Number(d.total || 0);
                const completed = Number(d.completed || 0);
                const pending = Number(d.pending || 0);
                const overdue = Number(d.overdue || 0);
                const label = getXLabel(d, period) || chartBarLabel(d);
                return (
                    <div className="hc-callout">
                        <div className="hc-callout-label">{label}</div>
                        <div className="hc-callout-stats">
                            <span className="hc-callout-stat hc-callout-stat--completed">
                                <span className="hc-callout-dot" />
                                {completed} done
                            </span>
                            <span className="hc-callout-stat hc-callout-stat--pending">
                                <span className="hc-callout-dot" />
                                {pending} pending
                            </span>
                            <span className="hc-callout-stat hc-callout-stat--overdue">
                                <span className="hc-callout-dot" />
                                {overdue} overdue
                            </span>
                            <span className="hc-callout-total">{total} total</span>
                        </div>
                        <button type="button" className="hc-callout-close" onClick={() => setSelectedBarDate(null)} aria-label="Close">×</button>
                    </div>
                );
            })()}

            {/* X-axis label */}
            <div className="hc-xaxis-label">
                {period === "day" ? "Time" : period === "week" ? "Day of Week" : period === "month" ? "Day of Month" : period === "6month" ? "Month" : "Month"}
            </div>

            {/* Legend */}
            <div className="hc-legend">
                <span className="hc-legend-item"><span className="hc-ldot hc-ldot--completed" />Completed</span>
                <span className="hc-legend-item"><span className="hc-ldot hc-ldot--pending" />Pending</span>
                <span className="hc-legend-item"><span className="hc-ldot hc-ldot--overdue" />Overdue</span>
            </div>
        </div>
    );

    return (
        <Fragment>
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

                    </div>

                    {(logError || summaryError) && <div className="act-error">{logError || summaryError}</div>}

                    <div className="act-content">
                        <div className="act-kpis">
                            <div className="act-kpi">
                                <div className="act-kpi-label">Total reminders</div>
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

                        <div className="act-period-bar">
                            <div className="act-period-tabs">
                                {PERIODS.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`act-period-tab ${period === p.value ? "is-active" : ""}`}
                                        onClick={() => setPeriod(p.value)}
                                        title={p.title}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            <div className="act-date-picker">
                                <DatePicker
                                    selected={anchorDate}
                                    onChange={(date) => { if (date) setAnchorDate(date); }}
                                    dateFormat="dd/MM/yyyy"
                                    placeholderText="Pick a date"
                                    maxDate={today}
                                    calendarStartDay={1}
                                    showMonthDropdown
                                    showYearDropdown
                                    dropdownMode="select"
                                    scrollableYearDropdown
                                    yearDropdownItemNumber={15}
                                    customInput={<DateInputWithIcon />}
                                />
                                {!isToday && (
                                    <button
                                        type="button"
                                        className="act-today-btn"
                                        onClick={() => setAnchorDate(new Date())}
                                    >
                                        Today
                                    </button>
                                )}
                            </div>

                            <span className="act-date-range-label">{dateRangeLabel}</span>
                        </div>

                        <div className="act-charts-row">
                            <div className="act-chart act-chart--main">
                                <div className="act-chart-head">
                                    <div>
                                        <div className="act-chart-title">Reminder adherence trend</div>
                                        <div className="act-chart-sub">Stacked (Completed / Pending / Overdue)</div>
                                    </div>
                                    {!summaryLoading && seriesByDay.length > 0 && (
                                        <button
                                            type="button"
                                            className="act-chart-maximise-btn"
                                            onClick={() => setChartMaximised(true)}
                                            title="Expand chart to view fully"
                                        >
                                            Expand chart
                                        </button>
                                    )}
                                </div>

                                {summaryLoading ? (
                                    <div className="act-state">Loading charts…</div>
                                ) : seriesByDay.length === 0 ? (
                                    <div className="act-state">No chart data for this range.</div>
                                ) : (
                                    chartContent
                                )}
                            </div>

                            <div className="act-chart act-chart--breakdown">
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

            {chartMaximised && (
                <div
                    className="act-chart-fullscreen"
                    onClick={() => setChartMaximised(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Expanded adherence chart"
                >
                    <div className="act-chart-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                        <div className="act-chart-fullscreen-head">
                            <h3 className="act-chart-fullscreen-title">Reminder adherence trend</h3>
                            <button
                                type="button"
                                className="act-chart-fullscreen-close"
                                onClick={() => setChartMaximised(false)}
                                aria-label="Close expanded chart"
                            >
                                Close
                            </button>
                        </div>
                        <div className="act-chart-fullscreen-body">
                            {chartContent}
                        </div>
                    </div>
                </div>
            )}
        </Fragment>
    );
}