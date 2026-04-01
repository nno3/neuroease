/**
 * Registers a web push subscription for the logged-in caregiver.
 * Runs once after login; silently skips if push is not supported or VAPID key is missing.
 */
import { useEffect } from 'react';
import { apiRequest, API_BASE } from '../services/apiClient';

export function usePushSubscription(user) {
    useEffect(() => {
        if (!user) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        (async () => {
            try {
                // Fetch VAPID public key
                const res = await fetch(`${API_BASE}/push/vapid-public-key`);
                const json = await res.json();
                if (!json?.data?.publicKey) return;
                const vapidKey = json.data.publicKey;

                // Register service worker
                const reg = await navigator.serviceWorker.register('/sw.js');
                await navigator.serviceWorker.ready;

                // Check existing subscription
                let sub = await reg.pushManager.getSubscription();
                if (!sub) {
                    sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidKey),
                    });
                }

                // Save to backend
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
            } catch (_) {
                // Push is optional — never block the UI
            }
        })();
    }, [user?.id]); // eslint-disable-line
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
