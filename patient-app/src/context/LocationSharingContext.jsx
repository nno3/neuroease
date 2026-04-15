/**
 * Location sharing context – manages consent, starts/stops location service,
 * and tracks geolocation permission state. Stops on logout.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { apiRequest } from "../services/apiClient";
import {
  startLocationSharing,
  stopLocationSharing,
  stopSimulatedLocationSharing,
  startSimulatedLocationSharing,
  sendLocationNow,
  sendSimulatedLocation,
  isGeolocationSupported,
  getGeolocationPermissionState,
  openLocationSettings,
} from "../services/locationService";

const LocationSharingContext = createContext(null);

function isLocationPauseActive(iso) {
  if (iso == null || iso === "") return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

export function LocationSharingProvider({ children }) {
  const { user } = useAuth();
  const [locationConsent, setLocationConsentState] = useState(null);
  const [locationPausedUntil, setLocationPausedUntilState] = useState(null);
  const [geoPermissionStatus, setGeoPermissionStatus] = useState("unknown");
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(false);

  const setLocationConsent = useCallback((value) => {
    setLocationConsentState(value === true);
  }, []);

  const setLocationPausedUntil = useCallback((value) => {
    if (value === null || value === undefined || value === "") {
      setLocationPausedUntilState(null);
      return;
    }
    setLocationPausedUntilState(typeof value === "string" ? value : new Date(value).toISOString());
  }, []);

  // Fetch profile to get locationConsent when user is set
  useEffect(() => {
    if (!user?.id) {
      setLocationConsentState(null);
      setLocationPausedUntilState(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiRequest(`/api/patients/${user.id}`)
      .then((res) => {
        if (cancelled) return;
        const profile = res?.data?.patient?.Patient ?? res?.data?.patient?.profile ?? null;
        const consent = profile?.locationConsent === true;
        setLocationConsentState(consent);
        const until = profile?.locationPausedUntil ?? null;
        setLocationPausedUntilState(
          until ? (typeof until === "string" ? until : new Date(until).toISOString()) : null
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLocationConsentState(false);
          setLocationPausedUntilState(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  // When pause end time passes, clear local state so sharing can resume without a full refetch
  useEffect(() => {
    if (!locationPausedUntil || !isLocationPauseActive(locationPausedUntil)) return;
    const ms = Math.max(0, new Date(locationPausedUntil).getTime() - Date.now() + 500);
    const tid = setTimeout(() => setLocationPausedUntilState(null), Math.min(ms, 8.64e7));
    return () => clearTimeout(tid);
  }, [locationPausedUntil]);

  // Check geolocation permission (Permissions API or fallback)
  useEffect(() => {
    if (!isGeolocationSupported()) {
      setGeoPermissionStatus("unsupported");
      return;
    }
    getGeolocationPermissionState().then((state) => {
      if (state === "granted" || state === "denied" || state === "prompt") {
        setGeoPermissionStatus(state);
      } else {
        setGeoPermissionStatus("unknown");
      }
    });
  }, [locationConsent, locationError]);

  const pauseActive = isLocationPauseActive(locationPausedUntil);

  // Re-check permission and send location when app becomes visible (user may have changed in Settings or moved)
  useEffect(() => {
    if (!isGeolocationSupported()) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        getGeolocationPermissionState().then((state) => {
          setGeoPermissionStatus(state === "granted" || state === "denied" || state === "prompt" ? state : "unknown");
        });
        if (user?.id && locationConsent === true && !isLocationPauseActive(locationPausedUntil)) {
          sendLocationNow();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user?.id, locationConsent, locationPausedUntil]);

  // Start/stop location service based on user and consent
  useEffect(() => {
    if (!user?.id) {
      stopLocationSharing();
      stopSimulatedLocationSharing();
      setLocationError(null);
      return;
    }
    if (locationConsent !== true || pauseActive) {
      stopLocationSharing();
      stopSimulatedLocationSharing();
      setLocationError(null);
      return;
    }
    // Don't start if we already know permission is denied
    if (geoPermissionStatus === "denied") {
      stopLocationSharing();
      setLocationError("Location permission is off. Enable it in your device Settings to share your location.");
      return;
    }
    startLocationSharing({
      onPermissionDenied: () => {
        setGeoPermissionStatus("denied");
        setLocationError("Location permission was denied. Enable it in your device Settings to share your location.");
        stopLocationSharing();
      },
      onError: (msg) => setLocationError(msg),
    });
    return () => stopLocationSharing();
  }, [user?.id, locationConsent, pauseActive, geoPermissionStatus]);

  // Clear error when consent is turned off
  useEffect(() => {
    if (locationConsent !== true) setLocationError(null);
  }, [locationConsent]);

  /** Re-check permission (e.g. after user enables in Settings). Uses getCurrentPosition as source of truth. */
  const recheckPermission = useCallback(() => {
    if (!isGeolocationSupported()) return Promise.resolve();
    setLocationError(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setGeoPermissionStatus("granted");
          setLocationError(null);
          resolve();
        },
        (err) => {
          if (err.code === 1) {
            setGeoPermissionStatus("denied");
            setLocationError("Location permission is off. Enable it in your device Settings to share your location.");
          }
          resolve();
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
      );
    });
  }, []);

  const value = {
    locationConsent,
    setLocationConsent,
    locationPausedUntil,
    setLocationPausedUntil,
    locationPauseActive: pauseActive,
    geoPermissionStatus,
    locationError,
    loading,
    isGeolocationSupported: isGeolocationSupported(),
    recheckPermission,
    openLocationSettings,
    sendLocationNow,
    sendSimulatedLocation,
    startSimulatedLocationSharing,
    stopSimulatedLocationSharing,
  };

  return (
    <LocationSharingContext.Provider value={value}>
      {children}
    </LocationSharingContext.Provider>
  );
}

export function useLocationSharing() {
  const ctx = useContext(LocationSharingContext);
  if (!ctx) throw new Error("useLocationSharing must be used within LocationSharingProvider");
  return ctx;
}
