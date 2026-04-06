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

        const base = resolveSocketBaseUrl();
        // Dev + Vite HTTPS proxy: websocket-only avoids polling→upgrade races that spam "socket has been ended"
        const sock = io(base, {
            auth: { token },
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
