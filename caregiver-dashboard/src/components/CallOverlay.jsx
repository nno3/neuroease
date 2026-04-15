/**
 * CallOverlay – full-screen overlay rendered during any call state.
 *
 * Remote audio plays through a hidden <audio> (see useWebRTC). Remote <video> is muted.
 */
import React, { useState, useEffect } from 'react';
import {
    Phone, PhoneOff, PhoneIncoming, Video, VideoOff,
    Mic, MicOff, PhoneMissed, Volume2,
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
    needsAudioUnlock,
    onUnlockAudio,
    onAccept,
    onReject,
    onEnd,
    onCancel,
    onToggleMute,
    onToggleVideo,
    speakerOutputOn = false,
    onToggleSpeakerOutput,
    speakerOutputAvailable = false,
}) {
    const [muted, setMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    /** Stop Web Audio ring before getUserMedia — iOS often breaks mic/remote play if oscillator is still running. */
    const [suppressRingtone, setSuppressRingtone] = useState(false);

    useEffect(() => {
        if (callState === 'active') {
            setMuted(false);
            setVideoOff(false);
        }
    }, [callState]);

    useEffect(() => {
        if (callState === 'idle') setSuppressRingtone(false);
    }, [callState]);

    // Ringtone: synthesise two-tone ring on incoming
    useEffect(() => {
        if (callState !== 'incoming' || suppressRingtone) return;
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
    }, [callState, suppressRingtone]);

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

    const showAvatarRing =
        callState === 'calling' ||
        callState === 'incoming' ||
        (callState === 'active' && !isVideoCall);

    const showGradientBackdrop = !(callState === 'active' && isVideoCall);

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
            {showGradientBackdrop && <div className="call-overlay__backdrop" aria-hidden />}

            {callState === 'active' && isVideoCall && (
                <video
                    ref={remoteVideoRef}
                    className="call-remote-video"
                    autoPlay
                    playsInline
                />
            )}

            <div
                className={`call-ui${callState === 'active' && isVideoCall ? ' call-ui--video-active' : ''}`}
            >
                {callState === 'active' && needsAudioUnlock && (
                    <div className="call-audio-unlock-wrap">
                        <button type="button" className="call-audio-unlock" onClick={onUnlockAudio}>
                            Tap to hear the other person
                        </button>
                        <p className="call-audio-unlock-hint">
                            Safari and some browsers block sound until you tap. This does not mean the call failed.
                        </p>
                    </div>
                )}
                <header className="call-ui__header">
                    <div className="call-info">
                        <p className="call-contact-name">{contactName || 'Unknown'}</p>
                        <p className={`call-status-label ${callState === 'active' ? 'call-status-label--timer' : ''}`}>
                            {statusLabel}
                        </p>
                    </div>
                </header>

                {showAvatarRing && (
                    <div className="call-stage">
                        <div
                            className={`call-avatar-ring ${callState === 'incoming' ? 'call-avatar-ring--pulse' : ''}`}
                        >
                            <span className="call-avatar-initials">
                                {contactName ? contactName[0].toUpperCase() : '?'}
                            </span>
                        </div>
                    </div>
                )}

                {callState === 'active' && isVideoCall && (
                    <div className="call-stage call-stage--filler" aria-hidden />
                )}

                {isVideoCall &&
                    (callState === 'calling' || callState === 'incoming' || callState === 'active') && (
                        <video
                            ref={localVideoRef}
                            className="call-local-pip"
                            autoPlay
                            playsInline
                            muted
                        />
                    )}

                <div className="call-controls">
                    {callState === 'calling' && (
                        <button className="call-btn call-btn-end" onClick={onCancel} title="Cancel">
                            <PhoneOff size={24} />
                        </button>
                    )}

                    {callState === 'incoming' && (
                        <>
                            <button
                                type="button"
                                className="call-btn call-btn-accept"
                                onClick={() => {
                                    setSuppressRingtone(true);
                                    onAccept();
                                }}
                                title="Accept"
                            >
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
                            {speakerOutputAvailable && typeof onToggleSpeakerOutput === 'function' && (
                                <button
                                    type="button"
                                    className={`call-btn call-btn-toggle ${speakerOutputOn ? 'call-btn-active' : ''}`}
                                    onClick={onToggleSpeakerOutput}
                                    title={
                                        speakerOutputOn
                                            ? 'Use phone earpiece / default output'
                                            : 'Use loudspeaker (where supported)'
                                    }
                                >
                                    <Volume2 size={22} />
                                </button>
                            )}
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
