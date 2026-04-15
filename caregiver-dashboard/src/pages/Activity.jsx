import React from 'react';
import { useEffect, useMemo, useState, forwardRef, Fragment } from "react";
import { Link } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Activity.css";
import { Calendar, RefreshCw, ClipboardList, Pill, CalendarDays, CheckCircle2, AlertTriangle, Clock3, Gamepad2, TrendingUp } from "lucide-react";
import { getPatients } from "../services/patients";
import { format3 } from "../utils/patientHelpers";
import { API_BASE } from "../services/apiClient";

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

/** Turn a bar key into a full readable date string for callouts. */
function formatCalloutDate(barKey, period) {
    if (!barKey) return "";
    if (period === "day") {
        const hr = parseInt(barKey.replace("h", ""), 10);
        if (Number.isNaN(hr)) return barKey;
        return hr === 0 ? "12:00 AM" : hr === 12 ? "12:00 PM" : hr < 12 ? `${hr}:00 AM` : `${hr - 12}:00 PM`;
    }
    if (period === "year") {
        const d = new Date(barKey + "-01T12:00:00");
        if (Number.isNaN(d.getTime())) return barKey;
        return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    if (period === "6month") {
        const d = new Date(barKey + "T12:00:00");
        if (Number.isNaN(d.getTime())) return barKey;
        const end = new Date(d); end.setDate(end.getDate() + 6);
        return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    const d = new Date(barKey + "T12:00:00");
    if (Number.isNaN(d.getTime())) return barKey;
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
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

const FEED_FILTERS = [
    { label: "All", value: "all" },
    { label: "Reminders", value: "reminders" },
    { label: "Games", value: "games" },
];

const GAME_TYPE_LABELS = { memory: "Memory Match", math: "Math Practice", sequencing: "Sequencing" };

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

    const [gamesLoading, setGamesLoading] = useState(true);
    const [gamesError, setGamesError] = useState("");
    const [gamesData, setGamesData] = useState(null);
    const [selectedGameBar, setSelectedGameBar] = useState(null);
    const [gameBarSessions, setGameBarSessions] = useState([]);
    const [gameBarSessionsLoading, setGameBarSessionsLoading] = useState(false);
    const [gamesChartMaximised, setGamesChartMaximised] = useState(false);
    const [perfChartMaximised, setPerfChartMaximised] = useState(false);

    const LOG_LIMIT = 25;
    const [logItems, setLogItems] = useState([]);
    const [gameFeedItems, setGameFeedItems] = useState([]);
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState("");
    const [feedFilter, setFeedFilter] = useState("all");
    const [feedDisplayCount, setFeedDisplayCount] = useState(25);

    const logLimit = period === "6month" || period === "year" ? 500 : period === "month" ? 200 : period === "week" ? 100 : period === "day" ? 500 : LOG_LIMIT;

    useEffect(() => {
        setLogItems([]);
        setGameFeedItems([]);
        setFeedDisplayCount(25);
        setSelectedPerfIdx(null);
    }, [patientId, type, fromDate, toDate, refreshKey, period]);

    useEffect(() => {
        const ac = new AbortController();

        (async () => {
            setLogLoading(true);
            setLogError("");

            const safeFrom = fromDate ? startOfDay(fromDate) : addDays(new Date(), -13);
            const safeTo = toDate ? endOfDay(toDate) : endOfDay(new Date());
            const fromStr = toISODateOnly(safeFrom);
            const toStr = toISODateOnly(safeTo);
            const token =
                    localStorage.getItem("token") ||
                    localStorage.getItem("authToken") ||
                    localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
            const opts = { method: "GET", headers, signal: ac.signal };

            try {
                const [logRes, gamesRes] = await Promise.all([
                    fetch(`${API_BASE}/activity/log?${new URLSearchParams({ patientId: String(patientId), type: String(type), from: fromStr, to: toStr, page: "1", limit: String(logLimit) })}`, opts),
                    fetch(`${API_BASE}/activity/recent-games?${new URLSearchParams({ patientId: String(patientId), from: fromStr, to: toStr, limit: "100" })}`, opts),
                ]);

                if (!logRes.ok) {
                    let msg = `Activity log error (${logRes.status})`;
                    try { const j = await logRes.json(); msg = j?.message || msg; } catch {
                        /* body not JSON */
                    }
                    throw new Error(msg);
                }

                const logJson = await logRes.json();
                const logData = logJson?.data ?? logJson;
                const reminderItems = Array.isArray(logData?.items) ? logData.items : [];

                let gameItems = [];
                if (gamesRes.ok) {
                    const gamesJson = await gamesRes.json();
                    const gamesData = gamesJson?.data ?? gamesJson;
                    gameItems = Array.isArray(gamesData?.items) ? gamesData.items : [];
                }

                setLogItems(reminderItems);
                setGameFeedItems(gameItems);
            } catch (e) {
                if (e?.name === "AbortError") return;
                setLogError(e?.message || "Unable to load activity log.");
            } finally {
                setLogLoading(false);
            }
        })();

        return () => ac.abort();
    }, [patientId, type, fromDate, toDate, refreshKey, logLimit]);


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

                const res = await fetch(`${API_BASE}/activity/summary?${params.toString()}`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            setGamesLoading(true);
            setGamesError("");
            const safeFrom = fromDate ? startOfDay(fromDate) : addDays(new Date(), -13);
            const safeTo = toDate ? endOfDay(toDate) : endOfDay(new Date());
            const params = new URLSearchParams({
                patientId: String(patientId),
                from: toISODateOnly(safeFrom),
                to: toISODateOnly(safeTo),
            });
            try {
                const token = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("accessToken");
                const res = await fetch(`${API_BASE}/activity/games-summary?${params.toString()}`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    signal: ac.signal,
                });
                if (!res.ok) {
                    let msg = `Games summary error (${res.status})`;
                    try { const j = await res.json(); msg = j?.message || msg; } catch {
                        /* body not JSON */
                    }
                    throw new Error(msg);
                }
                const json = await res.json();
                const data = json?.data;
                if (!data || !Array.isArray(data.seriesByDay)) throw new Error("Unexpected games summary data.");
                setGamesData(data);
            } catch (e) {
                if (e?.name === "AbortError") return;
                setGamesData(null);
                setGamesError(e?.message || "Unable to load games summary.");
            } finally {
                setGamesLoading(false);
            }
        })();
        return () => ac.abort();
    }, [patientId, fromDate, toDate, refreshKey]);

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

    const selectedBarItems = useMemo(() => {
        if (!selectedBarDate || !logItems.length) return [];
        return logItems.filter((it) => {
            const ts = new Date(it.timestamp);
            if (Number.isNaN(ts.getTime())) return false;
            if (period === "day") {
                return `h${ts.getHours()}` === selectedBarDate;
            }
            if (period === "6month") {
                const weekStart = new Date(ts);
                weekStart.setDate(ts.getDate() - ts.getDay() + 1);
                return dateKey(weekStart) === selectedBarDate;
            }
            if (period === "year") {
                const k = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
                return k === selectedBarDate;
            }
            return dateKey(ts) === selectedBarDate;
        }).slice(0, 10);
    }, [selectedBarDate, logItems, period]);

    // Combined activity feed: reminders + game sessions, sorted chronologically (newest first)
    const mergedFeedItems = useMemo(() => {
        const reminders = (logItems || []).map((it) => ({ ...it, _feedType: "reminder" }));
        const games = (gameFeedItems || []).map((it) => ({ ...it, _feedType: "game" }));
        return [...reminders, ...games].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [logItems, gameFeedItems]);

    const filteredFeedItems = useMemo(() => {
        if (feedFilter === "reminders") return mergedFeedItems.filter((it) => it._feedType === "reminder");
        if (feedFilter === "games") return mergedFeedItems.filter((it) => it._feedType === "game");
        return mergedFeedItems;
    }, [mergedFeedItems, feedFilter]);

    const displayedFeedItems = useMemo(
        () => filteredFeedItems.slice(0, feedDisplayCount),
        [filteredFeedItems, feedDisplayCount]
    );
    const feedHasMore = displayedFeedItems.length < filteredFeedItems.length;

    // --- Games chart data ---
    const gamesRawSeries = gamesData?.seriesByDay || [];
    const gamesTotals = gamesData?.totals || {
        total: 0, memory: 0, math: 0, sequencing: 0,
        perfByType: { math: {}, memory: {}, sequencing: {} },
    };
    const mathPerf = gamesTotals.perfByType?.math || {};
    const memoryPerf = gamesTotals.perfByType?.memory || {};

    function newTypeBucket() { return { count: 0, scoreSum: 0, accSum: 0, accCount: 0 }; }
    function newGameBucket(key, label) {
        return {
            key, label, count: 0, memory: 0, math: 0, sequencing: 0,
            scoreSum: 0, accSum: 0, accCount: 0, swA: 0,
            perfByType: { math: newTypeBucket(), memory: newTypeBucket(), sequencing: newTypeBucket() },
        };
    }
    function addDayToBucket(bucket, d) {
        bucket.count += d.count || 0;
        bucket.memory += d.memory || 0;
        bucket.math += d.math || 0;
        bucket.sequencing += d.sequencing || 0;
        if (d.avgScore != null && d.count > 0) bucket.scoreSum += d.avgScore * d.count;
        if (d.avgAccuracy != null) { bucket.accSum += (d.avgAccuracy / 100) * d.count; bucket.accCount += d.count; }
        bucket.swA += d.sessionsWithAccuracy || 0;
        if (d.perfByType) {
            for (const gt of ["math", "memory", "sequencing"]) {
                const src = d.perfByType[gt]; const dst = bucket.perfByType[gt];
                if (!src || !src.count) continue;
                dst.count += src.count;
                dst.scoreSum += (src.avgScore ?? 0) * src.count;
                if (src.avgAccuracy != null) { dst.accSum += (src.avgAccuracy / 100) * src.count; dst.accCount += src.count; }
            }
        }
    }
    function finalizeTypeBucket(tb) {
        return {
            count: tb.count,
            avgScore: tb.count > 0 ? Math.round((tb.scoreSum / tb.count) * 10) / 10 : null,
            avgAccuracy: tb.accCount > 0 ? Math.round((tb.accSum / tb.accCount) * 1000) / 10 : null,
            sessionsWithAccuracy: tb.accCount,
        };
    }
    function finalizeBuckets(buckets) {
        return Array.from(buckets.values()).map((b) => ({
            ...b,
            avgScore: b.count > 0 ? Math.round((b.scoreSum / b.count) * 10) / 10 : null,
            avgAccuracy: b.accCount > 0 ? Math.round((b.accSum / b.accCount) * 1000) / 10 : null,
            sessionsWithAccuracy: b.swA,
            perfByType: {
                math: finalizeTypeBucket(b.perfByType.math),
                memory: finalizeTypeBucket(b.perfByType.memory),
                sequencing: finalizeTypeBucket(b.perfByType.sequencing),
            },
        })).sort((a, b) => a.key.localeCompare(b.key));
    }

    const gamesSeries = useMemo(() => {
        if (period === "6month") {
            const buckets = new Map();
            gamesRawSeries.forEach((d) => {
                const dt = new Date(d.date + "T12:00:00");
                if (Number.isNaN(dt.getTime())) return;
                const weekStart = new Date(dt);
                weekStart.setDate(dt.getDate() - dt.getDay() + 1);
                const k = dateKey(weekStart);
                const label = `Week of ${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
                if (!buckets.has(k)) buckets.set(k, newGameBucket(k, label));
                addDayToBucket(buckets.get(k), d);
            });
            return finalizeBuckets(buckets);
        }
        if (period === "year") {
            const buckets = new Map();
            gamesRawSeries.forEach((d) => {
                const dt = new Date(d.date + "T12:00:00");
                if (Number.isNaN(dt.getTime())) return;
                const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
                const label = dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
                if (!buckets.has(k)) buckets.set(k, newGameBucket(k, label));
                addDayToBucket(buckets.get(k), d);
            });
            return finalizeBuckets(buckets);
        }
        return gamesRawSeries;
        // newGameBucket / addDayToBucket / finalizeBuckets are local helpers; listing them would recompute every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, gamesRawSeries]);

    const gamesMax = useMemo(() => Math.max(1, ...gamesSeries.map((d) => d.count || 0)), [gamesSeries]);
    const gamesYTicks = useMemo(() => {
        const top = gamesMax;
        const mid = Math.round(top / 2);
        return [top, mid, 0];
    }, [gamesMax]);

    const gamesVisibleLabels = useMemo(() => getVisibleLabelIndices(gamesSeries, period), [gamesSeries, period]);

    const selectedGameData = selectedGameBar
        ? gamesSeries.find((x) => (x.date ?? x.key) === selectedGameBar)
        : null;

    const gamesChartContent = (
        <div className="hc-wrap">
            <div className="hc-yaxis-label">Sessions</div>
            <div className="hc-yaxis">
                {gamesYTicks.map((v, i) => (
                    <span key={`games-ytick-${i}`} className="hc-ytick">{v}</span>
                ))}
            </div>
            <div className="hc-body">
                <div className="hc-grid">
                    <div className="hc-gridline" />
                    <div className="hc-gridline" />
                    <div className="hc-gridline hc-gridline--base" />
                </div>
                <div className="hc-bars-fit">
                    <div className="hc-bars" role="img" aria-label="Games played trend chart">
                        {gamesSeries.map((d, idx) => {
                            const barKey = d.date ?? d.key ?? idx;
                            const count = d.count || 0;
                            const mem = d.memory || 0;
                            const math = d.math || 0;
                            const seq = d.sequencing || 0;
                            const hTotal = count > 0 ? Math.max(3, (count / gamesMax) * 100) : 0;
                            const hMem = count ? (mem / count) * 100 : 0;
                            const hMath = count ? (math / count) * 100 : 0;
                            const hSeq = count ? (seq / count) * 100 : 0;
                            const xLabel = getXLabel(d, period);
                            const isSelected = selectedGameBar === barKey;
                            const showLabel = gamesVisibleLabels.has(idx);
                            return (
                                <div
                                    key={barKey}
                                    className={`hc-col ${isSelected ? "is-selected" : ""}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedGameBar((prev) => (prev === barKey ? null : barKey))}
                                    onKeyDown={(e) => e.key === "Enter" && setSelectedGameBar((prev) => (prev === barKey ? null : barKey))}
                                    title={`${xLabel || barKey} — ${count} session${count !== 1 ? "s" : ""}`}
                                >
                                    <div className="hc-bar-area">
                                        {hTotal > 0 ? (
                                            <div className="hc-bar" style={{ height: `${hTotal}%` }}>
                                                <div className="hc-seg hc-seg--sequencing" style={{ height: `${hSeq}%` }} />
                                                <div className="hc-seg hc-seg--math" style={{ height: `${hMath}%` }} />
                                                <div className="hc-seg hc-seg--memory" style={{ height: `${hMem}%` }} />
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

            {selectedGameData && (() => {
                const d = selectedGameData;
                const label = getXLabel(d, period) || d.date || d.key;
                const fullDate = formatCalloutDate(selectedGameBar, period);
                const GLABELS = { memory: "Memory Match", math: "Math Practice", sequencing: "Sequencing" };
                return (
                    <div className="hc-callout">
                        <div className="hc-callout-label">{label}{fullDate && fullDate !== label ? <span className="hc-callout-date">{fullDate}</span> : null}</div>
                        <div className="hc-callout-stats">
                            <span className="hc-callout-stat hc-callout-stat--memory">
                                <span className="hc-callout-dot" />{d.memory || 0} Memory
                            </span>
                            <span className="hc-callout-stat hc-callout-stat--math">
                                <span className="hc-callout-dot" />{d.math || 0} Math
                            </span>
                            {(d.sequencing || 0) > 0 && (
                                <span className="hc-callout-stat hc-callout-stat--sequencing">
                                    <span className="hc-callout-dot" />{d.sequencing} Sequencing
                                </span>
                            )}
                            <span className="hc-callout-total">{d.count || 0} total</span>
                        </div>
                        {gameBarSessionsLoading ? (
                            <div className="hc-detail-loading">Loading sessions…</div>
                        ) : gameBarSessions.length > 0 && (
                            <ul className="hc-detail-list">
                                {gameBarSessions.map((s, i) => {
                                    const ts = new Date(s.timestamp || s.playedAt);
                                    const time = ts.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
                                    const mins = Math.floor((s.duration || 0) / 60);
                                    const secs = (s.duration || 0) % 60;
                                    const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                                    const acc = s.accuracy != null ? ` · ${Math.round(s.accuracy * 100)}%` : "";
                                    return (
                                        <li key={s.id ?? i} className={`hc-detail-item hc-detail-item--game-${s.gameType}`}>
                                            <span className={`hc-detail-dot hc-detail-dot--${s.gameType}`} />
                                            <span className="hc-detail-title">{GLABELS[s.gameType] || s.gameType}</span>
                                            <span className="hc-detail-meta">Score: {s.score ?? "—"}{acc} · {dur} · {time}{s.patientName ? ` · ${s.patientName}` : ""}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <button type="button" className="hc-callout-close" onClick={() => setSelectedGameBar(null)} aria-label="Close">×</button>
                    </div>
                );
            })()}

            <div className="hc-xaxis-label">
                {period === "day" ? "Time" : period === "week" ? "Day of Week" : period === "month" ? "Day of Month" : "Month"}
            </div>

            <div className="hc-legend">
                <span className="hc-legend-item"><span className="hc-ldot hc-ldot--memory" />Memory Match</span>
                <span className="hc-legend-item"><span className="hc-ldot hc-ldot--math" />Math Practice</span>
                {gamesTotals.sequencing > 0 && (
                    <span className="hc-legend-item"><span className="hc-ldot hc-ldot--sequencing" />Sequencing</span>
                )}
            </div>
        </div>
    );

    // Performance line chart data
    const [perfGameType, setPerfGameType] = useState("math");
    const PERF_META = {
        math:   { label: "Math Practice",  scoreLabel: "Correct / session", scoreSub: "questions answered correctly", lowerBetter: false },
        memory: { label: "Memory Match",   scoreLabel: "Moves to win",      scoreSub: "fewer moves = better recall", lowerBetter: true },
    };
    const perfMeta = PERF_META[perfGameType] || PERF_META.math;

    const perfPoints = useMemo(() => {
        return gamesSeries.map((d) => {
            const t = d.perfByType?.[perfGameType];
            if (!t || t.count === 0) return null;
            return { ...d, count: t.count, avgScore: t.avgScore, avgAccuracy: t.avgAccuracy, sessionsWithAccuracy: t.sessionsWithAccuracy };
        }).filter(Boolean);
    }, [gamesSeries, perfGameType]);
    const perfScoreMax = useMemo(() => Math.max(1, ...perfPoints.map((d) => d.avgScore ?? 0)), [perfPoints]);
    const [hoveredPerfIdx, setHoveredPerfIdx] = useState(null);
    const [selectedPerfIdx, setSelectedPerfIdx] = useState(null);

    useEffect(() => {
        if (!selectedGameBar) { setGameBarSessions([]); return; }
        const ac = new AbortController();
        (async () => {
            setGameBarSessionsLoading(true);
            let barFrom, barTo;
            if (period === "6month") {
                barFrom = selectedGameBar;
                const d = new Date(selectedGameBar + "T12:00:00");
                barTo = toISODateOnly(addDays(d, 6));
            } else if (period === "year") {
                const [y, m] = selectedGameBar.split("-").map(Number);
                barFrom = `${y}-${String(m).padStart(2, "0")}-01`;
                const lastDay = new Date(y, m, 0).getDate();
                barTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            } else {
                barFrom = barTo = selectedGameBar;
            }
            const params = new URLSearchParams({ patientId: String(patientId), from: barFrom, to: barTo });
            try {
                const token = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("accessToken");
                const res = await fetch(`${API_BASE}/activity/recent-games?limit=20&${params.toString()}`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    signal: ac.signal,
                });
                if (!res.ok) { setGameBarSessions([]); return; }
                const json = await res.json();
                setGameBarSessions(Array.isArray(json?.data?.items) ? json.data.items : []);
            } catch (e) {
                if (e?.name !== "AbortError") setGameBarSessions([]);
            } finally {
                setGameBarSessionsLoading(false);
            }
        })();
        return () => ac.abort();
    }, [selectedGameBar, patientId, period]);

    const perfChartBody = gamesLoading ? (
        <div className="act-state">Loading…</div>
    ) : perfPoints.length < 2 ? (
        <div className="act-state act-state--perf-empty">
            <TrendingUp size={24} style={{ opacity: 0.3 }} />
            <span>Need at least 2 {perfMeta.label} sessions to show trends.</span>
        </div>
    ) : (() => {
        const W = 440, H = 200, PAD = { top: 10, right: 48, bottom: 30, left: 44 };
        const chartW = W - PAD.left - PAD.right;
        const chartH = H - PAD.top - PAD.bottom;
        const n = perfPoints.length;
        const scoreMax = Math.ceil(perfScoreMax / 10) * 10 || 10;
        const xOf = (i) => PAD.left + (i / (n - 1)) * chartW;
        const yScore = perfMeta.lowerBetter ? (v) => PAD.top + (v / scoreMax) * chartH : (v) => PAD.top + chartH - (v / scoreMax) * chartH;
        const yAcc = (v) => PAD.top + chartH - (v / 100) * chartH;
        const scorePath = perfPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yScore(p.avgScore ?? 0).toFixed(1)}`).join(" ");
        const accPath = perfPoints.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yAcc(p.avgAccuracy ?? 0).toFixed(1)}`).join(" ");
        const gridLines = [0, 0.25, 0.5, 0.75, 1];
        const PERF_SCORE_COLOR = "#0ea5e9";
        const PERF_ACC_COLOR = "#ec4899";
        const activeIdx = selectedPerfIdx ?? hoveredPerfIdx;
        const leftAxisLabel = perfMeta.lowerBetter ? "Moves" : "Correct";
        return (
            <div className="perf-chart-wrap">
                <div className="perf-axis-labels">
                    <span className="perf-axis-label perf-axis-label--left">{leftAxisLabel}</span>
                    <span className="perf-axis-label perf-axis-label--right">Accuracy</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} className="perf-svg" role="img" aria-label="Performance trend line chart">
                    {gridLines.map((frac) => {
                        const y = PAD.top + chartH * (1 - frac);
                        return <line key={frac} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
                    })}
                    {gridLines.map((frac) => {
                        const y = PAD.top + chartH * (1 - frac);
                        const scoreTickVal = perfMeta.lowerBetter ? Math.round(scoreMax * (1 - frac)) : Math.round(scoreMax * frac);
                        return (
                            <Fragment key={`lbl-${frac}`}>
                                <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="perf-tick">{scoreTickVal}</text>
                                <text x={W - PAD.right + 6} y={y + 4} textAnchor="start" className="perf-tick perf-tick--acc">{Math.round(100 * frac)}%</text>
                            </Fragment>
                        );
                    })}
                    {activeIdx != null && <line x1={xOf(activeIdx)} x2={xOf(activeIdx)} y1={PAD.top} y2={PAD.top + chartH} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3" />}
                    <path d={scorePath} fill="none" stroke={PERF_SCORE_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={accPath} fill="none" stroke={PERF_ACC_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
                    {perfPoints.map((p, i) => {
                        const isActive = activeIdx === i;
                        return (
                            <Fragment key={i}>
                                <circle cx={xOf(i)} cy={yScore(p.avgScore ?? 0)} r={isActive ? 6 : 3.5} fill={PERF_SCORE_COLOR} stroke="#fff" strokeWidth="2" className="perf-dot" />
                                <circle cx={xOf(i)} cy={yAcc(p.avgAccuracy ?? 0)} r={isActive ? 6 : 3.5} fill={PERF_ACC_COLOR} stroke="#fff" strokeWidth="2" className="perf-dot" />
                                <rect x={xOf(i) - (chartW / n) / 2} y={PAD.top} width={chartW / n} height={chartH + PAD.bottom} fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredPerfIdx(i)} onMouseLeave={() => setHoveredPerfIdx(null)} onClick={() => setSelectedPerfIdx((prev) => (prev === i ? null : i))} />
                            </Fragment>
                        );
                    })}
                    {perfPoints.map((p, i) => {
                        const showLabel = n <= 10 || i === 0 || i === n - 1 || i % Math.ceil(n / 7) === 0;
                        if (!showLabel) return null;
                        const lbl = getXLabel(p, period) || p.label || p.date || p.key || "";
                        return <text key={`x-${i}`} x={xOf(i)} y={H - 6} textAnchor="middle" className="perf-xlabel">{lbl}</text>;
                    })}
                </svg>
                {hoveredPerfIdx != null && selectedPerfIdx == null && (() => {
                    const p = perfPoints[hoveredPerfIdx];
                    const lbl = getXLabel(p, period) || p.label || p.date || p.key || "";
                    return (
                        <div className="perf-tooltip" style={{ left: `${(xOf(hoveredPerfIdx) / W) * 100}%` }}>
                            <strong>{lbl}</strong>
                            <span className="perf-tooltip-row"><span className="perf-tooltip-dot perf-tooltip-dot--score" />{perfMeta.scoreLabel}: {p.avgScore ?? "—"}</span>
                            <span className="perf-tooltip-row"><span className="perf-tooltip-dot perf-tooltip-dot--acc" />Accuracy: {p.avgAccuracy != null ? `${p.avgAccuracy}%` : "—"}</span>
                        </div>
                    );
                })()}
                {selectedPerfIdx != null && (() => {
                    const p = perfPoints[selectedPerfIdx];
                    const lbl = getXLabel(p, period) || p.label || p.date || p.key || "";
                    const fullDate = formatCalloutDate(p.date ?? p.key, period);
                    const swA = p.sessionsWithAccuracy ?? p.count;
                    const accNote = swA < p.count ? ` (based on ${swA} of ${p.count})` : "";
                    const scoreNote = swA < p.count ? ` (${p.count - swA} incomplete)` : "";
                    return (
                        <div className="perf-callout">
                            <div className="perf-callout-header">
                                <span className="perf-callout-label">{lbl}{fullDate && fullDate !== lbl ? <span className="hc-callout-date">{fullDate}</span> : null}</span>
                                <button type="button" className="hc-callout-close" onClick={() => setSelectedPerfIdx(null)} aria-label="Close">×</button>
                            </div>
                            <div className="perf-callout-stats">
                                <div className="perf-callout-stat">
                                    <span className="perf-callout-dot" style={{ background: PERF_SCORE_COLOR }} />
                                    <span className="perf-callout-stat-label">{perfMeta.scoreLabel}</span>
                                    <span className="perf-callout-stat-value">{p.avgScore ?? "—"}{perfMeta.lowerBetter ? " moves" : ""}<span className="perf-callout-note">{scoreNote}</span></span>
                                </div>
                                <div className="perf-callout-stat">
                                    <span className="perf-callout-dot" style={{ background: PERF_ACC_COLOR }} />
                                    <span className="perf-callout-stat-label">Accuracy</span>
                                    <span className="perf-callout-stat-value">{p.avgAccuracy != null ? `${p.avgAccuracy}%` : "—"}<span className="perf-callout-note">{accNote}</span></span>
                                </div>
                                <div className="perf-callout-stat">
                                    <span className="perf-callout-dot" style={{ background: "#94a3b8" }} />
                                    <span className="perf-callout-stat-label">Sessions</span>
                                    <span className="perf-callout-stat-value">{p.count}</span>
                                </div>
                            </div>
                        </div>
                    );
                })()}
                <div className="hc-legend">
                    <span className="hc-legend-item"><span className="hc-ldot" style={{ background: PERF_SCORE_COLOR }} />{perfMeta.scoreLabel}</span>
                    <span className="hc-legend-item"><span className="hc-ldot" style={{ background: PERF_ACC_COLOR }} />Accuracy %</span>
                </div>
            </div>
        );
    })();

    const perfChartContent = (
        <>
            <div className="act-period-tabs">
                {Object.entries(PERF_META).map(([gt, meta]) => (
                    <button key={gt} type="button" className={`act-period-tab ${perfGameType === gt ? "is-active" : ""}`} onClick={() => { setPerfGameType(gt); setSelectedPerfIdx(null); setHoveredPerfIdx(null); }}>{meta.label}</button>
                ))}
            </div>
            {perfChartBody}
        </>
    );

    const chartContent = (
        <div className="hc-wrap">
            {/* Y-axis title */}
            <div className="hc-yaxis-label">Reminders</div>
            
            {/* Y-axis labels on the right, like Health app */}
            <div className="hc-yaxis">
                {yTicks.map((v, i) => (
                    <span key={`rem-ytick-${i}`} className="hc-ytick">{v}</span>
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
                            const barKey = d.date ?? d.key ?? (d.hour != null ? `h${d.hour}` : idx);
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
                const fullDate = formatCalloutDate(selectedBarDate, period);
                return (
                    <div className="hc-callout">
                        <div className="hc-callout-label">{label}{fullDate && fullDate !== label ? <span className="hc-callout-date">{fullDate}</span> : null}</div>
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
                        {selectedBarItems.length > 0 && (
                            <ul className="hc-detail-list">
                                {selectedBarItems.map((it, i) => {
                                    const ts = new Date(it.timestamp);
                                    const needDate = period === "6month" || period === "year";
                                    const time = needDate
                                        ? ts.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                                        : ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                                    const st = it.status || "pending";
                                    return (
                                        <li key={`${it.details?.reminderId}-${it.timestamp}-${i}`} className={`hc-detail-item hc-detail-item--${st}`}>
                                            <StatusIcon status={st} size={14} />
                                            <span className="hc-detail-title">{it.details?.title || "Reminder"}</span>
                                            <span className="hc-detail-meta">{time} · {it.patientName}</span>
                                        </li>
                                    );
                                })}
                                {total > selectedBarItems.length && (
                                    <li className="hc-detail-more">+{total - selectedBarItems.length} more</li>
                                )}
                            </ul>
                        )}
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
                            Review reminders, game sessions, and track adherence over time.
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

                    {/* Shared filters: patient + period + date */}
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

                        <div className="act-control act-control--period">
                            <label className="act-label">Period</label>
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
                        </div>

                        <div className="act-control act-control--date">
                            <label className="act-label">Date</label>
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
                        </div>
                    </div>

                    <div className="act-date-range-banner">{dateRangeLabel}</div>

                    {(logError || summaryError) && <div className="act-error">{logError || summaryError}</div>}

                    <div className="act-content">
                        {/* ── Reminders section ── */}
                        <div className="act-section">
                            <div className="act-section-header">
                                <h2 className="act-section-title">Reminders</h2>
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

                            <div className="act-kpis">
                                <div className="act-kpi">
                                    <div className="act-kpi-label">Total</div>
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

                        <div className="act-charts-row">
                            <div className="act-chart act-chart--main">
                                <div className="act-chart-head">
                                    <div>
                                        <div className="act-chart-title">Adherence trend</div>
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
                                <div className="act-chart-sub">Number of reminders and share of total ({totals.total ?? 0} total)</div>
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
                                                        <span className="act-typebar-meta" title={`${val} reminders, ${pct}% of total`}>
                                                            {val} reminders · {pct}% of total
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
                        </div>{/* end .act-section (Reminders) */}

                        {/* ── Games section ── */}
                        <div className="act-section">
                            <div className="act-section-header">
                                <h2 className="act-section-title"><Gamepad2 size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />Games</h2>
                            </div>

                            <div className="act-kpis act-kpis--games">
                                <div className="act-kpi">
                                    <div className="act-kpi-label">Total sessions</div>
                                    <div className="act-kpi-value">{gamesTotals.total}</div>
                                </div>
                                <div className="act-kpi">
                                    <div className="act-kpi-label">Memory Match</div>
                                    <div className="act-kpi-value">{gamesTotals.memory}</div>
                                </div>
                                <div className="act-kpi">
                                    <div className="act-kpi-label">Math Practice</div>
                                    <div className="act-kpi-value">{gamesTotals.math}</div>
                                </div>
                                {gamesTotals.sequencing > 0 && (
                                    <div className="act-kpi">
                                        <div className="act-kpi-label">Sequencing</div>
                                        <div className="act-kpi-value">{gamesTotals.sequencing}</div>
                                    </div>
                                )}
                                {mathPerf.avgAccuracy != null && mathPerf.count > 0 && (
                                    <div className="act-kpi" title="Math: % of questions answered correctly">
                                        <div className="act-kpi-label">Math accuracy{mathPerf.sessionsWithAccuracy != null && mathPerf.sessionsWithAccuracy < mathPerf.count ? ` (${mathPerf.sessionsWithAccuracy}/${mathPerf.count})` : ""}</div>
                                        <div className="act-kpi-value">{mathPerf.avgAccuracy}%</div>
                                    </div>
                                )}
                                {memoryPerf.avgScore != null && memoryPerf.count > 0 && (
                                    <div className="act-kpi" title="Memory: average moves to complete game (lower = better)">
                                        <div className="act-kpi-label">Memory: Moves to win</div>
                                        <div className="act-kpi-value">{memoryPerf.avgScore}</div>
                                    </div>
                                )}
                                {memoryPerf.avgAccuracy != null && memoryPerf.count > 0 && (
                                    <div className="act-kpi" title="Memory: pair efficiency (pairs ÷ moves, higher = more efficient)">
                                        <div className="act-kpi-label">Memory accuracy{memoryPerf.sessionsWithAccuracy != null && memoryPerf.sessionsWithAccuracy < memoryPerf.count ? ` (${memoryPerf.sessionsWithAccuracy}/${memoryPerf.count})` : ""}</div>
                                        <div className="act-kpi-value">{memoryPerf.avgAccuracy}%</div>
                                    </div>
                                )}
                            </div>

                            <div className="act-charts-row">
                            {/* ── Games bar chart ── */}
                            <div className="act-chart act-chart--main">
                            {gamesLoading ? (
                                <div className="act-state">Loading games chart…</div>
                            ) : gamesError ? (
                                <div className="act-error">{gamesError}</div>
                            ) : gamesSeries.length === 0 ? (
                                <div className="act-state">No game data for this range.</div>
                            ) : (
                                <>
                                <div className="act-chart-head">
                                    <div>
                                        <div className="act-chart-title">Sessions by game type</div>
                                        <div className="act-chart-sub">Stacked (Memory / Math / Sequencing)</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="act-chart-maximise-btn"
                                        onClick={() => setGamesChartMaximised(true)}
                                        title="Expand chart to view fully"
                                    >
                                        Expand chart
                                    </button>
                                </div>
                                {gamesChartContent}
                                </>
                            )}
                            </div>{/* end .act-chart--main (Games bar chart) */}

                            {/* ── Performance trend line chart ── */}
                            <div className="act-chart act-chart--perf">
                            <div className="act-chart-head">
                                <div>
                                    <div className="act-chart-title">Performance trend</div>
                                    <div className="act-chart-sub">{perfMeta.scoreSub} &amp; accuracy over time</div>
                                </div>
                                {!gamesLoading && perfPoints.length >= 2 && (
                                    <button
                                        type="button"
                                        className="act-chart-maximise-btn"
                                        onClick={() => setPerfChartMaximised(true)}
                                        title="Expand chart to view fully"
                                    >
                                        Expand chart
                                    </button>
                                )}
                            </div>
                            {perfChartContent}
                            </div>{/* end .act-chart--perf */}
                            </div>{/* end .act-charts-row */}
                        </div>{/* end .act-section (Games) */}

                        <div className="act-listpanel">
                            <div className="act-listhead">
                                <div className="act-listtitle">Activity log</div>
                                <div className="act-listmeta">
                                    {logLoading ? "Loading…" : `${filteredFeedItems.length} items`}
                                </div>
                            </div>

                            <div className="act-feed-tabs">
                                {FEED_FILTERS.map((f) => (
                                    <button
                                        key={f.value}
                                        type="button"
                                        className={`act-feed-tab ${feedFilter === f.value ? "is-active" : ""}`}
                                        onClick={() => setFeedFilter(f.value)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {logLoading ? (
                                <div className="act-state">Loading activity…</div>
                            ) : displayedFeedItems.length === 0 ? (
                                <div className="act-state">No activity found for the current filters.</div>
                            ) : (
                                <div className="act-list">
                                    {displayedFeedItems.map((it) => {
                                        const occursAt = safeDate(it.timestamp);
                                        const timeStr = occursAt
                                            ? occursAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                                            : "—";
                                        const dateStr = occursAt
                                            ? occursAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                            : "—";

                                        if (it._feedType === "game") {
                                            const gameLabel = GAME_TYPE_LABELS[it.gameType] || it.gameType || "Game";
                                            const accStr = it.accuracy != null ? ` · ${Math.round(it.accuracy * 100)}%` : "";
                                            const dur = it.duration != null ? (it.duration >= 60 ? `${Math.floor(it.duration / 60)}m ${it.duration % 60}s` : `${it.duration}s`) : "";
                                            return (
                                                <div className="act-card act-card--game" key={`game-${it.id ?? it.timestamp}-${it.patientId}`}>
                                                    <div className="act-iconbox is-game">
                                                        <Gamepad2 size={18} />
                                                    </div>
                                                    <div className="act-card-main">
                                                        <div className="act-card-title">{it.patientName} played {gameLabel}</div>
                                                        <div className="act-lines">
                                                            <div className="act-line">
                                                                <span className="act-line-label">Score:</span>
                                                                <span className="act-line-value">{it.score ?? "—"}{accStr}</span>
                                                            </div>
                                                            <div className="act-line">
                                                                <span className="act-line-label">When:</span>
                                                                <span className="act-line-value">{dateStr} • {timeStr}{dur ? ` · ${dur}` : ""}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const t = it.details?.reminderType || "general";
                                        const st = it.status || "pending";
                                        return (
                                            <div className="act-card" key={`${it.details?.reminderId}-${it.timestamp}`}>
                                                <div className={`act-iconbox is-${t}`}>
                                                    <TypeIcon type={t} size={18} />
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
                                                    <StatusIcon status={st} />
                                                    <span>{statusLabel(st)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {logError && <div className="act-error">{logError}</div>}

                            {feedHasMore && (
                                <div style={{ padding: "0 12px 12px" }}>
                                    <button
                                        className="act-btn"
                                        type="button"
                                        onClick={() => setFeedDisplayCount((c) => c + 25)}
                                    >
                                        Load more
                                    </button>
                                </div>
                            )}
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

            {gamesChartMaximised && (
                <div
                    className="act-chart-fullscreen"
                    onClick={() => setGamesChartMaximised(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Expanded games chart"
                >
                    <div className="act-chart-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                        <div className="act-chart-fullscreen-head">
                            <h3 className="act-chart-fullscreen-title">Sessions by game type</h3>
                            <button
                                type="button"
                                className="act-chart-fullscreen-close"
                                onClick={() => setGamesChartMaximised(false)}
                                aria-label="Close expanded chart"
                            >
                                Close
                            </button>
                        </div>
                        <div className="act-chart-fullscreen-body">
                            {gamesChartContent}
                        </div>
                    </div>
                </div>
            )}

            {perfChartMaximised && (
                <div
                    className="act-chart-fullscreen"
                    onClick={() => setPerfChartMaximised(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Expanded performance chart"
                >
                    <div className="act-chart-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                        <div className="act-chart-fullscreen-head">
                            <h3 className="act-chart-fullscreen-title">Performance trend</h3>
                            <button
                                type="button"
                                className="act-chart-fullscreen-close"
                                onClick={() => setPerfChartMaximised(false)}
                                aria-label="Close expanded chart"
                            >
                                Close
                            </button>
                        </div>
                        <div className="act-chart-fullscreen-body">
                            {perfChartContent}
                        </div>
                    </div>
                </div>
            )}
        </Fragment>
    );
}