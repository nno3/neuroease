/**
 * Single WebRTC session for the app — must be used only inside CallProvider.
 *
 * Signalling: Socket.IO relays offer / answer / ICE (see backend server.js).
 * Remote audio: hidden HTMLMediaElement (reliable after async accept; AudioContext
 * often stays suspended so nothing was audible).
 */
import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';

const CALL_TIMEOUT_MS = 30_000;

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

const SOCKET_CONNECT_MS = 20_000;

function waitForSocket(sock, ms = SOCKET_CONNECT_MS) {
    if (!sock) return Promise.reject(new Error('No socket'));
    if (sock.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            sock.off('connect', onConnect);
            sock.off('connect_error', onErr);
            reject(new Error('Socket not connected — is the backend running?'));
        }, ms);
        const onConnect = () => {
            clearTimeout(timer);
            sock.off('connect_error', onErr);
            resolve();
        };
        const onErr = (err) => {
            clearTimeout(timer);
            sock.off('connect', onConnect);
            reject(err || new Error('Socket connection failed'));
        };
        sock.once('connect', onConnect);
        sock.once('connect_error', onErr);
    });
}

/** Plain SDP object — Socket.IO JSON round-trip can drop RTCSessionDescription prototypes. */
function sdpPayload(desc) {
    if (!desc || typeof desc !== 'object') return desc;
    return { type: desc.type, sdp: desc.sdp };
}

function iceCandidatePayload(c) {
    if (!c) return null;
    if (typeof c.toJSON === 'function') return c.toJSON();
    return {
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex,
        usernameFragment: c.usernameFragment,
    };
}

/** play() often rejects with AbortError when srcObject is replaced or pause() runs — expected, not a bug. */
function logPlayErrorUnlessAbort(err) {
    if (err?.name === 'AbortError') return;
    console.warn('[call] remote media play', err);
}

/**
 * iPhone / Android Chrome block camera+mic on http://192.168.x.x (not a secure context).
 * Localhost is exempt — LAN IP over plain HTTP usually fails getUserMedia or kills tracks immediately.
 */
function explainGetUserMediaError(err) {
    if (typeof window === 'undefined' || !err) return err;
    const { protocol, hostname } = window.location;
    const isLanHttp =
        protocol === 'http:' && hostname !== 'localhost' && hostname !== '127.0.0.1';
    if (!isLanHttp) return err;
    const msg = new Error(
        'Camera/microphone are blocked on plain HTTP at this address (mobile browsers require HTTPS for LAN IPs). On the dev machine run: npm run dev:https in caregiver-dashboard / patient-app, then open https://' +
            (typeof window !== 'undefined' ? window.location.host : hostname) +
            ' (accept the self-signed cert warning). Or use ngrok HTTPS. Original error: ' +
            err.name +
            ' — ' +
            (err.message || '')
    );
    msg.mediaHint = true;
    msg.cause = err;
    return msg;
}

export function useWebRTC({ socketRef, socket, onCallerTimeout }) {
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const pendingRemoteVideoRef = useRef(null);
    const pendingRemoteAudioRef = useRef(null);
    const remoteAudioWireCleanupRef = useRef(null);
    const remoteVideoWireCleanupRef = useRef(null);

    const timeoutRef = useRef(null);
    const timerRef = useRef(null);
    const localTrackEndedCleanupRef = useRef(null);

    const callStateRef = useRef('idle');
    const remotePeerIdRef = useRef(null);
    const incomingOfferRef = useRef(null);
    const incomingFromRef = useRef(null);
    const incomingCallTypeRef = useRef('video');

    const [callState, setCallState] = useState('idle');
    const [remoteUserId, setRemoteUserId] = useState(null);
    const [callType, setCallType] = useState('video');
    const [incomingOffer, setIncomingOffer] = useState(null);
    const [incomingCallType, setIncomingCallType] = useState('video');
    const [incomingFrom, setIncomingFrom] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    /** True when the browser blocked remote play(); show “Tap to hear” (mobile Safari / autoplay policy). */
    const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

    const setCallStateSynced = useCallback((s) => {
        callStateRef.current = s;
        setCallState(s);
    }, []);

    const setRemoteUserIdSynced = useCallback((id) => {
        remotePeerIdRef.current = id;
        setRemoteUserId(id);
    }, []);

    const clearCallTimeout = useCallback(() => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }, []);

    const stopTimer = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCallDuration(0);
    }, []);

    const startTimer = useCallback(() => {
        setCallDuration(0);
        timerRef.current = setInterval(() => {
            setCallDuration((n) => n + 1);
        }, 1000);
    }, []);

    const wireMediaElementPlayback = useCallback((el, stream) => {
        if (!el || !stream) return () => {};
        let cleaned = false;
        const trackCleanups = [];
        let pointerRetry = null;
        let keyRetry = null;

        const removeGestures = () => {
            if (pointerRetry) {
                window.removeEventListener('pointerdown', pointerRetry, true);
                pointerRetry = null;
            }
            if (keyRetry) {
                window.removeEventListener('keydown', keyRetry, true);
                keyRetry = null;
            }
        };

        const tryPlay = () => {
            if (cleaned) return;
            el.autoplay = true;
            if (el.tagName === 'VIDEO') {
                el.muted = stream.getAudioTracks().length === 0;
            } else {
                el.muted = false;
                el.volume = 1;
            }
            void el
                .play()
                .then(() => setNeedsAudioUnlock(false))
                .catch((err) => {
                    if (err?.name === 'AbortError') return;
                    if (err?.name === 'NotAllowedError' && !cleaned && !pointerRetry && !keyRetry) {
                        setNeedsAudioUnlock(true);
                        pointerRetry = () => {
                            void el.play().then(() => setNeedsAudioUnlock(false)).catch(() => {});
                            removeGestures();
                        };
                        keyRetry = () => {
                            void el.play().then(() => setNeedsAudioUnlock(false)).catch(() => {});
                            removeGestures();
                        };
                        window.addEventListener('pointerdown', pointerRetry, { capture: true });
                        window.addEventListener('keydown', keyRetry, { capture: true });
                        return;
                    }
                    logPlayErrorUnlessAbort(err);
                });
        };

        el.srcObject = stream;
        tryPlay();

        stream.getAudioTracks().forEach((track) => {
            const onUnmute = () => tryPlay();
            track.addEventListener('unmute', onUnmute);
            trackCleanups.push(() => track.removeEventListener('unmute', onUnmute));
        });

        return () => {
            cleaned = true;
            removeGestures();
            trackCleanups.forEach((fn) => fn());
        };
    }, []);

    const clearRemoteAudioEl = useCallback(() => {
        remoteAudioWireCleanupRef.current?.();
        remoteAudioWireCleanupRef.current = null;
        pendingRemoteAudioRef.current = null;
        const el = remoteAudioRef.current;
        if (el) {
            try {
                el.pause();
                el.srcObject = null;
            } catch (_) { /* ignore */ }
        }
    }, []);

    const stopLocalStream = useCallback(() => {
        localTrackEndedCleanupRef.current?.();
        localTrackEndedCleanupRef.current = null;
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
    }, []);

    const closePeer = useCallback(() => {
        pendingRemoteVideoRef.current = null;
        remoteVideoWireCleanupRef.current?.();
        remoteVideoWireCleanupRef.current = null;
        clearRemoteAudioEl();
        pcRef.current?.close();
        pcRef.current = null;
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    }, [clearRemoteAudioEl]);

    const reset = useCallback(() => {
        setNeedsAudioUnlock(false);
        clearCallTimeout();
        stopTimer();
        stopLocalStream();
        closePeer();
        setCallStateSynced('idle');
        remotePeerIdRef.current = null;
        incomingOfferRef.current = null;
        incomingFromRef.current = null;
        setRemoteUserId(null);
        setIncomingOffer(null);
        setIncomingFrom(null);
    }, [clearCallTimeout, stopTimer, stopLocalStream, closePeer, setCallStateSynced]);

    const attachLocalTrackEndedHandlers = useCallback(
        (stream) => {
            localTrackEndedCleanupRef.current?.();
            localTrackEndedCleanupRef.current = null;
            if (!stream) return;
            let handled = false;
            const onEnded = () => {
                if (callStateRef.current === 'idle' || handled) return;
                handled = true;
                console.warn(
                    '[call] Local mic/camera stopped — ending call. Phone on http://192.168.x often needs HTTPS (npm run dev:https). Otherwise: device unplugged, another app using the camera, or two browsers on one Mac fighting for the device.'
                );
                const peer = remotePeerIdRef.current || incomingFromRef.current;
                if (peer && socketRef.current?.connected) {
                    socketRef.current.emit('call:end', { to: peer });
                }
                reset();
            };
            const cleanups = [];
            stream.getTracks().forEach((track) => {
                const fn = () => onEnded();
                track.addEventListener('ended', fn);
                cleanups.push(() => track.removeEventListener('ended', fn));
            });
            localTrackEndedCleanupRef.current = () => cleanups.forEach((c) => c());
        },
        [reset]
    );

    const routeRemoteAudio = useCallback((stream) => {
        if (!stream) return;
        const el = remoteAudioRef.current;
        const attach = () => {
            const a = remoteAudioRef.current;
            if (!a) return;
            remoteAudioWireCleanupRef.current?.();
            remoteAudioWireCleanupRef.current = wireMediaElementPlayback(a, stream);
        };
        if (el) {
            attach();
        } else {
            pendingRemoteAudioRef.current = stream;
        }
    }, []);

    const attachRemoteVideo = useCallback(
        (stream, playAudioThroughVideo = false) => {
            const el = remoteVideoRef.current;
            if (!el) {
                pendingRemoteVideoRef.current = { stream, playAudioThroughVideo };
                return;
            }
            el.playsInline = true;
            el.srcObject = stream;
            remoteVideoWireCleanupRef.current?.();
            remoteVideoWireCleanupRef.current = null;
            const hasAud = stream.getAudioTracks().length > 0;
            if (playAudioThroughVideo && hasAud) {
                el.muted = false;
                remoteVideoWireCleanupRef.current = wireMediaElementPlayback(el, stream);
            } else {
                el.muted = true;
                void el.play().catch(() => {});
            }
        },
        [wireMediaElementPlayback]
    );

    const createPeer = useCallback(
        (mediaKind) => {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

            pc.onicecandidate = (ev) => {
                if (ev.candidate && remotePeerIdRef.current && socketRef.current?.connected) {
                    socketRef.current.emit('call:ice-candidate', {
                        to: remotePeerIdRef.current,
                        candidate: iceCandidatePayload(ev.candidate),
                    });
                }
            };

            pc.ontrack = (ev) => {
                let stream = ev.streams[0];
                if (!stream && ev.track) {
                    stream = new MediaStream([ev.track]);
                }
                if (!stream) return;
                const hasVideo = stream.getVideoTracks().length > 0;
                const hasAudio = stream.getAudioTracks().length > 0;
                const bundledVideoAudio =
                    mediaKind === 'video' && hasVideo && hasAudio;
                if (mediaKind === 'video' && hasVideo) {
                    attachRemoteVideo(stream, bundledVideoAudio);
                }
                if (hasAudio && !bundledVideoAudio) {
                    routeRemoteAudio(stream);
                }
            };

            pc.onconnectionstatechange = () => {
                const s = pc.connectionState;
                if (s === 'failed' || s === 'closed') {
                    reset();
                }
            };

            pcRef.current = pc;
            return pc;
        },
        [socketRef, reset, routeRemoteAudio, attachRemoteVideo]
    );

    const getMedia = useCallback(async (mediaKind) => {
        const constraints =
            mediaKind === 'audio'
                ? { audio: true, video: false }
                : { audio: true, video: { facingMode: 'user' } };
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            throw explainGetUserMediaError(e);
        }
        localStreamRef.current = stream;
        if (mediaKind === 'video' && localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
        }
        attachLocalTrackEndedHandlers(stream);
        return stream;
    }, [attachLocalTrackEndedHandlers]);

    const startCall = useCallback(
        async (toUserId, mediaKind = 'video') => {
            if (callStateRef.current !== 'idle') return;
            const peerId = Number(toUserId);
            if (!Number.isFinite(peerId)) {
                console.error('[call] invalid peer id', toUserId);
                return;
            }
            setRemoteUserIdSynced(peerId);
            setCallType(mediaKind);
            setCallStateSynced('calling');

            try {
                const sock = socketRef.current ?? socket;
                await waitForSocket(sock);

                const stream = await getMedia(mediaKind);
                const pc = createPeer(mediaKind);
                stream.getTracks().forEach((t) => pc.addTrack(t, stream));

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socketRef.current.emit('call:offer', {
                    to: peerId,
                    offer: sdpPayload(offer),
                    callType: mediaKind,
                });

                timeoutRef.current = setTimeout(() => {
                    socketRef.current?.emit('call:cancel', { to: peerId });
                    socketRef.current?.emit('call:missed', { to: peerId });
                    try {
                        onCallerTimeout?.(peerId);
                    } catch (e) {
                        console.warn('[call] onCallerTimeout', e);
                    }
                    stopLocalStream();
                    closePeer();
                    setCallStateSynced('no-answer');
                    setTimeout(reset, 3000);
                }, CALL_TIMEOUT_MS);
            } catch (e) {
                console.error('[call] startCall', e);
                if (import.meta.env.DEV && e?.mediaHint) {
                    window.alert(e.message);
                }
                reset();
            }
        },
        [
            getMedia,
            createPeer,
            socketRef,
            stopLocalStream,
            closePeer,
            setCallStateSynced,
            setRemoteUserIdSynced,
            reset,
            socket,
            onCallerTimeout,
        ]
    );

    const acceptCall = useCallback(async () => {
        if (callStateRef.current !== 'incoming') return;
        if (!incomingOfferRef.current || !incomingFromRef.current) return;

        const from = incomingFromRef.current;
        const mediaKind = incomingCallTypeRef.current;

        setRemoteUserIdSynced(from);
        setCallType(mediaKind);

        try {
            const sock = socketRef.current ?? socket;
            await waitForSocket(sock);

            const stream = await getMedia(mediaKind);
            const pc = createPeer(mediaKind);
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current.emit('call:answer', { to: from, answer: sdpPayload(answer) });

            setCallStateSynced('active');
            startTimer();
        } catch (e) {
            console.error('[call] acceptCall', e);
            if (import.meta.env.DEV && e?.mediaHint) {
                window.alert(e.message);
            }
            reset();
        }
    }, [
        getMedia,
        createPeer,
        socketRef,
        startTimer,
        setCallStateSynced,
        setRemoteUserIdSynced,
        reset,
        socket,
    ]);

    const rejectCall = useCallback(() => {
        if (incomingFromRef.current) {
            socketRef.current?.emit('call:reject', { to: incomingFromRef.current });
        }
        reset();
    }, [socketRef, reset]);

    const endCall = useCallback(() => {
        const target = remotePeerIdRef.current || incomingFromRef.current;
        if (target) socketRef.current?.emit('call:end', { to: target });
        reset();
    }, [socketRef, reset]);

    const cancelCall = useCallback(() => {
        if (remotePeerIdRef.current) {
            socketRef.current?.emit('call:cancel', { to: remotePeerIdRef.current });
        }
        reset();
    }, [socketRef, reset]);

    const toggleMute = useCallback(() => {
        localStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
    }, []);

    const toggleVideo = useCallback(() => {
        localStreamRef.current?.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onOffer = ({ from, offer, callType: ct }) => {
            const fromId = Number(from);
            if (!Number.isFinite(fromId) || !offer) return;
            if (callStateRef.current !== 'idle') {
                socket.emit('call:reject', { to: fromId, reason: 'busy' });
                return;
            }
            incomingFromRef.current = fromId;
            incomingOfferRef.current = offer;
            incomingCallTypeRef.current = ct === 'audio' ? 'audio' : 'video';
            setIncomingFrom(fromId);
            setIncomingOffer(offer);
            setIncomingCallType(incomingCallTypeRef.current);
            setCallStateSynced('incoming');
        };

        const onAnswer = async ({ answer }) => {
            const pc = pcRef.current;
            if (!pc || !answer) return;
            // Caller must be waiting for the answer; duplicate socket events are common (reconnect).
            if (pc.signalingState !== 'have-local-offer') {
                if (pc.signalingState === 'stable' && callStateRef.current === 'active') {
                    return;
                }
                return;
            }
            clearCallTimeout();
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                setCallStateSynced('active');
                startTimer();
            } catch (e) {
                console.error('[call] onAnswer', e);
                reset();
            }
        };

        const onIce = async ({ candidate }) => {
            try {
                if (pcRef.current && candidate) {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (e) {
                console.error('[call] onIce', e);
            }
        };

        const onEnd = () => {
            stopTimer();
            setCallStateSynced('ended');
            setTimeout(reset, 2000);
        };

        const onReject = ({ reason } = {}) => {
            clearCallTimeout();
            stopLocalStream();
            closePeer();
            setCallStateSynced(reason === 'busy' ? 'busy' : 'ended');
            setTimeout(reset, 3000);
        };

        const onCancel = () => reset();

        socket.on('call:offer', onOffer);
        socket.on('call:answer', onAnswer);
        socket.on('call:ice-candidate', onIce);
        socket.on('call:end', onEnd);
        socket.on('call:reject', onReject);
        socket.on('call:cancel', onCancel);

        return () => {
            socket.off('call:offer', onOffer);
            socket.off('call:answer', onAnswer);
            socket.off('call:ice-candidate', onIce);
            socket.off('call:end', onEnd);
            socket.off('call:reject', onReject);
            socket.off('call:cancel', onCancel);
        };
    }, [socket, setCallStateSynced, clearCallTimeout, startTimer, stopTimer, stopLocalStream, closePeer, reset]);

    useEffect(() => {
        const pending = pendingRemoteVideoRef.current;
        if (!pending || !remoteVideoRef.current) return;
        const { stream, playAudioThroughVideo } =
            pending && typeof pending === 'object' && 'stream' in pending
                ? pending
                : { stream: pending, playAudioThroughVideo: false };
        if (!stream) return;
        attachRemoteVideo(stream, playAudioThroughVideo);
        pendingRemoteVideoRef.current = null;
    }, [callState, callType, attachRemoteVideo]);

    useLayoutEffect(() => {
        const pending = pendingRemoteAudioRef.current;
        if (!pending || !remoteAudioRef.current) return;
        remoteAudioWireCleanupRef.current?.();
        remoteAudioWireCleanupRef.current = wireMediaElementPlayback(remoteAudioRef.current, pending);
        pendingRemoteAudioRef.current = null;
    }, [callState]);

    const unlockRemoteAudio = useCallback(() => {
        const nodes = [remoteAudioRef.current, remoteVideoRef.current];
        nodes.forEach((el) => {
            if (!el?.srcObject) return;
            void el.play().then(() => setNeedsAudioUnlock(false)).catch(() => {});
        });
    }, []);

    return {
        callState,
        callType,
        remoteUserId,
        incomingFrom,
        incomingCallType,
        callDuration,
        localVideoRef,
        remoteVideoRef,
        remoteAudioRef,
        needsAudioUnlock,
        unlockRemoteAudio,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        cancelCall,
        toggleMute,
        toggleVideo,
    };
}
