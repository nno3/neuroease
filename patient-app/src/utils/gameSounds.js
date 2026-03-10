/**
 * Game sound effects preference – persisted in localStorage.
 * Used by Memory Match and Math Practice. Default: enabled.
 */
const STORAGE_KEY = "neuroease_gameSoundsEnabled";

export function getGameSoundsEnabled() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null || val === "true";
  } catch {
    return true;
  }
}

export function setGameSoundsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch (_) {}
}
