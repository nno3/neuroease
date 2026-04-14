/**
 * Caregiver dashboard API client – base URL from env; apiRequest adds Bearer token from
 * localStorage and throws on non-OK response with server message. Used by auth and data services.
 *
 * In dev, default to relative `/api` so Vite proxies to the backend (works from phone via LAN and
 * avoids mixed-content when using `npm run dev:https`). If unset and not dev, use LAN host :5001.
 */
function resolveApiBase() {
    const raw = import.meta.env.VITE_API_BASE || '';
    if (raw) return raw.replace(/\/$/, '');
    if (import.meta.env.DEV) {
        return '/api';
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
        return `http://${window.location.hostname}:5001/api`;
    }
    return 'http://localhost:5001/api';
}

export const API_BASE = resolveApiBase();

const REQUEST_TIMEOUT_MS = 90000; // 90s – Render free tier cold starts can take 30–60s

export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    let authToken = token;
    if (!authToken && import.meta.env.DEV) {
        console.warn('No token found, using mock token for development');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            signal: options.signal ?? controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
                ...options.headers
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Expired/invalid JWT: clear session so ProtectedRoute sends user to /login.
            if (response.status === 401 && token) {
                window.dispatchEvent(new CustomEvent('ne-caregiver-auth-expired'));
            }
            const text = await response.text();
            let errorData = { message: text || "Request failed" };
            try {
                errorData = JSON.parse(text);
            } catch {
                /* body is not JSON */
            }
            const err = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            err.status = response.status;
            err.errors = errorData.errors || [];
            err.data = errorData;
            throw err;
        }

        try {
            return await response.json();
        } catch (parseErr) {
            console.error('Failed to parse JSON response:', parseErr);
            throw new Error('Invalid JSON response from server');
        }
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Request took too long. The server may be waking up from sleep — please try again in a moment.');
        }
        throw err;
    }
}

// Helper for different HTTP methods
export const api = {
    get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, data, options = {}) =>
        apiRequest(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data, options = {}) =>
        apiRequest(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint, options = {}) =>
        apiRequest(endpoint, { ...options, method: 'DELETE' }),
};