/**
 * API base URL for the backend. In dev, leave unset so Vite proxies /api to the backend.
 * For production or cross-device testing set VITE_API_BASE to the backend origin,
 * e.g. http://localhost:5001 or http://192.168.0.65:5001 (trailing /api is optional; we avoid double /api).
 */
export const API_BASE = import.meta.env.VITE_API_BASE || "";
