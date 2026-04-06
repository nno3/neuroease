/**
 * Caregiver Messages page – real-time chat with assigned patients via socket.io.
 * Left panel: contact list with unread badges and last message preview.
 * Right panel: conversation thread with plain messages and meeting requests.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSquare, Send, Calendar, Check, X, Clock, ChevronLeft, Phone, Video } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { apiRequest } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/useCall';
import './Messages.css';

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
        <div className="msg-meeting-card">
            <div className="msg-meeting-header">
                <Calendar size={15} />
                <span>Meeting request</span>
                <span
                    className="msg-meeting-status"
                    style={{ background: statusColor[message.meetingStatus] }}
                >
                    {statusLabel[message.meetingStatus]}
                </span>
            </div>
            <p className="msg-meeting-content">{message.content}</p>
            {message.meetingTime && (
                <p className="msg-meeting-time">
                    <Clock size={13} />
                    {new Date(message.meetingTime).toLocaleString([], {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                    })}
                </p>
            )}
            {isReceiver && message.meetingStatus === 'pending' && (
                <div className="msg-meeting-actions">
                    <button className="msg-meeting-btn msg-meeting-btn--accept" onClick={() => onRespond(message.id, 'accepted')}>
                        <Check size={14} /> Accept
                    </button>
                    <button className="msg-meeting-btn msg-meeting-btn--decline" onClick={() => onRespond(message.id, 'declined')}>
                        <X size={14} /> Decline
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

    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [meetingTime, setMeetingTime] = useState(null);
    const [sending, setSending] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [mobileShowConversation, setMobileShowConversation] = useState(false);
    const [seenByContact, setSeenByContact] = useState(false);
    const bottomRef = useRef(null);

    const fetchContacts = useCallback(async () => {
        try {
            const res = await apiRequest('/messages/contacts');
            setContacts(res.data || []);
        } catch {
            /* ignore */
        } finally {
            setLoadingContacts(false);
        }
    }, []);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    const openConversation = useCallback(async (contact) => {
        setActiveContact(contact);
        setMobileShowConversation(true);
        setLoadingMessages(true);
        setSeenByContact(false);
        try {
            const res = await apiRequest(`/messages/conversation/${contact.user.id}`);
            const msgs = res.data || [];
            setMessages(msgs);
            // If the last message I sent is already read, show Seen immediately
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

    // Scroll to bottom when messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Listen for incoming messages via socket
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
            const res = await apiRequest('/messages', {
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
            const res = await apiRequest(`/messages/${messageId}/meeting`, {
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
            const res = await apiRequest(`/messages/${messageId}/meeting`, { method: 'DELETE' });
            setMessages((prev) => prev.map((m) => m.id === messageId ? res.data : m));
        } catch {
            /* ignore */
        }
    };

    return (
        <div className="msg-page">
            <div className={`msg-contacts ${mobileShowConversation ? 'msg-contacts--hidden-mobile' : ''}`}>
                <div className="msg-contacts-header">
                    <MessageSquare size={18} />
                    <h2 className="msg-contacts-title">Messages</h2>
                </div>
                {loadingContacts ? (
                    <p className="msg-empty">Loading…</p>
                ) : contacts.length === 0 ? (
                    <p className="msg-empty">No patients assigned yet.</p>
                ) : (
                    <ul className="msg-contact-list">
                        {contacts.map(({ user: contact, lastMessage, unreadCount }) => (
                            <li key={contact.id}>
                                <button
                                    className={`msg-contact-item ${activeContact?.user.id === contact.id ? 'msg-contact-item--active' : ''}`}
                                    onClick={() => openConversation({ user: contact, lastMessage, unreadCount })}
                                >
                                    <div className="msg-contact-avatar">
                                        {contact.name?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <div className="msg-contact-info">
                                        <div className="msg-contact-name-row">
                                            <span className="msg-contact-name">{contact.name}</span>
                                            <span className="msg-contact-time">{formatTime(lastMessage?.createdAt)}</span>
                                        </div>
                                        <div className="msg-contact-preview-row">
                                            <span className="msg-contact-preview">
                                                {lastMessage
                                                    ? lastMessage.type === 'meeting_request'
                                                        ? '📅 Meeting request'
                                                        : lastMessage.content?.slice(0, 40)
                                                    : 'No messages yet'}
                                            </span>
                                            {unreadCount > 0 && (
                                                <span className="msg-unread-badge">{unreadCount}</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className={`msg-conversation ${!mobileShowConversation ? 'msg-conversation--hidden-mobile' : ''}`}>
                {!activeContact ? (
                    <div className="msg-no-conversation">
                        <MessageSquare size={40} className="msg-no-conversation-icon" />
                        <p>Select a patient to start messaging</p>
                    </div>
                ) : (
                    <>
                        <div className="msg-conversation-header">
                            <button
                                className="msg-back-btn"
                                onClick={() => setMobileShowConversation(false)}
                                aria-label="Back to contacts"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="msg-conversation-avatar">
                                {activeContact.user.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="msg-conversation-identity">
                                <p className="msg-conversation-name">{activeContact.user.name}</p>
                                <p className="msg-conversation-role">Patient</p>
                            </div>
                            <div className="msg-call-btns">
                                <button
                                    className="msg-call-btn"
                                    title="Audio call"
                                    onClick={() => startCall(activeContact.user.id, 'audio')}
                                    disabled={callState !== 'idle'}
                                >
                                    <Phone size={18} />
                                </button>
                                <button
                                    className="msg-call-btn"
                                    title="Video call"
                                    onClick={() => startCall(activeContact.user.id, 'video')}
                                    disabled={callState !== 'idle'}
                                >
                                    <Video size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="msg-thread">
                            {loadingMessages ? (
                                <p className="msg-empty">Loading messages…</p>
                            ) : messages.length === 0 ? (
                                <p className="msg-empty">No messages yet. Say hello!</p>
                            ) : (() => {
                                const lastMineIdx = messages.reduce((acc, m, i) => m.senderId === myId ? i : acc, -1);
                                return messages.map((msg, idx) => {
                                    const isMine = msg.senderId === myId;
                                    const isLastMine = idx === lastMineIdx;
                                    return (
                                        <div key={msg.id} className={`msg-bubble-row ${isMine ? 'msg-bubble-row--mine' : ''}`}>
                                            {msg.type === 'meeting_request' ? (
                                                <MeetingBadge message={msg} myId={myId} onRespond={respondToMeeting} onCancel={cancelMeeting} />
                                            ) : (
                                                <div className="msg-bubble-wrap">
                                                    <div className={`msg-bubble ${isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs'}`}>
                                                        <p className="msg-bubble-text">{msg.content}</p>
                                                        <span className="msg-bubble-time">{formatTime(msg.createdAt)}</span>
                                                    </div>
                                                    {isMine && isLastMine && seenByContact && (
                                                        <span className="msg-seen-label">Seen</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                            <div ref={bottomRef} />
                        </div>

                        <div className="msg-composer">
                            {showMeetingForm && (
                                <div className="msg-meeting-form">
                                    <label className="msg-meeting-form-label">Proposed meeting time</label>
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
                                            <input className="msg-meeting-form-input" readOnly />
                                        }
                                    />
                                </div>
                            )}
                            <div className="msg-composer-row">
                                <button
                                    type="button"
                                    className={`msg-meeting-toggle ${showMeetingForm ? 'msg-meeting-toggle--active' : ''}`}
                                    onClick={() => setShowMeetingForm((v) => !v)}
                                    title="Schedule a meeting"
                                    aria-label="Toggle meeting request"
                                >
                                    <Calendar size={18} />
                                </button>
                                <div className="msg-input-wrap">
                                    <input
                                        className="msg-input"
                                        type="text"
                                        placeholder={showMeetingForm ? 'Add a note for the meeting…' : 'Type a message…'}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(showMeetingForm ? 'meeting_request' : 'message')}
                                        maxLength={1000}
                                    />
                                    {input.length > 800 && (
                                        <span className={`msg-char-count ${input.length >= 1000 ? 'msg-char-count--limit' : ''}`}>
                                            {input.length}/1000
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="msg-send-btn"
                                    onClick={() => sendMessage(showMeetingForm ? 'meeting_request' : 'message')}
                                    disabled={sending || !input.trim() || (showMeetingForm && !meetingTime)}
                                    aria-label="Send"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
