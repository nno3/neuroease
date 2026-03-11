/**
 * Profile / settings – reminder notification preference (Email | In-app push | None).
 * Patient sets preferred method; persisted via PUT /api/patients/:id. In-app push requires
 * permission and sends subscription to POST /api/push/subscribe.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/apiClient";
import {
  getVoiceAssistEnabled,
  setVoiceAssistEnabled,
  getVoiceAssistVoice,
  setVoiceAssistVoice,
  getVoiceAssistRate,
  setVoiceAssistRate,
  getAvailableVoices,
  speakTest,
} from "../utils/voiceAssist";
import { getGameSoundsEnabled, setGameSoundsEnabled } from "../utils/gameSounds";
import { Volume2 } from "lucide-react";
import "./Profile.css";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export default function Profile() {
  const { user } = useAuth();
  const [channel, setChannel] = useState("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null); // 'default' | 'granted' | 'denied'
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [pushSubscriptionCount, setPushSubscriptionCount] = useState(null); // null = unknown, number = count from API
  const [voiceAssistOnOpen, setVoiceAssistOnOpen] = useState(false);
  const [testVoiceStatus, setTestVoiceStatus] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [speechRate, setSpeechRate] = useState(1);
  const [gameSoundsEnabled, setGameSoundsEnabledState] = useState(true);

  useEffect(() => {
    setGameSoundsEnabledState(getGameSoundsEnabled());
  }, []);

  useEffect(() => {
    setVoiceAssistOnOpen(getVoiceAssistEnabled());
    setSelectedVoice(getVoiceAssistVoice());
    setSpeechRate(getVoiceAssistRate());
  }, []);

  useEffect(() => {
    const load = () => setVoices(getAvailableVoices());
    load();
    if ("speechSynthesis" in window) {
      speechSynthesis.onvoiceschanged = load;
      return () => { speechSynthesis.onvoiceschanged = null; };
    }
  }, []);

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
        const ch = (profile?.reminderNotificationChannel ?? "none").toLowerCase();
        setChannel(ch === "email" || ch === "push" ? ch : "none");
        if ("Notification" in window) setPermissionStatus(Notification.permission);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Keep permission status in sync (e.g. user changed it in Settings)
  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermissionStatus(Notification.permission);
  }, [channel, saveSuccess]);

  // Re-check permission when user returns from Settings (e.g. after enabling notifications)
  useEffect(() => {
    if (!("Notification" in window)) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setPermissionStatus(Notification.permission);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // When In-app push is selected, fetch how many devices are registered so we can show "enabled" status
  useEffect(() => {
    if (channel !== "push" || !user?.id) {
      setPushSubscriptionCount(null);
      return;
    }
    let cancelled = false;
    apiRequest("/api/push/status")
      .then((res) => {
        if (!cancelled && res?.data?.count !== undefined) setPushSubscriptionCount(res.data.count);
      })
      .catch(() => {
        if (!cancelled) setPushSubscriptionCount(0);
      });
    return () => { cancelled = true; };
  }, [channel, user?.id, saveSuccess]);

  const handleChannelChange = async (value) => {
    const newChannel = value === "email" ? "email" : value === "push" ? "push" : "none";
    setChannel(newChannel);
    setError(null);
    setSaveSuccess(false);
    if (!user?.id) return;
    setSaving(true);
    try {
      if (newChannel === "push") {
        const keyRes = await apiRequest("/api/push/vapid-public-key");
        const publicKey = keyRes?.data?.publicKey;
        if (!publicKey) throw new Error("Push not configured. Use Email or None.");
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          throw new Error("This browser does not support in-app push. Use Email or None.");
        }
        let permission = Notification.permission;
        if (permission === "default") permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Notifications were denied. Enable them in browser settings to use in-app push.");
          setSaving(false);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const subJson = sub.toJSON();
        await apiRequest("/api/push/subscribe", {
          method: "POST",
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        });
      }
      await apiRequest(`/api/patients/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ reminderNotificationChannel: newChannel }),
      });
        setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    if (!("Notification" in window)) return;
    setRequestingPermission(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission !== "granted") {
        setError("Notifications were blocked. To get reminder alerts, allow notifications for this app in your device Settings.");
        return;
      }
      // Permission granted – if In-app push is selected, subscribe and save now
      if (channel === "push" && user?.id) {
        setSaving(true);
        try {
          const keyRes = await apiRequest("/api/push/vapid-public-key");
          const publicKey = keyRes?.data?.publicKey;
          if (publicKey) {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
            const subJson = sub.toJSON();
            await apiRequest("/api/push/subscribe", {
              method: "POST",
              body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
            });
          }
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
          setPushSubscriptionCount((c) => (c != null ? c + 1 : 1));
        } catch (e) {
          setError(e?.message || "Could not register for push. Try selecting In-app push again.");
        } finally {
          setSaving(false);
        }
      }
    } catch (e) {
      setError("Could not request permission. Try again or enable notifications in device Settings.");
    } finally {
      setRequestingPermission(false);
    }
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

      {/* Notifications card */}
      <div className="pa-profile-card" role="region" aria-labelledby="pa-notifications-heading">
        <h3 id="pa-notifications-heading" className="pa-profile-card-title">
          Notifications
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />

        {/* Reminder channel */}
        <div className="pa-profile-channel-section" role="radiogroup" aria-labelledby="pa-reminder-channel-heading">
          <h4 id="pa-reminder-channel-heading" className="pa-profile-row-label">Reminder alerts</h4>
          <p className="pa-profile-row-desc">Choose how you want to be notified when a reminder is due.</p>
          <div className="pa-profile-radio-group">
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
            <p id="pa-reminder-email-desc" className="pa-profile-radio-desc">Receive an email when a reminder is due.</p>
            <label className="pa-profile-radio">
              <input
                type="radio"
                name="reminderNotificationChannel"
                value="push"
                checked={channel === "push"}
                onChange={() => handleChannelChange("push")}
                disabled={saving}
                aria-describedby="pa-reminder-push-desc"
              />
              <span>In-app push</span>
            </label>
            <p id="pa-reminder-push-desc" className="pa-profile-radio-desc">Get a notification on this device (works with Add to Home Screen). iOS 16.4+ for iPhone/iPad.</p>
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
            <p className="pa-profile-radio-desc">Do not send reminder notifications.</p>
          </div>
        </div>

        {saving && <p className="pa-muted pa-profile-saving" aria-live="polite">Saving…</p>}
        {saveSuccess && <p className="pa-profile-success" role="status">Saved.</p>}
        {error && <p className="pa-error pa-profile-error" role="alert">{error}</p>}
        {channel === "push" && (
          <div className="pa-profile-push-status" role="status" aria-live="polite">
            {pushSubscriptionCount === null && <p className="pa-muted">Checking…</p>}
            {pushSubscriptionCount !== null && pushSubscriptionCount === 0 && permissionStatus === "granted" && (
              <p className="pa-muted">In-app push is on but no device is registered. Re-select &quot;In-app push&quot; and allow notifications.</p>
            )}
          </div>
        )}

        {/* Voice Reminders - toggle row */}
        <div className="pa-profile-toggle-row">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label">Voice Reminders</span>
            <span className="pa-profile-row-desc" id="pa-voice-assist-desc">Hear reminders spoken aloud</span>
          </div>
          <label className="pa-profile-toggle">
            <input
              type="checkbox"
              checked={voiceAssistOnOpen}
              onChange={(e) => {
                const enabled = e.target.checked;
                setVoiceAssistEnabled(enabled);
                setVoiceAssistOnOpen(enabled);
              }}
              aria-describedby="pa-voice-assist-desc"
            />
            <span className="pa-profile-toggle-slider" />
          </label>
        </div>

        {/* Voice options when enabled */}
        {voiceAssistOnOpen && (
          <div className="pa-profile-voice-options">
            <div className="pa-profile-voice-row">
              <div className="pa-profile-voice-field">
                <label htmlFor="pa-voice-select" className="pa-profile-voice-label">Voice</label>
                <select
                  id="pa-voice-select"
                  value={(() => {
                    const match = voices.find(
                      (v) => `${v.name}|${v.lang}` === selectedVoice || v.name === selectedVoice || v.uri === selectedVoice
                    );
                    return match ? `${match.name}|${match.lang}` : selectedVoice || "";
                  })()}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVoiceAssistVoice(v);
                    setSelectedVoice(v);
                  }}
                  className="pa-profile-select"
                >
                  <option value="">System default</option>
                  {voices.map((v) => {
                    const val = `${v.name}|${v.lang}`;
                    return <option key={val} value={val}>{v.name} ({v.lang})</option>;
                  })}
                </select>
              </div>
              <div className="pa-profile-voice-field">
                <label htmlFor="pa-rate-select" className="pa-profile-voice-label">Speed</label>
                <select
                  id="pa-rate-select"
                  value={[0.8, 1, 1.2].includes(speechRate) ? speechRate : 1}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value);
                    setVoiceAssistRate(r);
                    setSpeechRate(r);
                  }}
                  className="pa-profile-select"
                >
                  <option value={0.8}>Slower</option>
                  <option value={1}>Normal</option>
                  <option value={1.2}>Faster</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Test Voice Reminder button */}
        <button
          type="button"
          className="pa-btn pa-btn--primary pa-profile-test-btn"
          onClick={() => {
            setTestVoiceStatus(null);
            const ok = speakTest(() => setTestVoiceStatus(null));
            setTestVoiceStatus(ok ? "Playing…" : "Voice not supported in this browser.");
          }}
          aria-label="Test voice reminder"
        >
          <Volume2 className="pa-profile-test-btn-icon" aria-hidden />
          Test Voice Reminder
        </button>
        {testVoiceStatus && <p className="pa-muted pa-profile-test-status">{testVoiceStatus}</p>}
      </div>

      {/* Games card */}
      <div className="pa-profile-card" role="region" aria-labelledby="pa-games-heading">
        <h3 id="pa-games-heading" className="pa-profile-card-title">
          Games
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />

        <div className="pa-profile-toggle-row">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label">Sound Effects</span>
            <span className="pa-profile-row-desc" id="pa-game-sounds-desc">Play sounds for game feedback</span>
          </div>
          <label className="pa-profile-toggle">
            <input
              type="checkbox"
              checked={gameSoundsEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setGameSoundsEnabled(enabled);
                setGameSoundsEnabledState(enabled);
              }}
              aria-describedby="pa-game-sounds-desc"
            />
            <span className="pa-profile-toggle-slider" />
          </label>
        </div>
      </div>

      {/* Permission box - when push selected but not granted */}
      {channel === "push" && "Notification" in window && permissionStatus !== "granted" && (
        <div className="pa-profile-card pa-profile-permission-box" role="region" aria-label="Notification permission">
          <h3 className="pa-profile-card-title">Allow Notifications</h3>
          <hr className="pa-profile-card-divider" aria-hidden />
          <p className="pa-profile-permission-text">
            {permissionStatus === "denied"
              ? "Notifications are off for this app. To get reminder alerts, turn them on in your device Settings."
              : "Allow notifications so you get reminder alerts when the app is in the background."}
          </p>
          <p className="pa-profile-permission-iphone">
            <strong>On iPhone:</strong> Settings → Notifications. This app may appear under <strong>Safari</strong> or the <strong>website address</strong>. Turn on Allow Notifications.
          </p>
          <p className="pa-profile-permission-pwa">
            <strong>Home screen app:</strong> If you enabled push in Safari, open the app from the home screen icon and enable In-app push here so this device gets notifications.
          </p>
          <button
            type="button"
            className="pa-btn pa-btn--primary pa-profile-test-btn"
            onClick={handleRequestPermission}
            disabled={requestingPermission}
            aria-label="Allow notifications"
          >
            {requestingPermission ? "Checking…" : "Allow notifications"}
          </button>
        </div>
      )}
    </div>
  );
}
