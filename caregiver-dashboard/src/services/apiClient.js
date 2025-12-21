const API_BASE = 'http://localhost:5001/api';

export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers
        }
    });

    return res.json();
}
