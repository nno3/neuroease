/**
 * Profile / settings – reminder notification preference (Email | None).
 * Patient can set preferred reminder notification method; persisted via PUT /api/patients/:id.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/apiClient";
import "./Profile.css";

export default function Profile() {
  const { user } = useAuth();
  const [channel, setChannel] = useState("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest(`/api/patients/${user.id}`)
      .then((res) => {
        if (cancelled) return;
        const profile = res?.data?.patient?.Patient ?? res?.data?.patient?.profile ?? null;
        const ch = profile?.reminderNotificationChannel ?? "none";
        setChannel(ch === "email" ? "email" : "none");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleChannelChange = (value) => {
    const newChannel = value === "email" ? "email" : "none";
    setChannel(newChannel);
    setError(null);
    setSaveSuccess(false);
    if (!user?.id) return;
    setSaving(true);
    apiRequest(`/api/patients/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ reminderNotificationChannel: newChannel }),
    })
      .then(() => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      })
      .catch((err) => {
        setError(err.message || "Could not save. Try again.");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (loading) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Profile</h2>
        <p className="pa-muted" aria-live="polite">Loading…</p>
      </div>
    );
  }

  if (error && !channel) {
    return (
      <div className="pa-page">
        <h2 className="pa-heading">Profile</h2>
        <p className="pa-error" role="alert">{error}</p>
      </div>
    );
  }

  return (
    <div className="pa-page">
      <h2 className="pa-heading">Profile</h2>
      <section className="pa-profile-section" aria-labelledby="pa-reminder-notifications-heading">
        <h3 id="pa-reminder-notifications-heading" className="pa-profile-section-title">
          Reminder notifications
        </h3>
        <p className="pa-muted pa-profile-section-desc">
          Choose how you want to be notified when a reminder is due.
        </p>
        <div className="pa-profile-radio-group" role="radiogroup" aria-labelledby="pa-reminder-notifications-heading">
          <label className="pa-profile-radio">
            <input
              type="radio"
              name="reminderNotificationChannel"
              value="email"
              checked={channel === "email"}
              onChange={() => handleChannelChange("email")}
              disabled={saving}
              aria-describedby="pa-reminder-email-desc"
            />
            <span>Email</span>
          </label>
          <p id="pa-reminder-email-desc" className="pa-profile-radio-desc">
            Receive an email when a reminder is due (at the scheduled time).
          </p>
          <label className="pa-profile-radio">
            <input
              type="radio"
              name="reminderNotificationChannel"
              value="none"
              checked={channel === "none"}
              onChange={() => handleChannelChange("none")}
              disabled={saving}
            />
            <span>None</span>
          </label>
          <p className="pa-profile-radio-desc">
            Do not send reminder notifications by email.
          </p>
        </div>
        {saving && (
          <p className="pa-muted pa-profile-saving" aria-live="polite">
            Saving…
          </p>
        )}
        {saveSuccess && (
          <p className="pa-profile-success" role="status">
            Saved.
          </p>
        )}
        {error && (
          <p className="pa-error pa-profile-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
