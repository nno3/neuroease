/**
 * Logged-in shell: header (app name + logout), main content area, bottom nav.
 * Wraps the whole app in CallProvider so incoming calls are detected on every page.
 */
import React, { useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VoiceAssistListener from "./VoiceAssistListener";
import CallOverlay from "./CallOverlay";
import { CallProvider } from "../context/CallContext";
import { useCall } from "../context/useCall";
import "./Layout.css";

function LayoutInner() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const {
    callState, callType, incomingCallType, callerName, callDuration,
    localVideoRef, remoteVideoRef, remoteAudioRef,
    needsAudioUnlock, unlockRemoteAudio,
    callBanner, clearCallBanner,
    acceptCall, rejectCall, endCall, cancelCall,
    toggleMute, toggleVideo,
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

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

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
        {user && (
          <button
            type="button"
            className="pa-header-logout"
            onClick={handleLogout}
            aria-label="Log out"
          >
            Log out
          </button>
        )}
      </header>
      <main id="pa-main" className="pa-main" role="main">
        <Outlet />
      </main>
      {user && (
        <nav className="pa-bottom-nav" aria-label="Main navigation">
          <NavLink to="/games" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            Games
          </NavLink>
          <NavLink to="/reminders" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            Reminders
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            Messages
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}>
            Profile
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
