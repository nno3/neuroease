/**
 * Patient app API client – builds request URL (avoids double /api when API_BASE has trailing /api),
 * attaches JWT from localStorage, and parses JSON errors. Auth helpers for activate/login flow.
 */
import { API_BASE } from "../config";

const STORAGE_KEY = "neuroease_patient";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.token && data?.user) return data;
  } catch (_) {}
  return null;
}

export function setStoredAuth(user, token) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  } catch (_) {}
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

/** Build full URL: paths are like "/api/auth/activate". If API_BASE is set to e.g. http://host:5001/api
 * (common in production), concatenating would give /api/api/... and 404; we strip trailing /api once. */
function buildApiUrl(path) {
  const base = (API_BASE || "").replace(/\/api\/?$/, "");
  return base ? `${base}${path.startsWith("/") ? path : "/" + path}` : path;
}

export async function apiRequest(path, options = {}) {
  const auth = getStoredAuth();
  const url = buildApiUrl(path);
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
