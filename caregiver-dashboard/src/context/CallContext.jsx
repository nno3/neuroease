/**
 * CallProvider – single shared WebRTC call session for the caregiver dashboard.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import { apiRequest } from '../services/apiClient';
import { CallContext } from './callStateContext';

export function CallProvider({ children }) {
    const { socketRef, socket } = useSocket();
    const notifRef = useRef(null);
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
        const peerId = webRTC.incomingFrom ?? webRTC.remoteUserId;
        if (!peerId || webRTC.callState === 'idle') {
            setCallerName('Unknown');
            return;
        }
        const fromContacts = contacts.find((c) => c.user?.id === peerId)?.user?.name;
        if (fromContacts) { setCallerName(fromContacts); return; }
        apiRequest(`/auth/user/${peerId}/name`)
            .then((res) => setCallerName(res.data?.name || 'Unknown'))
            .catch(() => setCallerName('Unknown'));
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
