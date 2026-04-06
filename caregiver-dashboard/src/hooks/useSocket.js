/**
 * Single Socket.IO client for the caregiver dashboard — reconnects when JWT changes.
 * Do not depend on route: reconnecting on every navigation drops the socket from user rooms
 * so call signalling (call:offer) never reaches the other party.
 *
 * Call useSocket only from CallProvider. A second mount disconnects sharedSocket and leaves
 * the first hook’s socket stale — incoming calls stop working.
 */
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/** Same-origin in dev so Vite can proxy /socket.io (needed for HTTPS dev:https + phone). */
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
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;

    useEffect(() => {
        const t = localStorage.getItem('token');
        if (!t) {
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

        const base = resolveSocketBaseUrl();
        // Dev + Vite HTTPS proxy: websocket-only avoids polling→upgrade races that spam "socket has been ended"
        const sock = io(base, {
            auth: { token: t },
            transports: import.meta.env.DEV ? ['websocket'] : ['polling', 'websocket'],
            reconnectionAttempts: 10,
            reconnectionDelay: 500,
        });
        sharedSocket = sock;
        socketRef.current = sock;
        setSocket(sock);

        const onConnectErr = (err) => {
            if (import.meta.env.DEV) console.warn('[socket] connect_error', base, err?.message || err);
        };
        sock.on('connect_error', onConnectErr);

        const keepalive = setInterval(() => {
            if (sock.connected) sock.emit('ping');
        }, 30000);

        return () => {
            clearInterval(keepalive);
            sock.off('connect_error', onConnectErr);
            sock.disconnect();
            if (sharedSocket === sock) sharedSocket = null;
        };
    }, [token]);

    return { socketRef, socket };
}
