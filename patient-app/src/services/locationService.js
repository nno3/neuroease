/**
 * Location sharing service – captures geolocation and POSTs to backend when enabled.
 * Uses watchPosition for continuous updates when the app is in the foreground.
 * When offline, locations are queued and sent when the connection is restored.
 *
 * For 24/7 passive tracking, a native app is needed. See Profile for caregiver guidance.
 */
import { apiRequest } from "./apiClient";

const THROTTLE_MS = 30 * 1000; // Send at most every 30 seconds to avoid API overload
const QUEUE_KEY = "neuroease_location_queue";
const MAX_QUEUE_SIZE = 100; // Cap queue to avoid storage bloat

let watchId = null;
let watcherId = null;
let lastPostTime = 0;
let onPermissionDenied = null;
let onError = null;
let onlineListener = null;

function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch (_) {}
}

function addToQueue(payload) {
  const queue = getQueue();
  queue.push(payload);
  saveQueue(queue);
}

/** Send queued locations when back online. */
async function flushQueue() {
  if (!navigator.onLine) return;
  const queue = getQueue();
  if (queue.length === 0) return;
  const remaining = [];
  for (const item of queue) {
    try {
      await apiRequest("/api/location/patient/update", {
        method: "POST",
        body: JSON.stringify(item),
      });
    } catch (err) {
      if (err?.status === 403) continue;
      remaining.push(item);
    }
  }
  saveQueue(remaining);
}

/** Build payload from web Position or native location object. */
function buildPayload(location) {
  const lat = location.latitude ?? location.coords?.latitude;
  const lng = location.longitude ?? location.coords?.longitude;
  const acc = location.accuracy ?? location.coords?.accuracy;
  return {
    latitude: lat,
    longitude: lng,
    timestamp: location.time ?? Date.now(),
    accuracy: acc != null ? Math.round(acc) : undefined,
  };
}

/**
 * Post location to backend. Queues when offline or on network failure.
 */
async function postPosition(location) {
  const payload = buildPayload(location);
  if (!navigator.onLine) {
    addToQueue(payload);
    return;
  }
  try {
    await apiRequest("/api/location/patient/update", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err?.status === 403) return;
    addToQueue(payload);
    if (onError) onError(err?.message || "Failed to send location.");
  }
}

/**
 * Maybe send position (throttled). Returns true if sent.
 */
function maybeSendPosition(position) {
  const now = Date.now();
  if (now - lastPostTime >= THROTTLE_MS) {
    lastPostTime = now;
    postPosition(position).catch((err) => {
      if (onError) onError(err?.message || "Failed to send location.");
    });
    return true;
  }
  return false;
}

/**
 * Capture and send immediately (no throttle). Handles PERMISSION_DENIED.
 */
function captureAndSendNow() {
  if (!("geolocation" in navigator)) {
    if (onError) onError("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      lastPostTime = Date.now();
      postPosition(position).catch((err) => {
        if (onError) onError(err?.message || "Failed to send location.");
      });
    },
    (err) => {
      if (err.code === 1) {
        if (onPermissionDenied) onPermissionDenied();
      } else if (onError) {
        onError(err?.message || "Location error.");
      }
    },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
  );
}

/**
 * Check if running as native Capacitor app (24/7 tracking available).
 */
async function checkNativeApp() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Start location sharing. Uses native background plugin when in Capacitor (24/7),
 * otherwise watchPosition when in browser (foreground only).
 *
 * @param {Object} callbacks
 * @param {() => void} callbacks.onPermissionDenied - called when user denies permission
 * @param {(msg: string) => void} [callbacks.onError] - called on other errors
 */
export async function startLocationSharing({ onPermissionDenied: onDenied, onError: onErr } = {}) {
  await stopLocationSharing();
  onPermissionDenied = onDenied;
  onError = onErr;

  onlineListener = () => flushQueue();
  window.addEventListener("online", onlineListener);
  if (navigator.onLine) flushQueue();

  const isNative = await checkNativeApp();

  if (isNative) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "NeuroEase is sharing your location with your caregiver.",
          backgroundTitle: "Location sharing",
          requestPermissions: true,
          stale: false,
          distanceFilter: 50,
        },
        (location, error) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") {
              if (onPermissionDenied) onPermissionDenied();
            } else if (onError) {
              onError(error.message || "Location error.");
            }
            return;
          }
          if (location) maybeSendPosition(location);
        }
      );
      lastPostTime = 0;
      return;
    } catch (err) {
      if (onError) onError(err?.message || "Could not start background location.");
      return;
    }
  }

  if (!("geolocation" in navigator)) {
    if (onError) onError("Geolocation is not supported by this browser.");
    return;
  }

  captureAndSendNow();

  watchId = navigator.geolocation.watchPosition(
    (position) => maybeSendPosition(position),
    (err) => {
      if (err.code === 1) {
        if (onPermissionDenied) onPermissionDenied();
        stopLocationSharing();
      } else if (onError) {
        onError(err?.message || "Location error.");
      }
    },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
  );
}

/**
 * Send location immediately (e.g. when app returns to foreground).
 */
export function sendLocationNow() {
  if (watcherId != null) {
    lastPostTime = 0;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => postPosition(p).catch(() => {}),
        () => {},
        { maximumAge: 60000 }
      );
    }
  }
  if (watchId != null) captureAndSendNow();
}

/**
 * Stop location sharing.
 */
export async function stopLocationSharing() {
  if (watcherId != null) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
    } catch (_) {}
    watcherId = null;
  }
  if (watchId != null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (onlineListener) {
    window.removeEventListener("online", onlineListener);
    onlineListener = null;
  }
  onPermissionDenied = null;
  onError = null;
}

/**
 * Check if geolocation is supported.
 */
export function isGeolocationSupported() {
  return "geolocation" in navigator;
}

/**
 * Get current permission state (if Permissions API is available).
 * Falls back to attempting getCurrentPosition with a quick timeout to infer state.
 */
export function getGeolocationPermissionState() {
  if (!isGeolocationSupported()) return "unsupported";
  if ("permissions" in navigator) {
    return navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => result.state)
      .catch(() => "unknown");
  }
  return Promise.resolve("unknown");
}

/** Preset simulated locations (no real GPS). */
export const SIMULATED_LOCATIONS = [
  { id: "home", name: "Home", lat: 52.2053, lng: 0.1218 },
  { id: "park", name: "Park", lat: 52.2104, lng: 0.1165 },
  { id: "supermarket", name: "Supermarket", lat: 52.1989, lng: 0.1302 },
  { id: "pharmacy", name: "Pharmacy", lat: 52.2071, lng: 0.1256 },
  { id: "cafe", name: "Café", lat: 52.2034, lng: 0.1189 },
  { id: "outside", name: "Outside safe zone", lat: 52.25, lng: 0.2 },
];

let simulatedInterval = null;

/**
 * Send a simulated location (usability testing only). No real GPS.
 */
export async function sendSimulatedLocation(lat, lng) {
  const payload = { latitude: lat, longitude: lng, timestamp: Date.now() };
  if (!navigator.onLine) {
    addToQueue(payload);
    return;
  }
  try {
    await apiRequest("/api/location/patient/update", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err?.status === 403) return;
    addToQueue(payload);
  }
}

/**
 * Start sending simulated location every 30s (usability testing).
 */
export function startSimulatedLocationSharing(lat, lng) {
  stopSimulatedLocationSharing();
  sendSimulatedLocation(lat, lng);
  simulatedInterval = setInterval(() => sendSimulatedLocation(lat, lng), THROTTLE_MS);
}

/**
 * Stop simulated location sharing.
 */
export function stopSimulatedLocationSharing() {
  if (simulatedInterval) {
    clearInterval(simulatedInterval);
    simulatedInterval = null;
  }
}

/**
 * Attempt to open device Location Settings. Works in some environments (e.g. Android WebView,
 * certain PWAs); often does nothing in standard mobile browsers due to security restrictions.
 */
export function openLocationSettings() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  if (isAndroid) {
    try {
      window.open("intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end", "_blank");
      return;
    } catch (_) {}
  }
  if (isIOS) {
    try {
      window.location.href = "app-settings:";
      return;
    } catch (_) {}
  }
  try {
    window.open("app-settings:", "_blank");
  } catch (_) {}
}
