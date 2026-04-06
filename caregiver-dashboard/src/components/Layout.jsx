import React from 'react';
import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CallOverlay from "./CallOverlay";
import { useAuth } from "../context/AuthContext";
import { usePushSubscription } from "../hooks/usePushSubscription";
import { CallProvider } from "../context/CallContext";
import { useCall } from "../context/useCall";
import { apiRequest } from "../services/apiClient";
import "./Layout.css";

const routeTitles = {
    "/": "Dashboard Overview",
    "/patients": "Patients",
    "/reminders": "Reminders",
    "/activity": "Activity",
    "/location": "Location",
    "/messages": "Messages",
    "/settings": "Settings",
};

function LayoutInner() {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const title = routeTitles[pathname] || "NeuroEase";
    usePushSubscription(user);

    const {
        socket,
        callState, callType, incomingCallType, callerName, callDuration,
        localVideoRef, remoteVideoRef, remoteAudioRef,
        acceptCall, rejectCall, endCall, cancelCall,
        toggleMute, toggleVideo,
    } = useCall();

    const fetchUnread = useCallback(async () => {
        try {
            const res = await apiRequest('/messages/unread-count');
            setUnreadMessages(res.data?.count ?? 0);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchUnread(); }, [fetchUnread]);
    useEffect(() => {
        if (pathname === '/messages') setUnreadMessages(0);
    }, [pathname]);

    useEffect(() => {
        if (!socket) return;
        const handler = () => {
            if (pathname !== '/messages') setUnreadMessages((n) => n + 1);
        };
        socket.on('new_message', handler);
        return () => socket.off('new_message', handler);
    }, [socket, pathname]);

    const handleAddPatient = () => {
        alert("Add Patient clicked (wire this later)");
    };

    return (
        <div className="layout">
            <CallOverlay
                callState={callState}
                callType={callType}
                incomingCallType={incomingCallType}
                contactName={callerName}
                callDuration={callDuration}
                localVideoRef={localVideoRef}
                remoteVideoRef={remoteVideoRef}
                remoteAudioRef={remoteAudioRef}
                onAccept={acceptCall}
                onReject={rejectCall}
                onEnd={endCall}
                onCancel={cancelCall}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
            />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} badges={{ messages: unreadMessages }} />
            <div className="layout-main">
                <TopBar
                    title={title}
                    onPrimaryAction={handleAddPatient}
                    onMenuClick={() => setSidebarOpen((o) => !o)}
                />
                <main className="layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

const Layout = () => (
    <CallProvider>
        <LayoutInner />
    </CallProvider>
);

export default Layout;
