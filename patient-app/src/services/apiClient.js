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

export async function apiRequest(path, options = {}) {
  const auth = getStoredAuth();
  const url = `${API_BASE}${path}`;
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
