/**
 * CallProvider – single shared WebRTC call session for the patient app.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import { apiRequest } from '../services/apiClient';
import { CallContext } from './callStateContext';

function samePeerId(a, b) {
    if (a == null || b == null) return false;
    return Number(a) === Number(b);
}

function pickDisplayName(res) {
    if (!res || typeof res !== 'object') return null;
    const inner = res.data;
    if (inner && typeof inner === 'object' && typeof inner.name === 'string') {
        const t = inner.name.trim();
        return t || null;
    }
    if (typeof res.name === 'string') {
        const t = res.name.trim();
        return t || null;
    }
    return null;
}

export function CallProvider({ children }) {
    const { socketRef, socket } = useSocket();
    const notifRef = useRef(null);
    const nameByPeerIdRef = useRef(new Map());
    const [contacts, setContacts] = useState([]);
    const [callerName, setCallerName] = useState('Unknown');

    const fetchContacts = useCallback(async () => {
        try {
            const res = await apiRequest('/api/messages/contacts');
            setContacts(res.data || []);
        } catch { /* ignore */ }
    }, []);

    const recordMissedCallAsCaller = useCallback(
        async (peerId) => {
            try {
                await apiRequest('/api/messages', {
                    method: 'POST',
                    body: JSON.stringify({
                        receiverId: peerId,
                        content: '📞 Missed call',
                        type: 'message',
                    }),
                });
                fetchContacts();
            } catch (e) {
                console.warn('[call] missed-call message failed', e);
            }
        },
        [fetchContacts]
    );

    const webRTC = useWebRTC({ socketRef, socket, onCallerTimeout: recordMissedCallAsCaller });

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    useEffect(() => {
        const peerId = webRTC.incomingFrom ?? webRTC.remoteUserId;
        if (!peerId || webRTC.callState === 'idle') {
            setCallerName('Unknown');
            return;
        }
        const id = Number(peerId);
        const cached = nameByPeerIdRef.current.get(id);
        if (cached) setCallerName(cached);

        const fromContacts = contacts.find((c) => samePeerId(c.user?.id, peerId))?.user?.name;
        if (fromContacts) {
            nameByPeerIdRef.current.set(id, fromContacts);
            setCallerName(fromContacts);
            return;
        }

        let cancelled = false;
        apiRequest(`/api/auth/user/${peerId}/name`)
            .then((res) => {
                const n = pickDisplayName(res);
                if (cancelled) return;
                if (n) {
                    nameByPeerIdRef.current.set(id, n);
                    setCallerName(n);
                } else {
                    setCallerName(nameByPeerIdRef.current.get(id) ?? 'Unknown');
                }
            })
            .catch(() => {
                if (cancelled) return;
                setCallerName(nameByPeerIdRef.current.get(id) ?? 'Unknown');
            });
        return () => {
            cancelled = true;
        };
    }, [webRTC.incomingFrom, webRTC.remoteUserId, webRTC.callState, contacts]);

    useEffect(() => {
        if (webRTC.callState !== 'incoming') {
            notifRef.current?.close();
            notifRef.current = null;
            return;
        }

        if (document.visibilityState === 'visible') return;
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
            return;
        }

        const type = webRTC.incomingCallType === 'audio' ? 'audio' : 'video';

        notifRef.current = new Notification(`Incoming ${type} call`, {
            body: `${callerName} is calling you`,
            icon: '/favicon.ico',
            tag: 'incoming-call',
            requireInteraction: true,
        });

        notifRef.current.onclick = () => {
            window.focus();
            notifRef.current?.close();
        };
    }, [webRTC.callState, webRTC.incomingFrom, webRTC.incomingCallType, callerName]);

    return (
        <CallContext.Provider value={{ ...webRTC, socketRef, socket, callerName }}>
            {children}
        </CallContext.Provider>
    );
}
