/**
 * Caregiver dashboard API client – base URL from env; apiRequest adds Bearer token from
 * localStorage and throws on non-OK response with server message. Used by auth and data services.
 */
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api';

const REQUEST_TIMEOUT_MS = 90000; // 90s – Render free tier cold starts can take 30–60s

export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    let authToken = token;
    if (!authToken && process.env.NODE_ENV === 'development') {
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
            const text = await response.text();
            let errorData = { message: text || "Request failed" };
            try {
                errorData = JSON.parse(text);
            } catch (_) {}
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