import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "../context/AuthContext";
import { usePushSubscription } from "../hooks/usePushSubscription";
import { useSocket } from "../hooks/useSocket";
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

const Layout = () => {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const title = routeTitles[pathname] || "NeuroEase";
    const socketRef = useSocket();
    usePushSubscription(user);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await apiRequest('/messages/unread-count');
            setUnreadMessages(res.data?.count ?? 0);
        } catch { /* ignore */ }
    }, []);

    // Fetch on mount and clear badge when on messages page
    useEffect(() => { fetchUnread(); }, [fetchUnread]);
    useEffect(() => {
        if (pathname === '/messages') setUnreadMessages(0);
    }, [pathname]);

    // Increment badge in real time when a new message arrives
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        const handler = () => {
            if (pathname !== '/messages') setUnreadMessages((n) => n + 1);
        };
        socket.on('new_message', handler);
        return () => socket.off('new_message', handler);
    }, [socketRef, pathname]);

    const handleAddPatient = () => {
        alert("Add Patient clicked (wire this later)");
    };

    return (
        <div className="layout">
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
};

export default Layout;