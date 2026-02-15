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

/**
 * Build request URL. Paths are like "/api/auth/activate".
 * If API_BASE is set (e.g. http://localhost:5001/api), strip trailing /api
 * so we don't end up with /api/api/... and get 404.
 */
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
