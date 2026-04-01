/**
 * Returns a singleton socket.io client connected to the backend.
 * Authenticates with the JWT stored in localStorage.
 * Sends a keepalive ping every 30s to prevent Render free tier from closing the connection.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = (import.meta.env.VITE_API_BASE || 'http://localhost:5001').replace(/\/api\/?$/, '');

let sharedSocket = null;

export function useSocket() {
    const socketRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (!sharedSocket || !sharedSocket.connected) {
            sharedSocket = io(BACKEND_URL, {
                auth: { token },
                transports: ['websocket'],
                reconnectionAttempts: 5,
            });
        }
        socketRef.current = sharedSocket;

        const keepalive = setInterval(() => {
            if (sharedSocket?.connected) sharedSocket.emit('ping');
        }, 30000);

        return () => clearInterval(keepalive);
    }, []);

    return socketRef;
}
