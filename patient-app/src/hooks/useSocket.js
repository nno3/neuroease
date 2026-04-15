/**
 * Single Socket.IO client for the patient app — reconnects when the JWT changes.
 * Call useSocket only from CallProvider. A second mount disconnects sharedSocket and leaves
 * the first hook’s socket stale — incoming calls stop working.
 */
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getStoredAuth } from '../services/apiClient';

function resolveSocketBaseUrl() {
    const raw = import.meta.env.VITE_API_BASE || '';
    if (raw) return raw.replace(/\/api\/?$/, '');
    if (import.meta.env.DEV && typeof window !== 'undefined') {
        return window.location.origin;
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
        return `http://${window.location.hostname}:5001`;
    }
    return 'http://localhost:5001';
}

let sharedSocket = null;

export function useSocket() {
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const token = getStoredAuth()?.token;

    useEffect(() => {
        if (!token) {
            if (sharedSocket) {
                sharedSocket.disconnect();
                sharedSocket = null;
            }
            socketRef.current = null;
            setSocket(null);
            return;
        }

        if (sharedSocket) {
            sharedSocket.disconnect();
            sharedSocket = null;
        }

        let sock = null;
        let keepalive = null;
        let onConnectErr = null;

        const connectTimer = window.setTimeout(() => {
            const base = resolveSocketBaseUrl();
            let lastConnectErrLog = 0;
            sock = io(base, {
                auth: { token },
                transports: import.meta.env.DEV ? ['websocket'] : ['polling', 'websocket'],
                // Mobile + Render: slower backoff avoids tight reconnect storms; more attempts than 10.
                reconnectionAttempts: 50,
                reconnectionDelay: 1500,
                reconnectionDelayMax: 20_000,
                randomizationFactor: 0.5,
                timeout: 45_000,
            });
            sharedSocket = sock;
            socketRef.current = sock;
            setSocket(sock);

            onConnectErr = (err) => {
                const msg = err?.message || String(err);
                const now = Date.now();
                if (import.meta.env.DEV) {
                    console.warn('[socket] connect_error', base, msg);
                    return;
                }
                // Production: throttle (Safari logs every failed WS as [Error] — very noisy).
                if (now - lastConnectErrLog > 25_000) {
                    lastConnectErrLog = now;
                    console.warn('[socket] connect_error (throttled):', msg);
                }
            };
            sock.on('connect_error', onConnectErr);

            keepalive = setInterval(() => {
                if (sock.connected) sock.emit('ping');
            }, 30000);
        }, 0);

        return () => {
            clearTimeout(connectTimer);
            if (keepalive) clearInterval(keepalive);
            if (sock && onConnectErr) sock.off('connect_error', onConnectErr);
            if (sock) {
                sock.disconnect();
                if (sharedSocket === sock) sharedSocket = null;
            }
        };
    }, [token]);

    return { socketRef, socket };
}
