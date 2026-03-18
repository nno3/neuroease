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
  sendLocationNow,
  isGeolocationSupported,
  getGeolocationPermissionState,
  openLocationSettings,
} from "../services/locationService";

const LocationSharingContext = createContext(null);

export function LocationSharingProvider({ children }) {
  const { user } = useAuth();
  const [locationConsent, setLocationConsentState] = useState(null);
  const [geoPermissionStatus, setGeoPermissionStatus] = useState("unknown");
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(false);

  const setLocationConsent = useCallback((value) => {
    setLocationConsentState(value === true);
  }, []);

  // Fetch profile to get locationConsent when user is set
  useEffect(() => {
    if (!user?.id) {
      setLocationConsentState(null);
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
      })
      .catch(() => {
        if (!cancelled) setLocationConsentState(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

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

  // Re-check permission and send location when app becomes visible (user may have changed in Settings or moved)
  useEffect(() => {
    if (!isGeolocationSupported()) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        getGeolocationPermissionState().then((state) => {
          setGeoPermissionStatus(state === "granted" || state === "denied" || state === "prompt" ? state : "unknown");
        });
        if (user?.id && locationConsent === true) sendLocationNow();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user?.id, locationConsent]);

  // Start/stop location service based on user and consent
  useEffect(() => {
    if (!user?.id) {
      stopLocationSharing();
      setLocationError(null);
      return;
    }
    if (locationConsent !== true) {
      stopLocationSharing();
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
  }, [user?.id, locationConsent, geoPermissionStatus]);

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
    geoPermissionStatus,
    locationError,
    loading,
    isGeolocationSupported: isGeolocationSupported(),
    recheckPermission,
    openLocationSettings,
    sendLocationNow,
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
