/**
 * Single source of truth for “every route” integration checks.
 * Keep in sync with src/httpApp.js mounts and src/routes/*.js.
 */

/** @typedef {{ method: string, path: string, query?: object, send?: object }} RouteCall */

const ACTIVITY_Q = { from: '2026-01-01', to: '2026-01-31' };
const ACTIVITY_LOG_Q = { patientId: 'all', type: 'all', ...ACTIVITY_Q };
const GAMES_SUMMARY_Q = { ...ACTIVITY_Q, patientId: 'all' };

/**
 * Routes that must return 401 when called with no Authorization header.
 * Uses placeholder path params; auth runs before controller/DB.
 * @returns {RouteCall[]}
 */
function routesRequireAuth401() {
    const patientUserId = 999;
    const otherUserId = 888;
    return [
        { method: 'get', path: `/api/auth/user/${otherUserId}/name` },
        { method: 'get', path: '/api/auth/profile' },
        { method: 'put', path: '/api/auth/profile', send: { name: 'RouteTest' } },
        { method: 'delete', path: '/api/auth/profile' },
        { method: 'post', path: '/api/auth/logout' },

        { method: 'post', path: '/api/patients/assign', send: { email: 'noop@example.com' } },
        { method: 'post', path: '/api/patients', send: { email: 'noop@example.com' } },
        { method: 'get', path: '/api/patients' },
        { method: 'put', path: `/api/patients/${patientUserId}`, send: { name: 'X' } },
        { method: 'delete', path: `/api/patients/${patientUserId}` },
        { method: 'post', path: `/api/patients/${patientUserId}/restore` },
        { method: 'post', path: `/api/patients/${patientUserId}/archive` },
        { method: 'post', path: `/api/patients/${patientUserId}/send-invite` },
        { method: 'post', path: `/api/patients/${patientUserId}/unarchive` },
        { method: 'get', path: '/api/patients/archived' },
        { method: 'get', path: '/api/patients/archive-audit' },
        { method: 'get', path: `/api/patients/${patientUserId}` },

        {
            method: 'post',
            path: '/api/reminders',
            send: {
                patientId: patientUserId,
                title: 't',
                message: 'm',
                reminderType: 'general',
                scheduledTime: new Date(Date.now() + 3600000).toISOString(),
                recurrence: 'once',
            },
        },
        { method: 'get', path: `/api/reminders/patient/${patientUserId}` },
        { method: 'put', path: '/api/reminders/1', send: { title: 'u' } },
        { method: 'delete', path: '/api/reminders/1' },

        { method: 'get', path: '/api/activity/summary', query: ACTIVITY_Q },
        { method: 'get', path: '/api/activity/log', query: ACTIVITY_LOG_Q },
        { method: 'get', path: '/api/activity/games-today' },
        { method: 'get', path: '/api/activity/patient-summaries' },
        { method: 'get', path: '/api/activity/games-summary', query: GAMES_SUMMARY_Q },
        { method: 'get', path: '/api/activity/recent-games' },

        { method: 'post', path: '/api/location/patient/update', send: { latitude: 0, longitude: 0 } },
        { method: 'post', path: '/api/location/update', send: { patientId: patientUserId, latitude: 0, longitude: 0 } },
        { method: 'get', path: '/api/location/latest' },
        { method: 'get', path: '/api/location/history' },
        { method: 'get', path: '/api/location/alerts' },
        { method: 'get', path: '/api/location/status' },

        { method: 'post', path: '/api/push/subscribe', send: { endpoint: 'https://e.example.com', keys: {} } },
        { method: 'post', path: '/api/push/unsubscribe', send: {} },
        { method: 'get', path: '/api/push/status' },

        {
            method: 'post',
            path: '/api/safe-zones',
            send: { patientId: patientUserId, name: 'z', centerLat: 0, centerLng: 0, radius: 100 },
        },
        { method: 'get', path: '/api/safe-zones', query: { patientId: String(patientUserId) } },
        { method: 'put', path: '/api/safe-zones/1', send: { name: 'z2', centerLat: 1, centerLng: 1 } },
        { method: 'delete', path: '/api/safe-zones/1' },

        {
            method: 'post',
            path: '/api/games',
            send: {
                gameType: 'math',
                score: 1,
                duration: 10,
                maxScore: 5,
                difficulty: 'normal',
            },
        },

        { method: 'get', path: '/api/messages/contacts' },
        { method: 'get', path: '/api/messages/unread-count' },
        { method: 'get', path: `/api/messages/conversation/${otherUserId}` },
        {
            method: 'post',
            path: '/api/messages',
            send: { receiverId: otherUserId, content: 'hi' },
        },
        { method: 'patch', path: '/api/messages/1/meeting', send: { status: 'accepted' } },
        { method: 'delete', path: '/api/messages/1/meeting' },
    ];
}

/**
 * Public endpoints (no Bearer token). Must not respond 401 solely due to missing token.
 * Some return 400/503 for other reasons.
 * @returns {RouteCall[]}
 */
function publicRoutesSmoke() {
    return [
        { method: 'post', path: '/api/auth/register', send: {} },
        { method: 'get', path: '/api/auth/verify-email' },
        { method: 'post', path: '/api/auth/verify-email', send: {} },
        { method: 'post', path: '/api/auth/resend-verification', send: {} },
        { method: 'post', path: '/api/auth/activate', send: {} },
        { method: 'get', path: '/api/auth/activate' },
        { method: 'post', path: '/api/auth/patient/request-login', send: {} },
        { method: 'post', path: '/api/auth/patient/verify-link', send: {} },
        { method: 'get', path: '/api/auth/patient/verify-link' },
        { method: 'post', path: '/api/auth/patient/verify-code', send: {} },
        { method: 'get', path: '/api/push/vapid-public-key' },
        { method: 'get', path: '/api/health' },
    ];
}

/**
 * requireCaregiver routes — patient JWT must yield 403 before body validation where applicable.
 * @returns {RouteCall[]}
 */
function caregiverOnly403() {
    const patientUserId = 999;
    return [
        { method: 'post', path: '/api/patients/assign', send: { email: 'x@example.com' } },
        { method: 'post', path: '/api/patients', send: {} },
        { method: 'get', path: '/api/patients' },
        { method: 'delete', path: `/api/patients/${patientUserId}` },
        { method: 'post', path: `/api/patients/${patientUserId}/restore` },
        { method: 'post', path: `/api/patients/${patientUserId}/archive` },
        { method: 'post', path: `/api/patients/${patientUserId}/send-invite` },
        { method: 'post', path: `/api/patients/${patientUserId}/unarchive` },
        { method: 'get', path: '/api/patients/archived' },
        { method: 'get', path: '/api/patients/archive-audit' },
        { method: 'post', path: '/api/location/update', send: { patientId: patientUserId, latitude: 0, longitude: 0 } },
        { method: 'get', path: '/api/location/latest' },
        { method: 'get', path: '/api/location/history' },
        { method: 'get', path: '/api/location/alerts' },
        { method: 'get', path: '/api/location/status' },
        { method: 'post', path: '/api/safe-zones', send: {} },
        { method: 'get', path: '/api/safe-zones', query: { patientId: String(patientUserId) } },
        { method: 'put', path: '/api/safe-zones/1', send: { name: 'z' } },
        { method: 'delete', path: '/api/safe-zones/1' },
    ];
}

/**
 * requirePatient routes — caregiver JWT must yield 403.
 * @returns {RouteCall[]}
 */
function patientOnly403() {
    return [
        {
            method: 'post',
            path: '/api/location/patient/update',
            send: { latitude: 51.5, longitude: -0.12 },
        },
    ];
}

module.exports = {
    routesRequireAuth401,
    publicRoutesSmoke,
    caregiverOnly403,
    patientOnly403,
};
