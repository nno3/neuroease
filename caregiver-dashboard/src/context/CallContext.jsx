/**
 * CallProvider – single shared WebRTC call session for the caregiver dashboard.
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

/** API returns { data: { name } } or variants — normalize */
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
            const res = await apiRequest('/messages/contacts');
            setContacts(res.data || []);
        } catch { /* ignore */ }
    }, []);

    const recordMissedCallAsCaller = useCallback(
        async (peerId) => {
            try {
                await apiRequest('/messages', {
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
        if (webRTC.callState === 'idle') {
            setCallerName('Unknown');
            return;
        }
        const peerId = webRTC.incomingFrom ?? webRTC.remoteUserId;
        // Don't reset to Unknown when peer ids lag React for a frame (hang-up / teardown).
        if (!peerId) return;
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
        apiRequest(`/auth/user/${peerId}/name`)
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

        const peerId = webRTC.incomingFrom;
        if (peerId == null) return;

        const type = webRTC.incomingCallType === 'audio' ? 'audio' : 'video';
        let cancelled = false;

        const show = (name) => {
            if (cancelled) return;
            const label = (name && String(name).trim()) || 'Someone';
            notifRef.current?.close();
            notifRef.current = new Notification(`Incoming ${type} call`, {
                body: `${label} is calling you`,
                icon: '/favicon.ico',
                tag: 'incoming-call',
                requireInteraction: true,
            });
            notifRef.current.onclick = () => {
                window.focus();
                notifRef.current?.close();
            };
        };

        const id = Number(peerId);
        const fromContacts = contacts.find((c) => samePeerId(c.user?.id, peerId))?.user?.name;
        if (fromContacts && String(fromContacts).trim()) {
            show(fromContacts);
            return () => {
                cancelled = true;
            };
        }

        const cached = nameByPeerIdRef.current.get(id);
        if (cached && String(cached).trim()) {
            show(cached);
            return () => {
                cancelled = true;
            };
        }

        if (callerName !== 'Unknown' && String(callerName).trim()) {
            show(callerName);
            return () => {
                cancelled = true;
            };
        }

        apiRequest(`/auth/user/${peerId}/name`)
            .then((res) => {
                if (cancelled) return;
                show(pickDisplayName(res));
            })
            .catch(() => {
                if (cancelled) return;
                show(null);
            });

        return () => {
            cancelled = true;
        };
    }, [webRTC.callState, webRTC.incomingFrom, webRTC.incomingCallType, callerName, contacts]);

    return (
        <CallContext.Provider value={{ ...webRTC, socketRef, socket, callerName }}>
            {children}
        </CallContext.Provider>
    );
}
