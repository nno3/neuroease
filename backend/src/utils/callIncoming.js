/**
 * Pending WebRTC offers for callees who were offline — replay on socket connect.
 * Sends web push when a call is offered so mobile PWA can wake.
 */
const { User, PushSubscription } = require('../models');
const { configureVapid, sendPush } = require('./pushService');

const pendingByCallee = new Map();
const PENDING_MS = 120_000;

function _now() {
    return Date.now();
}

function storePendingOffer(calleeId, payload) {
    const id = Number(calleeId);
    if (!Number.isFinite(id)) return;
    pendingByCallee.set(id, {
        from: payload.from,
        offer: payload.offer,
        callType: payload.callType || 'video',
        _expires: _now() + PENDING_MS,
    });
}

/**
 * Return a copy of the pending offer for replay (does not remove).
 */
function getPendingOfferForCallee(calleeId) {
    const id = Number(calleeId);
    if (!Number.isFinite(id)) return null;
    const row = pendingByCallee.get(id);
    if (!row) return null;
    if (_now() > row._expires) {
        pendingByCallee.delete(id);
        return null;
    }
    return {
        from: row.from,
        offer: row.offer,
        callType: row.callType,
    };
}

function clearPendingForCallee(calleeId) {
    const id = Number(calleeId);
    if (Number.isFinite(id)) pendingByCallee.delete(id);
}

function resolveOpenUrlForUser(userType, fromUserId, callType) {
    const ct = callType === 'video' ? 'video' : 'audio';
    const q = `callPeer=${fromUserId}&callType=${encodeURIComponent(ct)}`;
    const raw =
        (userType === 'patient' ? process.env.PATIENT_APP_URL : process.env.FRONTEND_URL) || '';
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    try {
        const u = new URL(trimmed);
        const p = u.pathname.replace(/\/$/, '');
        u.pathname = `${p}/messages`.replace(/\/+/g, '/');
        u.search = q;
        return u.toString();
    } catch {
        const base = trimmed.replace(/\/$/, '');
        return `${base}/messages?${q}`;
    }
}

async function notifyIncomingCallViaPush({ calleeUserId, fromUserId, callType }) {
    if (!configureVapid()) return;
    const callee = await User.findByPk(calleeUserId, {
        attributes: ['id', 'userType'],
    });
    if (!callee) return;
    const caller = await User.findByPk(fromUserId, { attributes: ['id', 'name'] });
    const callerName = (caller && caller.name) || 'Someone';
    const openUrl = resolveOpenUrlForUser(callee.userType, fromUserId, callType);
    if (!openUrl) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[call] push skipped: set PATIENT_APP_URL / FRONTEND_URL for deep links');
        }
        return;
    }
    const subs = await PushSubscription.findAll({ where: { userId: calleeUserId } });
    if (!subs.length) return;
    const payload = {
        title: 'Incoming call',
        body: `${callerName} — ${callType === 'video' ? 'Video' : 'Audio'} call`,
        kind: 'incoming-call',
        openUrl,
        fromUserId,
        callType: callType === 'video' ? 'video' : 'audio',
    };
    for (const sub of subs) {
        try {
            await sendPush(sub, payload);
        } catch (err) {
            console.warn('[call] incoming-call push failed', err?.message || err);
        }
    }
}

module.exports = {
    storePendingOffer,
    getPendingOfferForCallee,
    clearPendingForCallee,
    notifyIncomingCallViaPush,
};
