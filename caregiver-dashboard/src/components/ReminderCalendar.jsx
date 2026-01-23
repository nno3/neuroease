import { useMemo } from "react";
import "./ReminderCalendar.css";
import { ChevronLeft, ChevronRight, CalendarPlus, Calendar as CalendarIcon } from "lucide-react";

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// Monday-first week (UK)
function startOfWeekMonday(d) {
    const day = d.getDay(); // 0 Sun ... 6 Sat
    const diff = (day === 0 ? -6 : 1) - day;
    const out = new Date(d);
    out.setDate(d.getDate() + diff);
    return startOfDay(out);
}

function addDays(d, n) {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

function sameDate(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function timeLabel(d) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function roundToNext15(date) {
    const d = new Date(date);
    const m = d.getMinutes();
    const add = (15 - (m % 15)) % 15;
    d.setMinutes(m + add);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
}

function defaultDateTimeForDay(day) {
    const now = new Date();
    const base = new Date(day);

    // If clicking today, choose next 15 min slot
    if (sameDate(base, now)) {
        return roundToNext15(addDays(now, 0));
    }

    // Otherwise default 09:00
    base.setHours(9, 0, 0, 0);

    // If user clicks a past day (should be rare), bump to next 15 mins
    if (base.getTime() < now.getTime()) return roundToNext15(now);

    return base;
}

function safeDate(v) {
    if (v === null || v === undefined || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function expandOccurrences(reminder, rangeStart, rangeEnd) {
    const out = [];
    const dt = safeDate(reminder?.scheduledTime);
    if (!dt) return out;

    const start = startOfDay(rangeStart);
    const end = endOfDay(rangeEnd);

    const reminderEndRaw = safeDate(reminder?.endTime);
    const reminderEnd = reminderEndRaw ? endOfDay(reminderEndRaw) : null;
    const recur = reminder?.recurrence || "once";

    if (recur === "once") {
        if (dt >= start && dt <= end) out.push({ reminder, occursAt: dt });
        return out;
    }

    if (recur === "daily") {
        let first = new Date(dt);

        if (first < start) {
            const diffDays = Math.floor((startOfDay(start) - startOfDay(first)) / MS_DAY);
            first.setDate(first.getDate() + diffDays);
            if (first < start) first.setDate(first.getDate() + 1);
        }

        for (let i = 0, cur = new Date(first); i < 70 && cur <= end; i++) {
            if (reminderEnd && cur > reminderEnd) break;
            if (cur >= start && cur <= end) out.push({ reminder, occursAt: new Date(cur) });
            cur.setDate(cur.getDate() + 1);
        }
        return out;
    }

    if (recur === "weekly") {
        const targetDow = dt.getDay();
        let first = new Date(dt);

        if (first < start) {
            const startDow = start.getDay();
            const offset = (targetDow - startDow + 7) % 7;
            first = new Date(start);
            first.setDate(first.getDate() + offset);
            first.setHours(dt.getHours(), dt.getMinutes(), 0, 0);
            if (first < start) first.setDate(first.getDate() + 7);
        }

        for (let i = 0, cur = new Date(first); i < 20 && cur <= end; i++) {
            if (reminderEnd && cur > reminderEnd) break;
            if (cur >= start && cur <= end) out.push({ reminder, occursAt: new Date(cur) });
            cur.setDate(cur.getDate() + 7);
        }
        return out;
    }

    if (dt >= start && dt <= end) out.push({ reminder, occursAt: dt });
    return out;
}

export default function ReminderCalendar({
                                             reminders = [],
                                             referenceDate,
                                             onChangeReferenceDate,
                                             onCreateAt,
                                             onOpenReminder,
                                             showPatient = true,
                                             selectedDate,
                                             onSelectDate,
                                         }) {
    const today = new Date();

    const monthLabel = useMemo(() => {
        const d = referenceDate || new Date();
        return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }, [referenceDate]);

    const grid = useMemo(() => {
        const ref = referenceDate || new Date();

        const firstOfMonth = new Date(ref.getFullYear(), ref.getMonth(), 1);
        const lastOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

        const gridStart = startOfWeekMonday(firstOfMonth);
        const gridEnd = endOfDay(addDays(startOfWeekMonday(lastOfMonth), 6)); // end of that week (Sun)

        const days = [];
        for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
            days.push(new Date(d));
        }

        return { days, gridStart, gridEnd, firstOfMonth, lastOfMonth };
    }, [referenceDate]);

    const occurrencesByDay = useMemo(() => {
        const map = new Map();
        const rangeStart = grid.gridStart;
        const rangeEnd = grid.days[grid.days.length - 1];

        const all = [];
        reminders.forEach((r, index) => {
            const occurrences = expandOccurrences(r, rangeStart, rangeEnd);
            all.push(...occurrences);
        });

        all.forEach((occ) => {
            const key = toKey(occ.occursAt);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(occ);
        });

        // sort each day by time
        for (const [k, list] of map.entries()) {
            list.sort((a, b) => a.occursAt.getTime() - b.occursAt.getTime());
            map.set(k, list);
        }

        return map;
    }, [reminders, grid]);
    const goPrev = () => {
        const d = referenceDate ? new Date(referenceDate) : new Date();
        d.setMonth(d.getMonth() - 1);
        onChangeReferenceDate?.(d);
    };

    const goNext = () => {
        const d = referenceDate ? new Date(referenceDate) : new Date();
        d.setMonth(d.getMonth() + 1);
        onChangeReferenceDate?.(d);
    };

    const goToday = () => {
        const now = new Date();
        onChangeReferenceDate?.(now);
        onSelectDate?.(now);
    };

    const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div className="rc-wrap">
            <div className="rc-head">
                <div className="rc-head-left">
                    <div className="rc-month">
                        <CalendarIcon size={16} />
                        <span>{monthLabel}</span>
                    </div>
                </div>

                <div className="rc-head-actions">
                    <button className="rc-btn" type="button" onClick={goToday}>
                        Today
                    </button>

                    <button className="rc-iconbtn" type="button" onClick={goPrev} aria-label="Previous month" title="Previous month">
                        <ChevronLeft size={18} />
                    </button>

                    <button className="rc-iconbtn" type="button" onClick={goNext} aria-label="Next month" title="Next month">
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="rc-grid">
                {weekdayLabels.map((w) => (
                    <div key={w} className="rc-weekday">
                        {w}
                    </div>
                ))}

                {grid.days.map((day) => {
                    const key = toKey(day);
                    const list = occurrencesByDay.get(key) || [];
                    const isToday = sameDate(day, today);
                    const isSelected = selectedDate && sameDate(day, selectedDate);
                    const inMonth = day.getMonth() === (referenceDate || today).getMonth();
                    return (
                        <div
                            key={key}
                            className={[
                                "rc-cell",
                                !inMonth ? "is-out" : "",
                                isToday ? "is-today" : "",
                                isSelected ? "is-selected" : "",
                            ].join(" ")}
                            onClick={() => onSelectDate?.(day)}
                            title="Click to view schedule"
                        >
                            <div className="rc-cell-top">
                                <div className="rc-daynum">{day.getDate()}</div>

                                <button
                                    className="rc-addhint"
                                    title="Schedule reminder"
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCreateAt?.(defaultDateTimeForDay(day));
                                    }}
                                >
                                    <CalendarPlus size={16}/>
                                </button>
                            </div>

                            <div className="rc-events">
                                {list.slice(0, 3).map((occ) => {
                                    const r = occ.reminder;
                                    const occursAt = occ.occursAt;
                                    const now = new Date();
                                    const overdue = occursAt.getTime() < now.getTime() && r.isCompleted !== true;
                                    const isOccToday = sameDate(occursAt, now);
                                    const completed = r.isCompleted === true;

                                    const type = r.reminderType || "general";

                                    return (
                                        <button
                                            key={`${r.id}-${occursAt.toISOString()}`}
                                            type="button"
                                            className={[
                                                "rc-event",
                                                `is-${type}`,
                                                overdue ? "is-overdue" : "",
                                                isOccToday ? "is-today" : "",
                                                completed ? "is-complete" : "",
                                            ].join(" ")}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenReminder?.(r);
                                            }}
                                            title={`${timeLabel(occursAt)} • ${r.title}`}
                                        >
                                            <span className="rc-event-time">{timeLabel(occursAt)}</span>
                                            <span className="rc-event-title">{r.title}</span>

                                            {showPatient && (
                                                <span className="rc-event-patient" title={r.patientName || "Patient"}>
                          {r.patientName || "Patient"}
                        </span>
                                            )}
                                        </button>
                                    );
                                })}

                                {list.length > 3 && (
                                    <div className="rc-more">+{list.length - 3} more</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rc-legend">
                <div className="rc-legend-item">
                    <span className="rc-dot rc-medication"/> Medication
                </div>
                <div className="rc-legend-item">
                    <span className="rc-dot rc-appointment"/> Appointment
                </div>
                <div className="rc-legend-item">
                    <span className="rc-dot rc-task"/> Tasks
                </div>
            </div>
        </div>
    );
}
