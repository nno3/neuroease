/**
 * Profile / settings – reminder channel (Email | In-app push | None), voice & speech, games, location.
 * Notification channel persisted via PUT /api/patients/:id. Voice/speed apply to Read aloud and TTS;
 * "Speak reminders automatically" only gates push/open-app speech (see VoiceAssistListener).
 */
import React from 'react';
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocationSharing } from "../context/LocationSharingContext";
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
import {
  getAccessibilityPrefs,
  setAccessibilityPrefs,
  resetAccessibilityPrefs,
} from "../utils/accessibilityPrefs";
import { MapPin } from "lucide-react";
import "./Profile.css";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

function getTonightPauseEndIso() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (end.getTime() <= Date.now()) {
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);
  }
  return end.toISOString();
}

function getTonightEndTimestamp() {
  return new Date(getTonightPauseEndIso()).getTime();
}

/** Which segment to highlight when paused (hour vs tonight); otherwise live. */
function getLocationPauseSegment(pauseActive, pausedUntilIso) {
  if (!pauseActive || !pausedUntilIso) return "live";
  const until = new Date(pausedUntilIso).getTime();
  if (Number.isNaN(until)) return "live";
  const tonightEnd = getTonightEndTimestamp();
  if (Math.abs(until - tonightEnd) <= 120000) return "tonight";
  return "hour";
}

export default function Profile() {
  const { user } = useAuth();
  const {
    locationConsent,
    setLocationConsent,
    locationPausedUntil,
    setLocationPausedUntil,
    locationPauseActive,
    geoPermissionStatus,
    locationError,
    isGeolocationSupported,
    recheckPermission,
    openLocationSettings,
    sendLocationNow,
  } = useLocationSharing();
  const [channel, setChannel] = useState("none");
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null); // 'default' | 'granted' | 'denied'
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [pushSubscriptionCount, setPushSubscriptionCount] = useState(null); // null = unknown, number = count from API
  const [callPushDeviceCount, setCallPushDeviceCount] = useState(null);
  const [callPushBusy, setCallPushBusy] = useState(false);
  /** This browser tab has a stored web push subscription (call + reminder pushes share the same registration). */
  const [callPushSubscribedLocal, setCallPushSubscribedLocal] = useState(false);
  const [voiceAssistOnOpen, setVoiceAssistOnOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [speechRate, setSpeechRate] = useState(1);
  const [speechTesting, setSpeechTesting] = useState(false);
  const [gameSoundsEnabled, setGameSoundsEnabledState] = useState(true);
  const [locationRechecking, setLocationRechecking] = useState(false);
  const [locationSending, setLocationSending] = useState(false);
  const [locationPauseBusy, setLocationPauseBusy] = useState(false);
  const [textScale, setTextScale] = useState("default");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [boldText, setBoldText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    setGameSoundsEnabledState(getGameSoundsEnabled());
  }, []);

  useEffect(() => {
    const p = getAccessibilityPrefs();
    setTextScale(p.textScale);
    setReduceMotion(!!p.reduceMotion);
    setBoldText(!!p.boldText);
    setHighContrast(!!p.highContrast);
  }, []);

  useEffect(() => {
    setVoiceAssistOnOpen(getVoiceAssistEnabled());
    setSelectedVoice(getVoiceAssistVoice());
    setSpeechRate(getVoiceAssistRate());
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    apiRequest("/api/push/status")
      .then((res) => {
        if (!cancelled && res?.data?.count !== undefined) setCallPushDeviceCount(res.data.count);
      })
      .catch(() => {
        if (!cancelled) setCallPushDeviceCount(0);
      });
    return () => { cancelled = true; };
  }, [user?.id, saveSuccess]);

  const refreshCallPushLocalState = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      setCallPushSubscribedLocal(false);
      return;
    }
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      await reg.ready;
      const sub = await reg.pushManager.getSubscription();
      setCallPushSubscribedLocal(!!sub);
    } catch {
      setCallPushSubscribedLocal(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCallPushSubscribedLocal(false);
      return;
    }
    refreshCallPushLocalState();
  }, [user?.id, saveSuccess, refreshCallPushLocalState]);

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
        // reminderNotificationChannel being set means reminders are on; treat "none" as off
        setNotifyReminders(ch === "email" || ch === "push");
        setNotifyMessages(!!profile?.messageNotifications);
        if (profile?.locationConsent !== undefined) setLocationConsent(profile.locationConsent);
        if (profile?.locationPausedUntil !== undefined) {
          setLocationPausedUntil(profile.locationPausedUntil ?? null);
        }
        if ("Notification" in window) setPermissionStatus(Notification.permission);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, setLocationConsent, setLocationPausedUntil]);

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
        body: JSON.stringify({ reminderNotificationChannel: newChannel, messageNotifications: notifyMessages }),
      });
        setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLocationConsentChange = async (enabled) => {
    if (!user?.id) return;
    setError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      await apiRequest(`/api/patients/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          locationConsent: enabled,
          ...(enabled ? {} : { locationPausedUntil: null }),
        }),
      });
      setLocationConsent(enabled);
      if (!enabled) setLocationPausedUntil(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLocationPauseUntil = async (isoDateOrNull) => {
    if (!user?.id) return;
    setError(null);
    setLocationPauseBusy(true);
    try {
      await apiRequest(`/api/patients/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          locationPausedUntil: isoDateOrNull,
        }),
      });
      setLocationPausedUntil(isoDateOrNull);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || "Could not update pause. Try again.");
    } finally {
      setLocationPauseBusy(false);
    }
  };

  const handleEnableCallPush = async () => {
    if (!user?.id) return;
    setError(null);
    setCallPushBusy(true);
    try {
      const keyRes = await apiRequest("/api/push/vapid-public-key");
      const publicKey = keyRes?.data?.publicKey;
      if (!publicKey) throw new Error("Push is not configured on the server.");
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("This browser does not support call notifications.");
      }
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Allow notifications to ring when your caregiver calls while the app is closed.");
      }
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const subJson = sub.toJSON();
      await apiRequest("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      const st = await apiRequest("/api/push/status");
      setCallPushDeviceCount(st?.data?.count ?? 0);
      setCallPushSubscribedLocal(true);
      setPermissionStatus("granted");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || "Could not enable call notifications.");
      await refreshCallPushLocalState();
    } finally {
      setCallPushBusy(false);
    }
  };

  const handleDisableCallPush = async () => {
    if (!user?.id) return;
    setError(null);
    setCallPushBusy(true);
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setCallPushSubscribedLocal(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiRequest("/api/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint }),
        });
      }
      setCallPushSubscribedLocal(false);
      const st = await apiRequest("/api/push/status");
      setCallPushDeviceCount(st?.data?.count ?? 0);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err?.message || "Could not turn off call notifications on this device.");
      await refreshCallPushLocalState();
    } finally {
      setCallPushBusy(false);
    }
  };

  const handleCallPushToggle = async (wantOn) => {
    if (wantOn) {
      await handleEnableCallPush();
    } else {
      await handleDisableCallPush();
    }
    await refreshCallPushLocalState();
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

  const locationPauseSegment = getLocationPauseSegment(locationPauseActive, locationPausedUntil);

  return (
    <div className="pa-page">
      <h2 className="pa-heading">Profile</h2>

      <div className="pa-profile-card" role="region" aria-labelledby="pa-a11y-heading">
        <h3 id="pa-a11y-heading" className="pa-profile-card-title">
          Display options
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />
        <p className="pa-profile-row-desc">
          Saved on this device only (not on your account). You can still pinch-to-zoom in the browser.
          Larger text sizes apply across the app.
        </p>

        <div className="pa-profile-channel-section">
          <label htmlFor="pa-a11y-text-scale" className="pa-profile-row-label">Text size</label>
          <p className="pa-profile-row-desc" id="pa-a11y-text-scale-desc">Makes menus and reminders easier to read.</p>
          <select
            id="pa-a11y-text-scale"
            className="pa-profile-select"
            value={textScale}
            onChange={(e) => {
              const v = e.target.value;
              setTextScale(v);
              setAccessibilityPrefs({ textScale: v });
            }}
            aria-describedby="pa-a11y-text-scale-desc"
          >
            <option value="default">Default</option>
            <option value="large">Large</option>
            <option value="larger">Larger</option>
          </select>
        </div>

        <div className="pa-profile-toggle-row pa-profile-a11y-toggle">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label" id="pa-a11y-motion-label">Reduce animations</span>
            <span className="pa-profile-row-desc" id="pa-a11y-motion-desc">
              Shortens on-screen movement. Your phone&apos;s &quot;Reduce Motion&quot; setting is respected too.
            </span>
          </div>
          <label className="pa-profile-toggle">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => {
                const v = e.target.checked;
                setReduceMotion(v);
                setAccessibilityPrefs({ reduceMotion: v });
              }}
              aria-labelledby="pa-a11y-motion-label"
              aria-describedby="pa-a11y-motion-desc"
            />
            <span className="pa-profile-toggle-slider" aria-hidden />
          </label>
        </div>

        <div className="pa-profile-toggle-row pa-profile-a11y-toggle">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label" id="pa-a11y-bold-label">Bolder text</span>
            <span className="pa-profile-row-desc" id="pa-a11y-bold-desc">
              Slightly heavier words across the app (headings stay extra bold).
            </span>
          </div>
          <label className="pa-profile-toggle">
            <input
              type="checkbox"
              checked={boldText}
              onChange={(e) => {
                const v = e.target.checked;
                setBoldText(v);
                setAccessibilityPrefs({ boldText: v });
              }}
              aria-labelledby="pa-a11y-bold-label"
              aria-describedby="pa-a11y-bold-desc"
            />
            <span className="pa-profile-toggle-slider" aria-hidden />
          </label>
        </div>

        <div className="pa-profile-toggle-row pa-profile-a11y-toggle">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label" id="pa-a11y-contrast-label">Higher contrast</span>
            <span className="pa-profile-row-desc" id="pa-a11y-contrast-desc">
              Darker text, stronger borders, and clearer buttons and cards so content stands out from the background.
            </span>
          </div>
          <label className="pa-profile-toggle">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => {
                const v = e.target.checked;
                setHighContrast(v);
                setAccessibilityPrefs({ highContrast: v });
              }}
              aria-labelledby="pa-a11y-contrast-label"
              aria-describedby="pa-a11y-contrast-desc"
            />
            <span className="pa-profile-toggle-slider" aria-hidden />
          </label>
        </div>

        <button
          type="button"
          className="pa-btn pa-btn--secondary pa-profile-a11y-reset"
          onClick={() => {
            resetAccessibilityPrefs();
            setTextScale("default");
            setReduceMotion(false);
            setBoldText(false);
            setHighContrast(false);
          }}
        >
          Reset display options to defaults
        </button>
      </div>

      {/* Notifications card */}
      <div className="pa-profile-card" role="region" aria-labelledby="pa-notifications-heading">
        <h3 id="pa-notifications-heading" className="pa-profile-card-title">
          Notifications
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />

        {/* What to notify about */}
        <div className="pa-profile-channel-section">
          <h4 className="pa-profile-row-label">Notify me about</h4>
          <p className="pa-profile-row-desc">Choose what you want to be notified about.</p>
          <div className="pa-profile-notif-checks">
            <label className="pa-profile-notif-check" htmlFor="notif-reminders">
              <input
                id="notif-reminders"
                type="checkbox"
                checked={notifyReminders}
                onChange={(e) => {
                  const val = e.target.checked;
                  setNotifyReminders(val);
                  apiRequest(`/api/patients/${user.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                      reminderNotificationChannel: val ? (channel === "none" ? "push" : channel) : "none",
                      messageNotifications: notifyMessages,
                    }),
                  }).catch(() => setNotifyReminders(!val));
                }}
                className="pa-profile-notif-checkbox"
              />
              <span className="pa-profile-notif-check-label">Reminders</span>
              <span className="pa-profile-notif-check-desc">Get notified when a reminder is due.</span>
            </label>
            <label className="pa-profile-notif-check" htmlFor="notif-messages">
              <input
                id="notif-messages"
                type="checkbox"
                checked={notifyMessages}
                onChange={(e) => {
                  const val = e.target.checked;
                  setNotifyMessages(val);
                  apiRequest(`/api/patients/${user.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ messageNotifications: val }),
                  }).catch(() => setNotifyMessages(!val));
                }}
                className="pa-profile-notif-checkbox"
              />
              <span className="pa-profile-notif-check-label">Messages</span>
              <span className="pa-profile-notif-check-desc">Get notified when your caregiver sends a message or meeting request.</span>
            </label>
          </div>
        </div>

        {/* How to notify */}
        {(notifyReminders || notifyMessages) && (
          <div className="pa-profile-channel-section pa-profile-channel-section--how" role="radiogroup" aria-labelledby="pa-channel-heading">
            <h4 id="pa-channel-heading" className="pa-profile-row-label">How to notify me</h4>
            <p className="pa-profile-row-desc">Applies to all notification types selected above.</p>
            <div className="pa-profile-radio-group">
              <label className="pa-profile-radio">
                <input
                  type="radio"
                  name="notifChannel"
                  value="email"
                  checked={channel === "email"}
                  onChange={() => handleChannelChange("email")}
                  disabled={saving}
                  aria-describedby="pa-channel-email-desc"
                />
                <span>Email</span>
              </label>
              <p id="pa-channel-email-desc" className="pa-profile-radio-desc">Receive an email notification.</p>
              <label className="pa-profile-radio">
                <input
                  type="radio"
                  name="notifChannel"
                  value="push"
                  checked={channel === "push"}
                  onChange={() => handleChannelChange("push")}
                  disabled={saving}
                  aria-describedby="pa-channel-push-desc"
                />
                <span>In-app push</span>
              </label>
              <p id="pa-channel-push-desc" className="pa-profile-radio-desc">Get a notification on this device (works with Add to Home Screen). iOS 16.4+ for iPhone/iPad.</p>
              <label className="pa-profile-radio">
                <input
                  type="radio"
                  name="notifChannel"
                  value="none"
                  checked={channel === "none"}
                  onChange={() => handleChannelChange("none")}
                  disabled={saving}
                />
                <span>None</span>
              </label>
              <p className="pa-profile-radio-desc">Turn off delivery for now without changing your selections above.</p>
            </div>
          </div>
        )}

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
      </div>

      <div className="pa-profile-card" role="region" aria-labelledby="pa-calls-push-heading">
        <h3 id="pa-calls-push-heading" className="pa-profile-card-title">
          Calls (voice &amp; video)
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />
        <p className="pa-profile-row-desc">
          When your caregiver calls and NeuroEase is in the background, we use the same web push service as reminders.
          You can still use Email for reminders if you prefer.
        </p>
        <p className="pa-profile-row-desc">
          {callPushDeviceCount === null && <span className="pa-muted">Checking devices…</span>}
          {callPushDeviceCount !== null && (
            <>
              Devices registered for your account: <strong>{callPushDeviceCount}</strong>
            </>
          )}
        </p>
        <div className="pa-profile-calls-push-row">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label">Incoming call alerts</span>
            <span className="pa-profile-row-desc" id="pa-call-push-desc">
              {callPushSubscribedLocal
                ? "This device can ring for calls when the app is in the background."
                : "Turn on to allow notifications and register this device for incoming calls."}
            </span>
          </div>
          <label className="pa-profile-toggle pa-profile-toggle--calls">
            <input
              type="checkbox"
              checked={callPushSubscribedLocal}
              onChange={(e) => handleCallPushToggle(e.target.checked)}
              disabled={
                callPushBusy
                || saving
                || !("Notification" in window)
                || !("serviceWorker" in navigator)
              }
              aria-describedby="pa-call-push-desc"
            />
            <span className="pa-profile-toggle-slider" />
          </label>
        </div>
        {callPushBusy && (
          <p className="pa-muted pa-profile-calls-push-status" aria-live="polite">Updating…</p>
        )}
      </div>

      {/* Voice & speech — separate from notification channel; applies to Read aloud + speech synthesis */}
      <div className="pa-profile-card" role="region" aria-labelledby="pa-voice-speech-heading">
        <h3 id="pa-voice-speech-heading" className="pa-profile-card-title">
          Voice &amp; speech
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />
        <p className="pa-profile-row-desc pa-profile-voice-intro">
          <strong>Voice</strong> and <strong>speed</strong> control how NeuroEase speaks: the <strong>Read aloud</strong> button on the Reminders tab, and automatic speech (below). They do <strong>not</strong> change game sounds (see Games) or the short system &quot;ding&quot; when a push arrives on iPhone—only the device speech volume applies to spoken text.
        </p>

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

        <div className="pa-profile-voice-test-row">
          <button
            type="button"
            className="pa-btn pa-btn--secondary pa-profile-test-speech-btn"
            onClick={() => {
              setSpeechTesting(true);
              const ok = speakTest(() => setSpeechTesting(false));
              if (!ok) setSpeechTesting(false);
            }}
            disabled={speechTesting || !("speechSynthesis" in window)}
            aria-label="Play a short test phrase"
          >
            {speechTesting ? "Playing…" : "Test speech"}
          </button>
          <p className="pa-profile-row-desc" id="pa-test-speech-desc">
            Use this if you are not sure the device can speak. Turn volume up; on iPhone, use the side buttons while the app is open (speech uses the media volume in many cases).
          </p>
        </div>

        <div className="pa-profile-toggle-row">
          <div className="pa-profile-toggle-text">
            <span className="pa-profile-row-label">Speak reminders automatically</span>
            <span className="pa-profile-row-desc" id="pa-voice-assist-desc">
              When a push reminder arrives, or when you open the app after tapping a notification, read the reminder aloud using the voice above. This is separate from the Read aloud button on Reminders—you can use that even when this is off.
            </span>
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
      </div>

      {/* Games card */}
      <div className="pa-profile-card" role="region" aria-labelledby="pa-games-heading">
        <h3 id="pa-games-heading" className="pa-profile-card-title">
          Games
        </h3>
        <hr className="pa-profile-card-divider" aria-hidden />

        <p className="pa-profile-row-desc" style={{ marginBottom: "1rem" }}>
          These sounds apply only to <strong>Memory</strong> and <strong>Math</strong> games. They do not affect spoken reminders, the Read aloud button, or the system notification tone.
        </p>
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

      {/* Location sharing card */}
      {isGeolocationSupported && (
        <div className="pa-profile-card" role="region" aria-labelledby="pa-location-heading">
          <h3 id="pa-location-heading" className="pa-profile-card-title">
            <MapPin className="pa-profile-card-icon" aria-hidden />
            Location sharing
          </h3>
          <hr className="pa-profile-card-divider" aria-hidden />
          <p className="pa-profile-row-desc pa-profile-location-desc">
            Share your location with your caregiver so they can see where you are and get alerts if you leave a safe zone.
          </p>
          <p className="pa-profile-location-note">
            <strong>For caregivers:</strong> Location is sent automatically. No need for the patient to do anything. When using the app in a browser, tracking works while the app is open. For <strong>24/7 tracking</strong> (even when the app is closed), install the native iOS/Android app – see setup guide in the project docs.
          </p>
          <div className="pa-profile-toggle-row">
            <div className="pa-profile-toggle-text">
              <span className="pa-profile-row-label">Location sharing</span>
              <span className="pa-profile-row-desc" id="pa-location-desc">
                {locationConsent
                  ? locationPauseActive
                    ? `Paused until ${new Date(locationPausedUntil).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                    : geoPermissionStatus === "denied" || locationError
                      ? "On – enable location in Settings to share"
                      : "On – sending location automatically"
                  : "Off"}
              </span>
            </div>
            <label className="pa-profile-toggle">
              <input
                type="checkbox"
                checked={locationConsent === true}
                onChange={(e) => handleLocationConsentChange(e.target.checked)}
                disabled={saving}
                aria-describedby="pa-location-desc"
              />
              <span className="pa-profile-toggle-slider" />
            </label>
          </div>
          {locationConsent && !locationPauseActive && !(geoPermissionStatus === "denied" || locationError) && (
            <button
              type="button"
              className="pa-btn pa-profile-location-send-now"
              onClick={async () => {
                setLocationSending(true);
                sendLocationNow();
                setTimeout(() => setLocationSending(false), 2000);
              }}
              disabled={locationSending}
              aria-label="Send location now"
            >
              {locationSending ? "Sending…" : "Send location now"}
            </button>
          )}
          {locationConsent && (
            <div
              className="pa-profile-location-pause"
              role="group"
              aria-labelledby="pa-location-pause-legend"
            >
              <p id="pa-location-pause-legend" className="pa-profile-location-pause-legend">
                Take a break from sending your location (for example at an appointment). This is <strong>not</strong> the same as turning sharing off at the top.
              </p>
              <p className="pa-profile-row-desc pa-profile-location-pause-intro">
                While it is paused, your caregiver <strong>will not</strong> get new locations. Tap <strong>Sharing on</strong> below to send again, or wait until the pause time ends.
              </p>
              <p className="pa-profile-location-pause-choose" id="pa-location-pause-choose">
                Choose one — tap a button:
              </p>
              <div
                className="pa-pill-segment"
                role="tablist"
                aria-labelledby="pa-location-pause-choose"
              >
                <button
                  type="button"
                  role="tab"
                  className={`pa-pill-segment__btn ${locationPauseSegment === "live" ? "is-active" : ""}`}
                  aria-selected={locationPauseSegment === "live"}
                  disabled={locationPauseBusy || saving}
                  aria-label="Sharing on. Your caregiver receives your location. Tap if you were paused and want to share again."
                  onClick={() => {
                    if (locationPauseActive) handleLocationPauseUntil(null);
                  }}
                >
                  <span className="pa-pill-segment__main">Sharing on</span>
                  <span className="pa-pill-segment__hint">caregiver sees location</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`pa-pill-segment__btn ${locationPauseSegment === "hour" ? "is-active" : ""}`}
                  aria-selected={locationPauseSegment === "hour"}
                  disabled={locationPauseBusy || saving}
                  aria-label="Pause sharing for one hour. Your caregiver will not receive your location during this time."
                  onClick={() =>
                    handleLocationPauseUntil(new Date(Date.now() + 60 * 60 * 1000).toISOString())
                  }
                >
                  <span className="pa-pill-segment__main">Pause 1 hour</span>
                  <span className="pa-pill-segment__hint">no location for 1 hour</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`pa-pill-segment__btn ${locationPauseSegment === "tonight" ? "is-active" : ""}`}
                  aria-selected={locationPauseSegment === "tonight"}
                  disabled={locationPauseBusy || saving}
                  aria-label="Pause sharing until the end of today. Your caregiver will not receive your location until then."
                  onClick={() => handleLocationPauseUntil(getTonightPauseEndIso())}
                >
                  <span className="pa-pill-segment__main">Pause until tonight</span>
                  <span className="pa-pill-segment__hint">stops for the rest of today</span>
                </button>
              </div>
            </div>
          )}
          {locationConsent && (geoPermissionStatus === "denied" || locationError) && (
            <div className="pa-profile-location-warning" role="alert">
              <p className="pa-profile-permission-text">
                {geoPermissionStatus === "denied"
                  ? "Your device has blocked location access for this app. Turn it on in Settings so we can share your location with your caregiver."
                  : locationError}
              </p>
              <p className="pa-profile-permission-iphone">
                <strong>On iPhone:</strong> Settings → Privacy & Security → Location Services. Find this app (or Safari) and set to &quot;While Using the App&quot; or &quot;Always&quot;.
              </p>
              <div className="pa-profile-location-actions">
                <button
                  type="button"
                  className="pa-btn pa-btn--primary pa-profile-location-btn"
                  onClick={() => {
                    setLocationRechecking(true);
                    recheckPermission().finally(() => setLocationRechecking(false));
                  }}
                  disabled={locationRechecking}
                  aria-label="Check if location permission was enabled"
                >
                  {locationRechecking ? "Checking…" : "Check again"}
                </button>
                <button
                  type="button"
                  className="pa-btn pa-profile-location-btn pa-profile-location-btn--secondary"
                  onClick={openLocationSettings}
                  aria-label="Open device Settings"
                >
                  Open Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
