/**
 * Listens for: (1) postMessage from SW when push arrives (app already open → speak immediately);
 * (2) visibility change when user returns to app (e.g. after tapping notification);
 * (3) mount (user opened app from notification click → new page, visibilitychange may not fire).
 */
import React from 'react';
import { useEffect, useRef } from "react";
import {
  getVoiceAssistEnabled,
  getAndClearPendingReminder,
  speakReminderIfNew,
} from "../utils/voiceAssist";

const MIN_INTERVAL_MS = 2000; // avoid rapid re-speak when switching tabs
const MOUNT_DELAY_MS = 150; // let IndexedDB/SW settle when opening from notification click

function trySpeak(pending, lastSpeakRef) {
  if (!pending || !getVoiceAssistEnabled()) return;
  const now = Date.now();
  if (now - lastSpeakRef.current < MIN_INTERVAL_MS) return;
  speakReminderIfNew(pending);
  lastSpeakRef.current = now;
}

export default function VoiceAssistListener() {
  const lastSpeakRef = useRef(0);

  useEffect(() => {
    // 1. SW postMessage: app is open when push arrives → speak immediately
    const onMessage = (event) => {
      const msg = event.data;
      if (msg?.type === "voice-assist-push" && msg.reminderId != null) {
        trySpeak(
          { reminderId: msg.reminderId, title: msg.title || "Reminder", body: msg.body || "" },
          lastSpeakRef
        );
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    // 2. Visibility change: user switched back to app
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      getAndClearPendingReminder().then((pending) => trySpeak(pending, lastSpeakRef));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 3. Mount: user opened app from notification click (new window loads, visibilitychange may not fire)
    const mountTimer = setTimeout(() => {
      getAndClearPendingReminder().then((pending) => trySpeak(pending, lastSpeakRef));
    }, MOUNT_DELAY_MS);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(mountTimer);
    };
  }, []);

  return null;
}
