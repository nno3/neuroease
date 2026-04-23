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

/**
 * Production: set `VITE_ICE_SERVERS` to a JSON array of RTCIceServer objects from your TURN provider
 * (e.g. Metered free tier) — much more reliable than public relays alone. Build-time env in Vite.
 */
function getIceServers() {
    const raw = import.meta.env.VITE_ICE_SERVERS;
    if (typeof raw === 'string' && raw.trim().length > 0) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const probe = JSON.stringify(parsed);
                if (probe.includes('YOUR_USER') || probe.includes('YOUR_PASS')) {
                    console.warn(
                        '[call] VITE_ICE_SERVERS still has placeholders — use real Metered username/credential or cross-network calls will fail'
                    );
                }
                return parsed;
            }
        } catch (_) {
            console.warn(
                '[call] VITE_ICE_SERVERS is not valid JSON (on Render avoid wrapping in single quotes) — using default ICE; different networks may fail'
            );
        }
    }
    return ICE_SERVERS;
}

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

const SDP_TYPES = new Set(['offer', 'answer', 'pranswer', 'rollback']);

/**
 * Socket/reconnect edge cases sometimes deliver { sdp, type: null }. RTCPeerConnection rejects that.
 * When we know the role (incoming leg is always an offer; answer leg is always an answer), fill in type.
 */
function normalizeSessionDescription(raw, expectedRole) {
    if (!raw || typeof raw !== 'object') return null;
    let type = raw.type;
    const sdp = raw.sdp != null ? String(raw.sdp) : '';
    if (!sdp.trim()) return null;
    if (typeof type === 'number') {
        type = { 1: 'offer', 2: 'answer', 3: 'pranswer', 4: 'rollback' }[type] ?? null;
    } else if (type != null && type !== '') {
        type = String(type);
    } else {
        type = null;
    }
    if (!type || !SDP_TYPES.has(type)) {
        if (expectedRole && SDP_TYPES.has(expectedRole)) type = expectedRole;
        else return null;
    }
    return { type, sdp };
}

/**
 * Plain SDP for Socket.IO — always include a valid `type` (some clients send type: null after reconnect).
 * Pass 'offer' or 'answer' so the field is never omitted on the wire.
 */
function sdpPayload(desc, expectedRole) {
    if (!desc || typeof desc !== 'object') return desc;
    const n = normalizeSessionDescription(
        { type: desc.type, sdp: desc.sdp },
        expectedRole
    );
    if (n) return n;
    if (expectedRole && SDP_TYPES.has(expectedRole)) {
        return { type: expectedRole, sdp: String(desc.sdp ?? '') };
    }
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

function mediaElementSupportsSetSinkId(el) {
    return el && typeof el.setSinkId === 'function';
}

/** Best-effort: route remote playout to loudspeaker on Android/desktop Chrome. Often unsupported on iOS Safari. */
async function pickSpeakerOutputDeviceId() {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outs = devices.filter((d) => d.kind === 'audiooutput');
    if (outs.length === 0) return null;
    const byLabel = (re) => outs.find((d) => re.test(String(d.label || '')));
    const named = byLabel(/speakerphone|loudspeaker|built[- ]?in speaker|\bspeaker\b/i);
    if (named?.deviceId) return named.deviceId;
    const notHeadphones = outs.filter(
        (d) => !/headphone|headset|airpods|earbud|bluetooth|usb audio/i.test(String(d.label || ''))
    );
    const pool = notHeadphones.length ? notHeadphones : outs;
    if (pool.length >= 2) {
        const nonDefault = pool.filter((d) => d.deviceId && d.deviceId !== 'default');
        if (nonDefault.length) return nonDefault[nonDefault.length - 1].deviceId;
    }
    return pool[pool.length - 1]?.deviceId || null;
}

async function applyRemoteAudioOutput(el, useSpeaker) {
    if (!mediaElementSupportsSetSinkId(el)) return;
    const hasAudio =
        el.tagName === 'AUDIO' ||
        (el.srcObject &&
            typeof el.srcObject.getAudioTracks === 'function' &&
            el.srcObject.getAudioTracks().length > 0);
    if (!hasAudio) return;
    try {
        if (useSpeaker) {
            const id = await pickSpeakerOutputDeviceId();
            if (id) await el.setSinkId(id);
        } else {
            await el.setSinkId('');
        }
    } catch (err) {
        if (import.meta.env.DEV) console.warn('[call] setSinkId', err);
    }
}

export function remoteSpeakerOutputAvailable() {
    if (typeof document === 'undefined') return false;
    return typeof HTMLAudioElement !== 'undefined' && 'setSinkId' in HTMLAudioElement.prototype;
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
    /** Ignore connectionState 'closed' right after we call pc.close() (otherwise reset runs twice / random hangups). */
    const intentionalPeerCloseRef = useRef(false);
    const connectionFailedTimerRef = useRef(null);
    const localTrackEndedDebounceRef = useRef(null);
    /** Trickle ICE can arrive before RTCPeerConnection exists or before setRemoteDescription — buffer then flush. */
    const pendingIceCandidatesRef = useRef([]);
    /** Route remote audio to speaker output when true (see `setSinkId` / `remoteSpeakerOutputAvailable`). */
    const speakerOutputOnRef = useRef(false);

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
    const callTypeRef = useRef('video');
    useEffect(() => {
        callTypeRef.current = callType;
    }, [callType]);
    /** User-facing (front) vs environment (back) — updated by switchCamera and reset. */
    const facingUserRef = useRef(true);
    const [incomingCallType, setIncomingCallType] = useState('video');
    const [incomingFrom, setIncomingFrom] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    /** True when the browser blocked remote play(); show “Tap to hear” (mobile Safari / autoplay policy). */
    const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
    /** Shown in Layout after failed calls / disconnect (cleared on dismiss or new call). */
    const [callBanner, setCallBanner] = useState(null);
    const setCallBannerRef = useRef(setCallBanner);
    const [speakerOutputOn, setSpeakerOutputOn] = useState(false);

    useEffect(() => {
        setCallBannerRef.current = setCallBanner;
    }, [setCallBanner]);

    useEffect(() => {
        speakerOutputOnRef.current = speakerOutputOn;
    }, [speakerOutputOn]);

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
                .then(() => {
                    setNeedsAudioUnlock(false);
                    return applyRemoteAudioOutput(el, speakerOutputOnRef.current);
                })
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

        const attachAudioTrackListeners = () => {
            stream.getAudioTracks().forEach((track) => {
                const onUnmute = () => tryPlay();
                track.addEventListener('unmute', onUnmute);
                trackCleanups.push(() => track.removeEventListener('unmute', onUnmute));
            });
        };
        attachAudioTrackListeners();

        const onStreamAddTrack = (ev) => {
            const t = ev.track;
            if (t && t.kind === 'audio') {
                const onUnmute = () => tryPlay();
                t.addEventListener('unmute', onUnmute);
                trackCleanups.push(() => t.removeEventListener('unmute', onUnmute));
            }
            tryPlay();
        };
        stream.addEventListener('addtrack', onStreamAddTrack);

        return () => {
            cleaned = true;
            stream.removeEventListener('addtrack', onStreamAddTrack);
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
        if (connectionFailedTimerRef.current) {
            clearTimeout(connectionFailedTimerRef.current);
            connectionFailedTimerRef.current = null;
        }
        pendingIceCandidatesRef.current = [];
        const pc = pcRef.current;
        if (pc) {
            intentionalPeerCloseRef.current = true;
            pc.close();
        }
        pcRef.current = null;
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    }, [clearRemoteAudioEl]);

    const clearCallBanner = useCallback(() => setCallBanner(null), []);

    const reset = useCallback(() => {
        setNeedsAudioUnlock(false);
        speakerOutputOnRef.current = false;
        setSpeakerOutputOn(false);
        clearCallTimeout();
        if (connectionFailedTimerRef.current) {
            clearTimeout(connectionFailedTimerRef.current);
            connectionFailedTimerRef.current = null;
        }
        if (localTrackEndedDebounceRef.current) {
            clearTimeout(localTrackEndedDebounceRef.current);
            localTrackEndedDebounceRef.current = null;
        }
        stopTimer();
        stopLocalStream();
        closePeer();
        setCallStateSynced('idle');
        remotePeerIdRef.current = null;
        incomingOfferRef.current = null;
        incomingFromRef.current = null;
        setRemoteUserId(null);
        setIncomingFrom(null);
        setCallType('video');
        callTypeRef.current = 'video';
        facingUserRef.current = true;
    }, [clearCallTimeout, stopTimer, stopLocalStream, closePeer, setCallStateSynced]);

    const flushPendingIce = useCallback(async (pc) => {
        if (!pc?.remoteDescription) return;
        const queued = pendingIceCandidatesRef.current;
        pendingIceCandidatesRef.current = [];
        for (const init of queued) {
            try {
                await pc.addIceCandidate(init ? new RTCIceCandidate(init) : null);
            } catch (e) {
                console.warn('[call] flush pending ICE', e);
            }
        }
    }, []);

    const attachLocalTrackEndedHandlers = useCallback(
        (stream) => {
            localTrackEndedCleanupRef.current?.();
            localTrackEndedCleanupRef.current = null;
            if (!stream) return;
            let handled = false;
            const onEnded = () => {
                if (callStateRef.current === 'idle' || handled) return;
                clearTimeout(localTrackEndedDebounceRef.current);
                localTrackEndedDebounceRef.current = setTimeout(() => {
                    localTrackEndedDebounceRef.current = null;
                    if (callStateRef.current === 'idle' || handled) return;
                    const st = localStreamRef.current;
                    if (!st) return;
                    const anyEnded = st.getTracks().some((t) => t.readyState === 'ended');
                    if (!anyEnded) return;
                    handled = true;
                    console.warn(
                        '[call] Local mic/camera stopped — ending call. If this was unexpected, iOS sometimes fires spurious "ended"; we debounce. Otherwise: HTTPS required on LAN, unplugged device, or another app using the camera.'
                    );
                    const peer = remotePeerIdRef.current || incomingFromRef.current;
                    if (peer && socketRef.current?.connected) {
                        socketRef.current.emit('call:end', { to: peer });
                    }
                    reset();
                }, 750);
            };
            const cleanups = [];
            stream.getTracks().forEach((track) => {
                const fn = () => onEnded();
                track.addEventListener('ended', fn);
                cleanups.push(() => track.removeEventListener('ended', fn));
            });
            localTrackEndedCleanupRef.current = () => {
                clearTimeout(localTrackEndedDebounceRef.current);
                localTrackEndedDebounceRef.current = null;
                cleanups.forEach((c) => c());
            };
        },
        [reset, socketRef]
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
    }, [wireMediaElementPlayback]);

    const attachRemoteVideo = useCallback(
        (stream, _playAudioThroughVideo = false) => {
            const el = remoteVideoRef.current;
            if (!el) {
                pendingRemoteVideoRef.current = { stream, playAudioThroughVideo: _playAudioThroughVideo };
                return;
            }
            if (!stream || stream.getVideoTracks().length === 0) return;
            el.playsInline = true;
            remoteVideoWireCleanupRef.current?.();
            remoteVideoWireCleanupRef.current = null;
            el.srcObject = stream;
            remoteVideoWireCleanupRef.current = wireMediaElementPlayback(el, stream);
        },
        [wireMediaElementPlayback]
    );

    const createPeer = useCallback(
        (mediaKind) => {
            const pc = new RTCPeerConnection({
                iceServers: getIceServers(),
                iceCandidatePoolSize: 10,
            });
            let iceRestartAttempted = false;

            pc.onicecandidate = (ev) => {
                if (!remotePeerIdRef.current || !socketRef.current?.connected) return;
                socketRef.current.emit('call:ice-candidate', {
                    to: remotePeerIdRef.current,
                    candidate: ev.candidate ? iceCandidatePayload(ev.candidate) : null,
                });
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

            pc.oniceconnectionstatechange = () => {
                if (pcRef.current !== pc) return;
                const ice = pc.iceConnectionState;
                if (ice === 'connected' || ice === 'completed') {
                    iceRestartAttempted = false;
                }
                if (
                    ice === 'disconnected' &&
                    !iceRestartAttempted &&
                    callStateRef.current === 'active' &&
                    pc.signalingState !== 'closed'
                ) {
                    iceRestartAttempted = true;
                    try {
                        pc.restartIce();
                    } catch (_) {
                        /* ignore */
                    }
                }
            };

            pc.onconnectionstatechange = () => {
                if (pcRef.current !== pc) return;
                const s = pc.connectionState;
                if (s === 'connected' || s === 'connecting') {
                    if (connectionFailedTimerRef.current) {
                        clearTimeout(connectionFailedTimerRef.current);
                        connectionFailedTimerRef.current = null;
                    }
                }
                if (s === 'closed') {
                    if (connectionFailedTimerRef.current) {
                        clearTimeout(connectionFailedTimerRef.current);
                        connectionFailedTimerRef.current = null;
                    }
                    if (intentionalPeerCloseRef.current) {
                        intentionalPeerCloseRef.current = false;
                        return;
                    }
                    if (callStateRef.current !== 'idle') reset();
                    return;
                }
                if (s === 'failed') {
                    if (connectionFailedTimerRef.current) {
                        clearTimeout(connectionFailedTimerRef.current);
                    }
                    connectionFailedTimerRef.current = setTimeout(() => {
                        connectionFailedTimerRef.current = null;
                        if (pcRef.current === pc && pc.connectionState === 'failed') {
                            setCallBannerRef.current(
                                'The call could not connect. Check internet on both sides and try again.'
                            );
                            reset();
                        }
                    }, 3000);
                }
            };

            pcRef.current = pc;
            return pc;
        },
        [socketRef, reset, routeRemoteAudio, attachRemoteVideo]
    );

    const getMedia = useCallback(async (mediaKind) => {
        const videoConstraints = facingUserRef.current
            ? { facingMode: 'user' }
            : { facingMode: { ideal: 'environment' } };
        const constraints =
            mediaKind === 'audio'
                ? { audio: true, video: false }
                : { audio: true, video: videoConstraints };
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
            setCallBanner(null);
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
                    offer: sdpPayload(offer, 'offer'),
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
                const n = e?.cause?.name || e?.name;
                let b = null;
                if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
                    b = 'Microphone or camera access was denied. Allow NeuroEase in your browser or system settings, then try again.';
                } else if (e?.mediaHint) {
                    b = e.message;
                } else if (String(e?.message || '').toLowerCase().includes('socket')) {
                    b = 'Could not connect to the server to place the call. Check your connection and try again.';
                }
                reset();
                if (b) setCallBanner(b);
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
            const offerInit = normalizeSessionDescription(incomingOfferRef.current, 'offer');
            if (!offerInit) {
                console.error('[call] acceptCall: invalid or missing offer SDP');
                reset();
                setCallBanner('That call invite was invalid or expired. Ask the caller to try again.');
                return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(offerInit));
            await flushPendingIce(pc);
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current.emit('call:answer', { to: from, answer: sdpPayload(answer, 'answer') });

            setCallStateSynced('active');
            startTimer();
        } catch (e) {
            console.error('[call] acceptCall', e);
            if (import.meta.env.DEV && e?.mediaHint) {
                window.alert(e.message);
            }
            const n = e?.cause?.name || e?.name;
            let b = null;
            if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
                b = 'Microphone or camera access was denied. Allow access to answer the call.';
            } else if (e?.mediaHint) {
                b = e.message;
            }
            reset();
            if (b) setCallBanner(b);
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
        flushPendingIce,
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

    /**
     * Swap front (user) and back (environment) camera on an active video call.
     */
    const switchCamera = useCallback(async () => {
        const pc = pcRef.current;
        const stream = localStreamRef.current;
        if (!pc || !stream) return;
        if (callStateRef.current !== 'active' || callTypeRef.current !== 'video') return;
        const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (!videoSender?.track) return;
        const oldVt = videoSender.track;
        const nextUser = !facingUserRef.current;
        const constraints = {
            audio: false,
            video: nextUser
                ? { facingMode: 'user' }
                : { facingMode: { ideal: 'environment' } },
        };
        let newStream;
        try {
            newStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            console.warn('[call] switchCamera getUserMedia', e);
            return;
        }
        const newVt = newStream.getVideoTracks()[0];
        if (!newVt) {
            newStream.getTracks().forEach((t) => t.stop());
            return;
        }
        try {
            await videoSender.replaceTrack(newVt);
        } catch (e) {
            newVt.stop();
            console.warn('[call] switchCamera replaceTrack', e);
            return;
        }
        facingUserRef.current = nextUser;
        try {
            stream.removeTrack(oldVt);
        } catch {
            /* ignore */
        }
        oldVt.stop();
        stream.addTrack(newVt);
        newStream.getAudioTracks().forEach((t) => t.stop());
        const el = localVideoRef.current;
        if (el) {
            el.srcObject = stream;
            el.play().catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onOffer = ({ from, offer, callType: ct }) => {
            const fromId = Number(from);
            const normalizedOffer = normalizeSessionDescription(offer, 'offer');
            if (!Number.isFinite(fromId) || !normalizedOffer) return;
            if (callStateRef.current !== 'idle') {
                socket.emit('call:reject', { to: fromId, reason: 'busy' });
                return;
            }
            incomingFromRef.current = fromId;
            incomingOfferRef.current = normalizedOffer;
            incomingCallTypeRef.current = ct === 'audio' ? 'audio' : 'video';
            setIncomingFrom(fromId);
            setIncomingCallType(incomingCallTypeRef.current);
            setCallType(incomingCallTypeRef.current);
            callTypeRef.current = incomingCallTypeRef.current;
            setCallStateSynced('incoming');
        };

        const onAnswer = async ({ answer }) => {
            const pc = pcRef.current;
            const normalized = normalizeSessionDescription(answer, 'answer');
            if (!pc || !normalized) return;
            // Caller must be waiting for the answer; duplicate socket events are common (reconnect).
            if (pc.signalingState !== 'have-local-offer') {
                if (pc.signalingState === 'stable' && callStateRef.current === 'active') {
                    return;
                }
                return;
            }
            clearCallTimeout();
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(normalized));
                await flushPendingIce(pc);
                setCallStateSynced('active');
                startTimer();
            } catch (e) {
                console.error('[call] onAnswer', e);
                reset();
            }
        };

        const onIce = async ({ from, candidate }) => {
            const fromId = Number(from);
            const peer = remotePeerIdRef.current ?? incomingFromRef.current;
            if (!Number.isFinite(fromId) || !Number.isFinite(peer) || fromId !== peer) return;
            const pc = pcRef.current;
            try {
                if (!pc || !pc.remoteDescription) {
                    pendingIceCandidatesRef.current.push(candidate);
                    return;
                }
                await pc.addIceCandidate(candidate ? new RTCIceCandidate(candidate) : null);
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
    }, [socket, setCallStateSynced, clearCallTimeout, startTimer, stopTimer, stopLocalStream, closePeer, reset, flushPendingIce]);

    useEffect(() => {
        if (!socket) return;
        const onDisconnect = () => {
            if (callStateRef.current === 'idle') return;
            setCallBannerRef.current(
                'You were disconnected from the server during the call. Open Messages and try again when you have a stable connection.'
            );
            reset();
        };
        socket.on('disconnect', onDisconnect);
        return () => socket.off('disconnect', onDisconnect);
    }, [socket, reset]);

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
    }, [callState, wireMediaElementPlayback]);

    /** Local preview must attach whenever the <video> exists; getUserMedia often runs before refs mount (calling/incoming). */
    useLayoutEffect(() => {
        const stream = localStreamRef.current;
        const isVideoCall =
            callState === 'incoming' ? incomingCallType === 'video' : callType === 'video';
        if (!stream || !isVideoCall) return;
        if (!['calling', 'incoming', 'active'].includes(callState)) return;
        const el = localVideoRef.current;
        if (!el) return;
        if (el.srcObject !== stream) {
            el.srcObject = stream;
            el.muted = true;
            el.playsInline = true;
            void el.play().catch(() => {});
        }
    }, [callState, callType, incomingCallType]);

    const unlockRemoteAudio = useCallback(() => {
        const nodes = [remoteAudioRef.current, remoteVideoRef.current];
        nodes.forEach((el) => {
            if (!el?.srcObject) return;
            void el
                .play()
                .then(() => {
                    setNeedsAudioUnlock(false);
                    return applyRemoteAudioOutput(el, speakerOutputOnRef.current);
                })
                .catch(() => {});
        });
    }, []);

    const toggleSpeakerOutput = useCallback(() => {
        setSpeakerOutputOn((prev) => {
            const next = !prev;
            speakerOutputOnRef.current = next;
            queueMicrotask(async () => {
                await applyRemoteAudioOutput(remoteAudioRef.current, next);
                await applyRemoteAudioOutput(remoteVideoRef.current, next);
            });
            return next;
        });
    }, []);

    useEffect(() => {
        if (callState !== 'active' || !remoteSpeakerOutputAvailable()) return;
        const h = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                void applyRemoteAudioOutput(remoteAudioRef.current, speakerOutputOn);
                void applyRemoteAudioOutput(remoteVideoRef.current, speakerOutputOn);
            });
        });
        return () => cancelAnimationFrame(h);
    }, [callState, speakerOutputOn]);

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
        callBanner,
        clearCallBanner,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        cancelCall,
        toggleMute,
        toggleVideo,
        switchCamera,
        speakerOutputOn,
        toggleSpeakerOutput,
        speakerOutputAvailable: remoteSpeakerOutputAvailable(),
    };
}
