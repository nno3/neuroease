/**
 * CallOverlay – full-screen overlay rendered during any call state.
 *
 * Remote audio plays through a hidden <audio> (see useWebRTC). Remote <video> is muted.
 */
import React, { useState, useEffect } from 'react';
import {
    Phone, PhoneOff, PhoneIncoming, Video, VideoOff,
    Mic, MicOff, PhoneMissed,
} from 'lucide-react';
import './CallOverlay.css';

function formatDuration(secs) {
    const total = Math.floor(Number(secs) || 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function CallOverlay({
    callState,
    callType,
    incomingCallType,
    contactName,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    onAccept,
    onReject,
    onEnd,
    onCancel,
    onToggleMute,
    onToggleVideo,
}) {
    const [muted, setMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);

    useEffect(() => {
        if (callState === 'active') {
            setMuted(false);
            setVideoOff(false);
        }
    }, [callState]);

    // Ringtone: synthesise two-tone ring on incoming
    useEffect(() => {
        if (callState !== 'incoming') return;
        let ctx;
        let stopped = false;
        let timeouts = [];

        const ring = () => {
            if (stopped) return;
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = (freq, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + duration);
            };
            playTone(880, 0, 0.35);
            playTone(660, 0.4, 0.35);
            const t = setTimeout(() => { ctx?.close(); ring(); }, 2000);
            timeouts.push(t);
        };

        ring();

        return () => {
            stopped = true;
            timeouts.forEach(clearTimeout);
            ctx?.close();
        };
    }, [callState]);

    if (callState === 'idle') return null;

    const handleMute = () => { setMuted((m) => !m); onToggleMute(); };
    const handleVideo = () => { setVideoOff((v) => !v); onToggleVideo(); };

    const isVideoCall =
        (callState === 'calling' && callType === 'video') ||
        (callState === 'incoming' && incomingCallType === 'video') ||
        (callState === 'active' && callType === 'video');

    const statusLabel = {
        calling: 'Calling…',
        incoming: `Incoming ${incomingCallType} call`,
        active: formatDuration(callDuration ?? 0),
        ended: 'Call ended',
        'no-answer': 'No answer',
        busy: 'User is busy',
    }[callState] ?? '';

    const isTerminal = ['ended', 'no-answer', 'busy'].includes(callState);

    return (
        <div className="call-overlay">
            {callState !== 'idle' && (
                <audio
                    ref={remoteAudioRef}
                    className="call-remote-audio"
                    autoPlay
                    playsInline
                    aria-hidden
                />
            )}
            {/* Remote video — muted; audio comes from call-remote-audio */}
            {callState === 'active' && isVideoCall && (
                <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline muted />
            )}

            {/* Avatar circle for audio calls or pre-connect states */}
            {callState === 'active' && !isVideoCall && (
                <div className="call-audio-bg">
                    <div className="call-avatar-ring">
                        <span className="call-avatar-initials">
                            {contactName ? contactName[0].toUpperCase() : '?'}
                        </span>
                    </div>
                </div>
            )}
            {(callState === 'calling' || callState === 'incoming') && (
                <div className="call-audio-bg">
                    <div className={`call-avatar-ring ${callState === 'incoming' ? 'call-avatar-ring--pulse' : ''}`}>
                        <span className="call-avatar-initials">
                            {contactName ? contactName[0].toUpperCase() : '?'}
                        </span>
                    </div>
                </div>
            )}

            <div className="call-ui">
                <div className="call-info">
                    <p className="call-contact-name">{contactName || 'Unknown'}</p>
                    <p className={`call-status-label ${callState === 'active' ? 'call-status-label--timer' : ''}`}>
                        {statusLabel}
                    </p>
                </div>

                {callState === 'active' && isVideoCall && (
                    <video ref={localVideoRef} className="call-local-pip" autoPlay playsInline muted />
                )}

                <div className="call-controls">
                    {callState === 'calling' && (
                        <button className="call-btn call-btn-end" onClick={onCancel} title="Cancel">
                            <PhoneOff size={24} />
                        </button>
                    )}

                    {callState === 'incoming' && (
                        <>
                            <button className="call-btn call-btn-accept" onClick={onAccept} title="Accept">
                                <PhoneIncoming size={24} />
                            </button>
                            <button className="call-btn call-btn-end" onClick={onReject} title="Decline">
                                <PhoneMissed size={24} />
                            </button>
                        </>
                    )}

                    {callState === 'active' && (
                        <>
                            <button
                                className={`call-btn call-btn-toggle ${muted ? 'call-btn-active' : ''}`}
                                onClick={handleMute}
                                title={muted ? 'Unmute' : 'Mute'}
                            >
                                {muted ? <MicOff size={22} /> : <Mic size={22} />}
                            </button>
                            {callType === 'video' && (
                                <button
                                    className={`call-btn call-btn-toggle ${videoOff ? 'call-btn-active' : ''}`}
                                    onClick={handleVideo}
                                    title={videoOff ? 'Turn on camera' : 'Turn off camera'}
                                >
                                    {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
                                </button>
                            )}
                            <button className="call-btn call-btn-end" onClick={onEnd} title="End call">
                                <PhoneOff size={24} />
                            </button>
                        </>
                    )}

                    {isTerminal && (
                        <button className="call-btn call-btn-dismiss" onClick={onEnd} title="Dismiss">
                            <Phone size={24} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
