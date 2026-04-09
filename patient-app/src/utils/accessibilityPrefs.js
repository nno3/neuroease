/**
 * Patient app display/accessibility preferences (device-local).
 * Applied via data-* on <html>; see index.css.
 */
const STORAGE_KEY = "ne_pa11y_v1";

export const defaultAccessibilityPrefs = {
  textScale: "default", // default | large | larger
  reduceMotion: false,
  boldText: false,
};

export function getAccessibilityPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAccessibilityPrefs };
    const parsed = JSON.parse(raw);
    const { contrast: _omit, ...rest } = parsed;
    const merged = { ...defaultAccessibilityPrefs, ...rest };
    if ("contrast" in parsed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return { ...defaultAccessibilityPrefs };
  }
}

export function setAccessibilityPrefs(partial) {
  const next = { ...getAccessibilityPrefs(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyAccessibilityToDocument(next);
  return next;
}

/** Call on app load so prefs survive refresh (and before first paint if imported early). */
export function applyAccessibilityToDocument(prefs = getAccessibilityPrefs()) {
  const root = document.documentElement;
  const ts = prefs.textScale === "large" || prefs.textScale === "larger" ? prefs.textScale : "default";
  root.dataset.paTextScale = ts;
  delete root.dataset.paContrast;

  if (prefs.reduceMotion) root.dataset.paReduceMotion = "1";
  else delete root.dataset.paReduceMotion;

  if (prefs.boldText) root.dataset.paBold = "1";
  else delete root.dataset.paBold;
}

export function resetAccessibilityPrefs() {
  localStorage.removeItem(STORAGE_KEY);
  applyAccessibilityToDocument({ ...defaultAccessibilityPrefs });
}
