/**
 * Returns a singleton socket.io client for the patient app.
 * Authenticates with the JWT stored in localStorage under the neuroease_patient key.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getStoredAuth } from '../services/apiClient';

const BACKEND_URL = (import.meta.env.VITE_API_BASE || 'http://localhost:5001').replace(/\/api\/?$/, '');

let sharedSocket = null;

export function useSocket() {
    const socketRef = useRef(null);

    useEffect(() => {
        const auth = getStoredAuth();
        if (!auth?.token) return;

        if (!sharedSocket || !sharedSocket.connected) {
            sharedSocket = io(BACKEND_URL, {
                auth: { token: auth.token },
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
