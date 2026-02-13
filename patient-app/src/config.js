/**
 * API base URL for the backend. In dev, Vite can proxy /api to the backend;
 * set VITE_API_BASE when the app is served from a different origin (e.g. production).
 */
export const API_BASE = import.meta.env.VITE_API_BASE || "";
