/**
 * Reminders list – fetches GET /api/reminders/patient/:patientId for the logged-in patient.
 * Shows loading state, empty state, and a readable list (time, title, type, recurrence).
 */
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Pill, CalendarDays, ClipboardList, AlertCircle, Volume2, Square } from "lucide-react";
import "./Reminders.css";
import { useAuth } from "../context/AuthContext";
import { getRemindersForPatient, markReminderComplete } from "../services/reminders";
import { speakReminderList } from "../utils/voiceAssist";

const REMINDER_TYPE_LABELS = {
  medication: "Medication",
  appointment: "Appointment",
  general: "Task",
};

const REMINDER_TYPE_ICONS = {
  medication: Pill,
  appointment: CalendarDays,
  general: ClipboardList,
};

const RECURRENCE_LABELS = {
  once: null,
  daily: "Daily",
  weekly: "Weekly",
};

/** Today's date in format "Wednesday, March 4, 2026" */
function getTodayFormatted() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Start of today in local time (for filtering). */
function getStartOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

/** True if the reminder's scheduled date (local) is today. */
function isScheduledToday(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/** True if the reminder's scheduled date (local) is after today. */
function isScheduledAfterToday(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d.getTime() > today.getTime();
}

/** True if current time is at or past the reminder's scheduled time (so "Mark as done" is allowed). */
function isDue(isoString) {
  if (!isoString) return false;
  const scheduled = new Date(isoString).getTime();
  return Date.now() >= scheduled;
}

/** True if reminder is completed for this specific occurrence. For once: use isCompleted. For daily/weekly: completedAt must be on the same calendar day as the occurrence. */
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

/**
 * Get the effective occurrence time for a reminder so recurring (daily/weekly) show correctly.
 * - once: use scheduledTime if on or after today.
 * - daily: today at the same time as scheduledTime.
 * - weekly: next occurrence on the same weekday as scheduledTime, on or after today, same time.
 * Returns ISO string or null if no occurrence in range.
 */
function getEffectiveOccurrence(reminder) {
  const scheduled = new Date(reminder.scheduledTime);
  if (Number.isNaN(scheduled.getTime())) return null;
  const recurrence = reminder.recurrence || "once";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (recurrence === "once") {
    return scheduled.getTime() >= todayStart.getTime() ? reminder.scheduledTime : null;
  }

  const hours = scheduled.getHours();
  const minutes = scheduled.getMinutes();
  const scheduledWeekday = scheduled.getDay(); // 0–6

  if (recurrence === "daily") {
    const todayAtTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    return todayAtTime.toISOString();
  }

  if (recurrence === "weekly") {
    const todayWeekday = now.getDay();
    let daysUntil = scheduledWeekday - todayWeekday;
    if (daysUntil < 0) daysUntil += 7;
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);
    nextDate.setHours(hours, minutes, 0, 0);
    return nextDate.getTime() >= todayStart.getTime() ? nextDate.toISOString() : null;
  }

  return null;
}

/**
 * Build list of { reminder, effectiveScheduledTime } for today and upcoming.
 * Includes once (date >= today), daily (today's occurrence), weekly (next occurrence).
 */
function buildOccurrences(reminders) {
  const startOfToday = getStartOfToday();
  const result = [];
  for (const r of reminders) {
    const effective = getEffectiveOccurrence(r);
    if (!effective) continue;
    if (new Date(effective).getTime() < startOfToday) continue;
    result.push({ reminder: r, effectiveScheduledTime: effective });
  }
  return result.sort((a, b) => new Date(a.effectiveScheduledTime) - new Date(b.effectiveScheduledTime));
}

/** Sort occurrences so incomplete (yet to complete) are at top, completed at end. Within each group, by time. */
function sortIncompleteFirst(occurrences) {
  return [...occurrences].sort((a, b) => {
    const aDone = isCompletedForOccurrence(a.reminder, a.effectiveScheduledTime);
    const bDone = isCompletedForOccurrence(b.reminder, b.effectiveScheduledTime);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return new Date(a.effectiveScheduledTime) - new Date(b.effectiveScheduledTime);
  });
}

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markError, setMarkError] = useState(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const readAloudStopRef = useRef(null);

  const handleMarkDone = (reminderId) => {
    setMarkError(null);
    setShowCompletionModal(false);
    setMarkingId(reminderId);
    const completedAt = new Date().toISOString();
    markReminderComplete(reminderId)
      .then(() => {
        setReminders((prev) =>
          prev.map((r) => (r.id === reminderId ? { ...r, isCompleted: true, completedAt } : r))
        );
        setShowCompletionModal(true);
        setTimeout(() => setShowCompletionModal(false), 3000);
      })
      .catch((err) => {
        setMarkError(err.message || "Couldn't mark as done. Try again.");
      })
      .finally(() => {
        setMarkingId(null);
      });
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRemindersForPatient(user.id)
      .then((list) => {
        if (cancelled) return;
        setReminders(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load reminders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, []);

  if (loading) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Reminders</h2>
        <p className="pa-reminders-date">{getTodayFormatted()}</p>
        <div className="pa-reminders-loading" aria-live="polite" aria-busy="true">
          <p className="pa-muted">Loading reminders…</p>
          <div className="pa-reminders-skeleton" aria-hidden="true">
            <div className="pa-reminders-skeleton__card" />
            <div className="pa-reminders-skeleton__card" />
            <div className="pa-reminders-skeleton__card" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Reminders</h2>
        <p className="pa-reminders-date">{getTodayFormatted()}</p>
        <p className="pa-error">{error}</p>
      </div>
    );
  }

  const now = new Date();
  const occurrences = buildOccurrences(reminders);
  const todayRaw = occurrences.filter((o) => isScheduledToday(o.effectiveScheduledTime));
  const upcomingList = occurrences.filter((o) => isScheduledAfterToday(o.effectiveScheduledTime));
  const overdueList = todayRaw.filter(
    (o) => !isCompletedForOccurrence(o.reminder, o.effectiveScheduledTime) &&
      new Date(o.effectiveScheduledTime).getTime() < now.getTime()
  );
  const dueTodayList = sortIncompleteFirst(todayRaw.filter(
    (o) => isCompletedForOccurrence(o.reminder, o.effectiveScheduledTime) ||
      new Date(o.effectiveScheduledTime).getTime() >= now.getTime()
  ));
  const upcomingListSorted = sortIncompleteFirst(upcomingList);
  const hasAny = todayRaw.length > 0 || upcomingList.length > 0;

  const handleReadAloud = () => {
    if (isReadingAloud && readAloudStopRef.current) {
      readAloudStopRef.current();
      setIsReadingAloud(false);
      return;
    }
    const items = [
      ...overdueList.map((o) => ({ occurrence: o, section: "overdue", completed: isCompletedForOccurrence(o.reminder, o.effectiveScheduledTime) })),
      ...dueTodayList.map((o) => ({ occurrence: o, section: "today", completed: isCompletedForOccurrence(o.reminder, o.effectiveScheduledTime) })),
      ...upcomingListSorted.map((o) => ({ occurrence: o, section: "upcoming", completed: isCompletedForOccurrence(o.reminder, o.effectiveScheduledTime) })),
    ];
    const { start, stop } = speakReminderList(items, () => setIsReadingAloud(false));
    readAloudStopRef.current = stop;
    start();
    setIsReadingAloud(true);
  };

  if (!hasAny) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Reminders</h2>
        <p className="pa-reminders-date">{getTodayFormatted()}</p>
        <div className="pa-reminders-empty" role="status">
          <p className="pa-muted">No reminders for today or upcoming.</p>
          <p className="pa-muted" style={{ marginTop: "0.25rem", fontSize: "0.9375rem" }}>
            Your caregiver can add reminders for you from their dashboard.
          </p>
        </div>
      </div>
    );
  }

  const renderCard = (occurrence, section) => {
    const r = occurrence.reminder;
    const effectiveTime = occurrence.effectiveScheduledTime;
    const completedForThisOccurrence = isCompletedForOccurrence(r, effectiveTime);
    const isOverdue = section === "overdue";
    const typeClass = r.reminderType ? `pa-reminders-card--${r.reminderType}` : "";
    const IconComponent = REMINDER_TYPE_ICONS[r.reminderType] || ClipboardList;
    const canMarkDone = (section === "today" || section === "overdue") && !completedForThisOccurrence;
    const isUpcoming = section === "upcoming";
    const key = `${r.id}-${effectiveTime}`;
    const completedLate = completedForThisOccurrence && r.completedAt && new Date(r.completedAt) > new Date(effectiveTime);

    return (
      <li
        key={key}
        className={`pa-reminders-card ${typeClass} ${completedForThisOccurrence ? "pa-reminders-card--completed" : ""} ${completedLate ? "pa-reminders-card--completed-late" : ""} ${isOverdue ? "pa-reminders-card--overdue" : ""}`}
      >
        <div className="pa-reminders-card__main">
          <div className="pa-reminders-card__icon" aria-hidden>
            <IconComponent className="pa-reminders-card__icon-svg" />
          </div>
          <div className="pa-reminders-card__time">
            {formatTime(effectiveTime)}
            {formatDate(effectiveTime) && (
              <span className="pa-reminders-card__date">{formatDate(effectiveTime)}</span>
            )}
          </div>
          <div className="pa-reminders-card__body">
            <span className="pa-reminders-card__type">
              {REMINDER_TYPE_LABELS[r.reminderType] || r.reminderType}
              {isOverdue && (
                <>
                  {" · "}
                  <span className="pa-reminders-card__overdue-label" aria-label="Overdue">
                    <AlertCircle className="pa-reminders-card__overdue-icon" aria-hidden />
                    Overdue
                  </span>
                </>
              )}
            </span>
            <h3 className="pa-reminders-card__title">{r.title}</h3>
            {r.message && (
              <p className="pa-reminders-card__message">{r.message}</p>
            )}
            {RECURRENCE_LABELS[r.recurrence] && (
              <span className="pa-reminders-card__recurrence">
                {RECURRENCE_LABELS[r.recurrence]}
              </span>
            )}
          </div>
        </div>
        <div className="pa-reminders-card__footer">
          {completedForThisOccurrence ? (
            <span className="pa-reminders-card__done" aria-label={completedLate ? "Completed late" : "Completed"}>
              <CheckCircle2 className="pa-reminders-card__done-icon" aria-hidden />
              {completedLate ? "Completed late" : "Completed"}
            </span>
          ) : (
            <button
              type="button"
              className="pa-btn pa-btn--primary pa-reminders-card__action"
              onClick={() => handleMarkDone(r.id)}
              disabled={markingId === r.id || !canMarkDone || isUpcoming}
              title={!canMarkDone && !isUpcoming ? `Available at ${formatTime(effectiveTime)} ${formatDate(effectiveTime) || ""}`.trim() : isUpcoming ? `Available ${formatDate(effectiveTime)} at ${formatTime(effectiveTime)}` : undefined}
              aria-label={!canMarkDone || isUpcoming ? `Mark as done (available at scheduled time)` : `Mark ${r.title} as done`}
            >
              {markingId === r.id ? "Updating…" : "Mark as done"}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="pa-page">
      <h2 className="pa-heading">Reminders</h2>
      <p className="pa-reminders-date">{getTodayFormatted()}</p>
      <div className="pa-reminders-read-aloud">
        <button
          type="button"
          className={`pa-btn pa-btn--secondary pa-reminders-read-aloud__btn ${isReadingAloud ? "pa-reminders-read-aloud__btn--active" : ""}`}
          onClick={handleReadAloud}
          aria-label={isReadingAloud ? "Stop reading" : "Read reminders aloud"}
        >
          {isReadingAloud ? (
            <>
              <Square className="pa-reminders-read-aloud__icon" aria-hidden />
              Stop
            </>
          ) : (
            <>
              <Volume2 className="pa-reminders-read-aloud__icon" aria-hidden />
              Read aloud
            </>
          )}
        </button>
      </div>
      {showCompletionModal && (
        <div
          className="pa-reminders-completion-modal-backdrop"
          onClick={() => setShowCompletionModal(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowCompletionModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pa-completion-title"
          aria-describedby="pa-completion-desc"
        >
          <div
            className="pa-reminders-completion-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <CheckCircle2 className="pa-reminders-completion-modal__icon" aria-hidden />
            <h2 id="pa-completion-title" className="pa-reminders-completion-modal__title">
              Great Job!
            </h2>
            <p id="pa-completion-desc" className="pa-reminders-completion-modal__text">
              Reminder completed!
            </p>
          </div>
        </div>
      )}
      {markError && (
        <p className="pa-error pa-reminders-mark-error" role="alert">
          {markError}
        </p>
      )}
      {overdueList.length > 0 && (
        <section className="pa-reminders-section" aria-labelledby="pa-reminders-overdue-heading">
          <h3 id="pa-reminders-overdue-heading" className="pa-reminders-section__title pa-reminders-section__title--overdue">
            Overdue
          </h3>
          <ul className="pa-reminders-list" role="list" aria-label="Overdue reminders">
            {overdueList.map((r) => renderCard(r, "overdue"))}
          </ul>
        </section>
      )}
      {dueTodayList.length > 0 && (
        <section className="pa-reminders-section" aria-labelledby="pa-reminders-today-heading">
          <h3 id="pa-reminders-today-heading" className="pa-reminders-section__title">
            Due today
          </h3>
          <ul className="pa-reminders-list" role="list" aria-label="Reminders due today">
            {dueTodayList.map((r) => renderCard(r, "today"))}
          </ul>
        </section>
      )}
      {upcomingListSorted.length > 0 && (
        <section className="pa-reminders-section" aria-labelledby="pa-reminders-upcoming-heading">
          <h3 id="pa-reminders-upcoming-heading" className="pa-reminders-section__title">
            Upcoming
          </h3>
          <ul className="pa-reminders-list" role="list" aria-label="Upcoming reminders">
            {upcomingListSorted.map((r) => renderCard(r, "upcoming"))}
          </ul>
        </section>
      )}
    </div>
  );
}
