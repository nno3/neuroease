/**
 * Logged-in shell: header (app name), main content area, bottom nav.
 * Wraps the whole app in CallProvider so incoming calls are detected on every page.
 */
import React, { useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VoiceAssistListener from "./VoiceAssistListener";
import CallOverlay from "./CallOverlay";
import { CallProvider } from "../context/CallContext";
import { useCall } from "../context/useCall";
import { Gamepad2, Bell, MessageSquare, UserRound } from "lucide-react";
import "./Layout.css";

function LayoutInner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    callState, callType, incomingCallType, callerName, callDuration,
    localVideoRef, remoteVideoRef, remoteAudioRef,
    needsAudioUnlock, unlockRemoteAudio,
    callBanner, clearCallBanner,
    acceptCall, rejectCall, endCall, cancelCall,
    toggleMute, toggleVideo, switchCamera,
    speakerOutputOn, toggleSpeakerOutput, speakerOutputAvailable,
  } = useCall();

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "sw-navigate" && typeof e.data.url === "string") {
        navigate(e.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, [navigate]);

  return (
    <div className="pa-layout">
      <CallOverlay
        callState={callState}
        callType={callType}
        incomingCallType={incomingCallType}
        contactName={callerName}
        callDuration={callDuration}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        remoteAudioRef={remoteAudioRef}
        needsAudioUnlock={needsAudioUnlock}
        onUnlockAudio={unlockRemoteAudio}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onCancel={cancelCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onSwitchCamera={switchCamera}
        speakerOutputOn={speakerOutputOn}
        onToggleSpeakerOutput={toggleSpeakerOutput}
        speakerOutputAvailable={speakerOutputAvailable}
      />
      {user && <VoiceAssistListener />}
      <a href="#pa-main" className="pa-skip-link">
        Skip to main content
      </a>
      {callBanner && (
        <div className="pa-call-banner" role="alert">
          <p className="pa-call-banner-text">{callBanner}</p>
          <button type="button" className="pa-call-banner-dismiss" onClick={clearCallBanner}>
            Dismiss
          </button>
        </div>
      )}
      <header className="pa-header" role="banner">
        <h1 className="pa-header-title">NeuroEase</h1>
      </header>
      <main id="pa-main" className="pa-main" role="main">
        <Outlet />
      </main>
      {user && (
        <nav className="pa-bottom-nav" aria-label="Main navigation">
          <NavLink to="/games" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            <Gamepad2 className="pa-bottom-nav-icon" size={22} strokeWidth={2} aria-hidden />
            <span className="pa-bottom-nav-label">Games</span>
          </NavLink>
          <NavLink to="/reminders" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            <Bell className="pa-bottom-nav-icon" size={22} strokeWidth={2} aria-hidden />
            <span className="pa-bottom-nav-label">Reminders</span>
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            <MessageSquare className="pa-bottom-nav-icon" size={22} strokeWidth={2} aria-hidden />
            <span className="pa-bottom-nav-label">Messages</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            <UserRound className="pa-bottom-nav-icon" size={22} strokeWidth={2} aria-hidden />
            <span className="pa-bottom-nav-label">Profile</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}

export default function Layout() {
  return (
    <CallProvider>
      <LayoutInner />
    </CallProvider>
  );
}
