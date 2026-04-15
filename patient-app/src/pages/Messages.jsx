/**
 * Patient Messages page – real-time chat with caregiver(s) via socket.io.
 * Patients can send plain messages and meeting requests.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Calendar, Check, X, Clock, Phone, Video } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { apiRequest } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/useCall';
import './Messages.css';

function isMissedCallContent(content) {
    return typeof content === 'string' && (content.includes('Missed call') || content.includes('📞'));
}

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function MeetingBadge({ message, myId, onRespond, onCancel }) {
    const isReceiver = message.receiverId === myId;
    const isSender = message.senderId === myId;
    const statusColor = { pending: '#f59e0b', accepted: '#22c55e', declined: '#ef4444' };
    const statusLabel = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };

    return (
        <div className="pa-msg-meeting-card">
            <div className="pa-msg-meeting-header">
                <Calendar size={14} />
                <span>Meeting request</span>
                <span className="pa-msg-meeting-status" style={{ background: statusColor[message.meetingStatus] }}>
                    {statusLabel[message.meetingStatus]}
                </span>
            </div>
            <p className="pa-msg-meeting-content">{message.content}</p>
            {message.meetingTime && (
                <p className="pa-msg-meeting-time">
                    <Clock size={13} />
                    {new Date(message.meetingTime).toLocaleString([], {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                    })}
                </p>
            )}
            {isReceiver && message.meetingStatus === 'pending' && (
                <div className="pa-msg-meeting-actions">
                    <button className="pa-msg-meeting-btn pa-msg-meeting-btn--accept" onClick={() => onRespond(message.id, 'accepted')}>
                        <Check size={13} /> Accept
                    </button>
                    <button className="pa-msg-meeting-btn pa-msg-meeting-btn--decline" onClick={() => onRespond(message.id, 'declined')}>
                        <X size={13} /> Decline
                    </button>
                </div>
            )}
        </div>
    );
}

export default function Messages() {
    const { user } = useAuth();
    const myId = user?.id;

    const { socket, callState, startCall } = useCall();
    const [searchParams, setSearchParams] = useSearchParams();

    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [meetingTime, setMeetingTime] = useState(null);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [seenByContact, setSeenByContact] = useState(false);
    const bottomRef = useRef(null);

    const fetchContacts = useCallback(async () => {
        try {
            const res = await apiRequest('/api/messages/contacts');
            const list = res.data || [];
            setContacts(list);
            // Auto-open the first (and usually only) caregiver
            if (list.length > 0 && !activeContact) {
                setActiveContact(list[0]);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [activeContact]);

    useEffect(() => { fetchContacts(); }, []); // eslint-disable-line

    const loadConversation = useCallback(async (contact) => {
        setActiveContact(contact);
        setLoadingMessages(true);
        setSeenByContact(false);
        try {
            const res = await apiRequest(`/api/messages/conversation/${contact.user.id}`);
            const msgs = res.data || [];
            setMessages(msgs);
            const lastMine = [...msgs].reverse().find((m) => m.senderId === myId);
            if (lastMine?.isRead) setSeenByContact(true);
            setContacts((prev) =>
                prev.map((c) => c.user.id === contact.user.id ? { ...c, unreadCount: 0 } : c)
            );
        } catch {
            /* ignore */
        } finally {
            setLoadingMessages(false);
        }
    }, [myId]);

    useEffect(() => {
        const peerStr = searchParams.get('callPeer');
        if (!peerStr || contacts.length === 0) return;
        const peerId = Number(peerStr);
        if (!Number.isFinite(peerId)) return;
        const row = contacts.find((c) => Number(c.user?.id) === peerId);
        if (!row) return;
        loadConversation(row);
        const next = new URLSearchParams(searchParams);
        next.delete('callPeer');
        next.delete('callType');
        setSearchParams(next, { replace: true });
    }, [contacts, searchParams, setSearchParams, loadConversation]);

    // Initial load when fetchContacts auto-selects a contact (messages still empty)
    useEffect(() => {
        if (activeContact && messages.length === 0) {
            loadConversation(activeContact);
        }
    }, [activeContact, messages.length, loadConversation]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg) => {
            if (activeContact && (msg.senderId === activeContact.user.id || msg.receiverId === activeContact.user.id)) {
                setMessages((prev) => [...prev, msg]);
            }
            fetchContacts();
        };

        const handleMeetingResponse = ({ messageId, status }) => {
            setMessages((prev) =>
                prev.map((m) => m.id === messageId ? { ...m, meetingStatus: status } : m)
            );
        };

        const handleMessagesRead = ({ byUserId }) => {
            if (activeContact && byUserId === activeContact.user.id) {
                setSeenByContact(true);
            }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('meeting_response', handleMeetingResponse);
        socket.on('messages_read', handleMessagesRead);
        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('meeting_response', handleMeetingResponse);
            socket.off('messages_read', handleMessagesRead);
        };
    }, [socket, activeContact, fetchContacts]);

    const sendMessage = async (type = 'message') => {
        if (!input.trim() || !activeContact || sending) return;
        if (type === 'meeting_request' && !meetingTime) return;
        setSending(true);
        try {
            const res = await apiRequest('/api/messages', {
                method: 'POST',
                body: JSON.stringify({
                    receiverId: activeContact.user.id,
                    content: input.trim(),
                    type,
                    meetingTime: type === 'meeting_request' ? meetingTime.toISOString() : undefined,
                }),
            });
            setMessages((prev) => [...prev, res.data]);
            setSeenByContact(false);
            setInput('');
            setMeetingTime(null);
            setShowMeetingForm(false);
            fetchContacts();
        } catch {
            /* ignore */
        } finally {
            setSending(false);
        }
    };

    const respondToMeeting = async (messageId, status) => {
        try {
            const res = await apiRequest(`/api/messages/${messageId}/meeting`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
            setMessages((prev) => prev.map((m) => m.id === messageId ? res.data : m));
        } catch {
            /* ignore */
        }
    };

    const cancelMeeting = async (messageId) => {
        try {
            const res = await apiRequest(`/api/messages/${messageId}/meeting`, { method: 'DELETE' });
            setMessages((prev) => prev.map((m) => m.id === messageId ? res.data : m));
        } catch {
            /* ignore */
        }
    };

    if (loading) {
        return <div className="pa-msg-page"><p className="pa-msg-empty">Loading…</p></div>;
    }

    if (contacts.length === 0) {
        return (
            <div className="pa-msg-page">
                <p className="pa-msg-empty">No caregiver assigned yet. Contact your care team.</p>
            </div>
        );
    }

    return (
        <div className="pa-msg-page">
            {/* Contact tabs (patients usually only have one caregiver) */}
            {contacts.length > 1 && (
                <div className="pa-msg-tabs">
                    {contacts.map(({ user: contact, unreadCount }) => (
                        <button
                            key={contact.id}
                            className={`pa-msg-tab ${activeContact?.user.id === contact.id ? 'pa-msg-tab--active' : ''}`}
                            onClick={() => loadConversation({ user: contact })}
                        >
                            {contact.name}
                            {unreadCount > 0 && <span className="pa-msg-tab-badge">{unreadCount}</span>}
                        </button>
                    ))}
                </div>
            )}

            {activeContact && (
                <div className="pa-msg-conversation-header">
                    <div className="pa-msg-avatar">{activeContact.user.name?.[0]?.toUpperCase()}</div>
                    <div className="pa-msg-conversation-identity">
                        <p className="pa-msg-contact-name">{activeContact.user.name}</p>
                        <p className="pa-msg-contact-role">Caregiver</p>
                    </div>
                    <div className="pa-msg-call-btns">
                        <button
                            className="pa-msg-call-btn"
                            title="Audio call"
                            onClick={() => startCall(activeContact.user.id, 'audio')}
                            disabled={callState !== 'idle'}
                        >
                            <Phone size={18} />
                        </button>
                        <button
                            className="pa-msg-call-btn"
                            title="Video call"
                            onClick={() => startCall(activeContact.user.id, 'video')}
                            disabled={callState !== 'idle'}
                        >
                            <Video size={18} />
                        </button>
                    </div>
                </div>
            )}

            <div className="pa-msg-thread">
                {loadingMessages ? (
                    <p className="pa-msg-empty">Loading messages…</p>
                ) : messages.length === 0 ? (
                    <p className="pa-msg-empty">No messages yet. Send a message to your caregiver.</p>
                ) : (
                    (() => {
                        const lastMineIdx = messages.reduce((acc, m, i) => m.senderId === myId ? i : acc, -1);
                        return messages.map((msg, idx) => {
                            const isMine = msg.senderId === myId;
                            const isLastMine = idx === lastMineIdx;
                            return (
                                <div key={msg.id} className={`pa-msg-bubble-row ${isMine ? 'pa-msg-bubble-row--mine' : ''}`}>
                                    {msg.type === 'meeting_request' ? (
                                        <MeetingBadge message={msg} myId={myId} onRespond={respondToMeeting} onCancel={cancelMeeting} />
                                    ) : (
                                        <div className="pa-msg-bubble-wrap">
                                            <div className={`pa-msg-bubble ${isMine ? 'pa-msg-bubble--mine' : 'pa-msg-bubble--theirs'}`}>
                                                <p className="pa-msg-bubble-text">{msg.content}</p>
                                                <span className="pa-msg-bubble-time">{formatTime(msg.createdAt)}</span>
                                            </div>
                                            {isMissedCallContent(msg.content) && (
                                                <button
                                                    type="button"
                                                    className="pa-msg-redial"
                                                    disabled={callState !== 'idle'}
                                                    onClick={() =>
                                                        startCall(isMine ? msg.receiverId : msg.senderId, 'audio')
                                                    }
                                                >
                                                    Call back
                                                </button>
                                            )}
                                            {isMine && isLastMine && seenByContact && (
                                                <span className="pa-msg-seen-label">Seen</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()
                )}
                <div ref={bottomRef} />
            </div>

            <div className="pa-msg-composer">
                {showMeetingForm && (
                    <div className="pa-msg-meeting-form">
                        <label className="pa-msg-meeting-form-label">Proposed meeting time</label>
                        <DatePicker
                            selected={meetingTime}
                            onChange={(date) => setMeetingTime(date)}
                            showTimeSelect
                            timeIntervals={1}
                            timeCaption="Time"
                            dateFormat="dd/MM/yyyy h:mm aa"
                            placeholderText="DD/MM/YYYY hh:mm"
                            showMonthDropdown
                            showYearDropdown
                            scrollableYearDropdown
                            minDate={new Date()}
                            customInput={
                                <input className="pa-msg-meeting-form-input" readOnly />
                            }
                        />
                    </div>
                )}
                <div className="pa-msg-composer-row">
                    <button
                        type="button"
                        className={`pa-msg-meeting-toggle ${showMeetingForm ? 'pa-msg-meeting-toggle--active' : ''}`}
                        onClick={() => setShowMeetingForm((v) => !v)}
                        title="Request a meeting"
                        aria-label="Toggle meeting request"
                    >
                        <Calendar size={18} />
                    </button>
                    <div className="pa-msg-input-wrap">
                        <input
                            className="pa-msg-input"
                            type="text"
                            placeholder={showMeetingForm ? 'Add a note for the meeting…' : 'Message your caregiver…'}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(showMeetingForm ? 'meeting_request' : 'message')}
                            maxLength={1000}
                        />
                        {input.length > 800 && (
                            <span className={`pa-msg-char-count ${input.length >= 1000 ? 'pa-msg-char-count--limit' : ''}`}>
                                {input.length}/1000
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="pa-msg-send-btn"
                        onClick={() => sendMessage(showMeetingForm ? 'meeting_request' : 'message')}
                        disabled={sending || !input.trim() || (showMeetingForm && !meetingTime)}
                        aria-label="Send"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
