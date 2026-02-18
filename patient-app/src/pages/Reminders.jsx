/**
 * Reminders list – fetches GET /api/reminders/patient/:patientId for the logged-in patient.
 * Shows loading state, empty state, and a readable list (time, title, type, recurrence).
 */
import { useState, useEffect } from "react";
import "./Reminders.css";
import { useAuth } from "../context/AuthContext";
import { getRemindersForPatient } from "../services/reminders";

const REMINDER_TYPE_LABELS = {
  medication: "Medication",
  appointment: "Appointment",
  general: "Task",
};

const RECURRENCE_LABELS = {
  once: null,
  daily: "Daily",
  weekly: "Weekly",
};

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

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const sorted = [...list].sort(
          (a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)
        );
        setReminders(sorted);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load reminders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Reminders</h2>
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
        <p className="pa-error">{error}</p>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Reminders</h2>
        <div className="pa-reminders-empty" role="status">
          <p className="pa-muted">No reminders right now.</p>
          <p className="pa-muted" style={{ marginTop: "0.25rem", fontSize: "0.9375rem" }}>
            Your caregiver can add reminders for you from their dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pa-page">
      <h2 className="pa-heading">Reminders</h2>
      <ul className="pa-reminders-list" role="list" aria-label="Your reminders">
        {reminders.map((r) => (
          <li key={r.id} className="pa-reminders-card">
            <div className="pa-reminders-card__time">
              {formatTime(r.scheduledTime)}
              {formatDate(r.scheduledTime) && (
                <span className="pa-reminders-card__date">{formatDate(r.scheduledTime)}</span>
              )}
            </div>
            <div className="pa-reminders-card__body">
              <span className="pa-reminders-card__type">
                {REMINDER_TYPE_LABELS[r.reminderType] || r.reminderType}
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
          </li>
        ))}
      </ul>
    </div>
  );
}
