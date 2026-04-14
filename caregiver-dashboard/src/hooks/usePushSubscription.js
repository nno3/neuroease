/**
 * Registers a web push subscription for the logged-in caregiver.
 * Runs once after login; silently skips if push is not supported or VAPID key is missing.
 */
import { useEffect } from 'react';
import { apiRequest, API_BASE } from '../services/apiClient';

/** @returns {{ ok: boolean, error?: string }} */
export async function registerCaregiverPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { ok: false, error: 'This browser does not support web push.' };
    }
    const res = await fetch(`${API_BASE}/push/vapid-public-key`);
    const json = await res.json();
    if (!json?.data?.publicKey) {
        return { ok: false, error: 'Push is not configured on the server.' };
    }
    const vapidKey = json.data.publicKey;
    if (Notification.permission === 'default') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') return { ok: false, error: 'Notification permission was denied.' };
    } else if (Notification.permission !== 'granted') {
        return { ok: false, error: 'Enable notifications in your browser settings for this site.' };
    }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
    }
    await apiRequest('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
                p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
                auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
            },
        }),
    });
    return { ok: true };
}

/** Remove this browser's push subscription (call alerts, etc.) for the logged-in caregiver. */
export async function unregisterCaregiverPushSubscription() {
    if (!('serviceWorker' in navigator)) {
        return { ok: true };
    }
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return { ok: true };
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return { ok: true };
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        try {
            await apiRequest('/push/unsubscribe', {
                method: 'POST',
                body: JSON.stringify({ endpoint }),
            });
        } catch {
            /* server row may already be gone */
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || 'Could not turn off call alerts on this device.' };
    }
}

/** True if this tab's service worker has an active push subscription and permission is granted. */
export async function getThisDevicePushSubscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return false;
        const sub = await reg.pushManager.getSubscription();
        return !!(sub && Notification.permission === 'granted');
    } catch {
        return false;
    }
}

export function usePushSubscription(user) {
    useEffect(() => {
        if (!user) return;
        void registerCaregiverPushSubscription().catch(() => {});
    }, [user?.id]); // eslint-disable-line
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
