/**
 * Voice-assist reminders: read aloud when user opens app after a push.
 * Settings in localStorage; pending reminders in IndexedDB (written by service worker).
 */

const STORAGE_KEY = "neuroease_voiceAssistOnOpen";
const VOICE_KEY = "neuroease_voiceAssistVoice";
const RATE_KEY = "neuroease_voiceAssistRate";
const SPOKEN_KEY = "neuroease_voiceAssistSpoken";
const DB_NAME = "neuroease-voice-assist";
const STORE_NAME = "pending";
const PENDING_ID = "latest";

export function getVoiceAssistEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setVoiceAssistEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch (_) {}
}

export function getVoiceAssistVoice() {
  try {
    return localStorage.getItem(VOICE_KEY) || "";
  } catch {
    return "";
  }
}

export function setVoiceAssistVoice(voiceUri) {
  try {
    localStorage.setItem(VOICE_KEY, voiceUri || "");
  } catch (_) {}
}

export function getVoiceAssistRate() {
  try {
    const r = parseFloat(localStorage.getItem(RATE_KEY));
    return Number.isFinite(r) ? r : 0.95;
  } catch {
    return 0.95;
  }
}

export function setVoiceAssistRate(rate) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch (_) {}
}

function getSpokenIds() {
  try {
    const raw = sessionStorage.getItem(SPOKEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addSpokenId(id) {
  try {
    const set = getSpokenIds();
    set.add(String(id));
    sessionStorage.setItem(SPOKEN_KEY, JSON.stringify([...set]));
  } catch (_) {}
}

/**
 * Get and remove the pending reminder from IndexedDB (written by SW on push).
 * Returns { reminderId, title, body } or null if none.
 */
export function getAndClearPendingReminder() {
  return new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      resolve(null);
      return;
    }
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(PENDING_ID);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          store.delete(PENDING_ID);
          resolve({
            reminderId: data.reminderId,
            title: data.title || "Reminder",
            body: data.body || "",
          });
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function applySpeechOptions(utterance) {
  utterance.volume = 1;
  utterance.rate = getVoiceAssistRate();
  const voiceUri = getVoiceAssistVoice();
  if (voiceUri && "speechSynthesis" in window) {
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(
      (v) =>
        v.uri === voiceUri ||
        v.name === voiceUri ||
        `${v.name}|${v.lang}` === voiceUri
    );
    if (voice) utterance.voice = voice;
  }
}

/**
 * Speak a test message (for debugging). Returns true if speech started.
 * Calls onEnd when speech finishes or errors (so UI can clear "Playing…").
 */
export function speakTest(onEnd) {
  if (!("speechSynthesis" in window)) return false;
  try {
    const u = new SpeechSynthesisUtterance("Test. If you hear this, voice assist is working.");
    applySpeechOptions(u);
    u.onend = u.onerror = () => {
      if (typeof onEnd === "function") onEnd();
    };
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak the reminder if not already spoken this session. Marks as spoken.
 */
export function speakReminderIfNew(pending) {
  if (!pending) return;
  const { reminderId, title, body } = pending;
  const spoken = getSpokenIds();
  if (spoken.has(String(reminderId))) return;
  addSpokenId(reminderId);
  const text = body ? `${title}. ${body}` : title;
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    applySpeechOptions(u);
    speechSynthesis.speak(u);
  } catch (_) {}
}

/**
 * Speak a list of reminders aloud. Uses Profile voice/speed settings.
 * items: array of { occurrence: { reminder, effectiveScheduledTime }, section: "overdue"|"today"|"upcoming", completed?: boolean }
 * onEnd: called when all speech finishes or is cancelled.
 * Returns { start: () => void, stop: () => void } - call start() to begin, stop() to cancel.
 */
export function speakReminderList(items, onEnd) {
  if (!("speechSynthesis" in window)) {
    if (typeof onEnd === "function") onEnd();
    return { start: () => {}, stop: () => {} };
  }
  const phrases = [];
  let lastSection = null;
  const RECURRENCE = { once: null, daily: "Daily", weekly: "Weekly" };
  for (const { occurrence, section, completed: itemCompleted } of items) {
    const { reminder, effectiveScheduledTime } = occurrence;
    if (section !== lastSection) {
      if (section === "overdue") phrases.push("Overdue reminders.");
      else if (section === "today") phrases.push("Due today.");
      else if (section === "upcoming") phrases.push("Upcoming.");
      lastSection = section;
    }
    const d = new Date(effectiveScheduledTime);
    const timeStr = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const dateStr = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    let text = timeStr ? `At ${timeStr}` : "";
    if (dateStr && section === "upcoming") text += text ? `, ${dateStr}` : dateStr;
    if (text) text += ". ";
    text += reminder.title || "Reminder";
    if (reminder.message) text += `. ${reminder.message}`;
    const rec = RECURRENCE[reminder.recurrence];
    if (rec) text += `. ${rec}.`;
    const completed = itemCompleted ?? (reminder.isCompleted || (reminder.completedAt && section !== "upcoming"));
    if (completed) text += " Completed.";
    phrases.push(text);
  }
  if (phrases.length === 0) {
    if (typeof onEnd === "function") onEnd();
    return { start: () => {}, stop: () => {} };
  }
  let index = 0;
  const next = () => {
    if (index >= phrases.length) {
      if (typeof onEnd === "function") onEnd();
      return;
    }
    const u = new SpeechSynthesisUtterance(phrases[index]);
    applySpeechOptions(u);
    u.onend = u.onerror = () => {
      index++;
      next();
    };
    speechSynthesis.speak(u);
  };
  const stop = () => {
    speechSynthesis.cancel();
    if (typeof onEnd === "function") onEnd();
  };
  return {
    start: next,
    stop,
  };
}

/** Get available voices. Call when Profile mounts; also listen for voiceschanged. Deduplicates by name+lang. */
export function getAvailableVoices() {
  if (!("speechSynthesis" in window)) return [];
  const seen = new Set();
  return speechSynthesis
    .getVoices()
    .filter((v) => {
      if (!v.lang.startsWith("en")) return false;
      const key = `${v.name}|${v.lang}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
