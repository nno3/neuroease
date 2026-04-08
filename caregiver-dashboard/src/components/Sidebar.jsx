import React from 'react';
import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    Bell,
    Activity,
    MapPin,
    MessageSquare,
    Settings,
    X,
} from "lucide-react";
import "./Sidebar.css";

const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/reminders", label: "Reminders", icon: Bell },
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/location", label: "Location", icon: MapPin },
    { to: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
    { to: "/settings", label: "Settings", icon: Settings },
];

const Sidebar = ({ isOpen = false, onClose, badges = {} }) => {
    return (
        <>
            {onClose && <div className={`sidebar-overlay ${isOpen ? "is-open" : ""}`} onClick={onClose} aria-hidden />}
            <aside className={`sidebar ${isOpen ? "is-open" : ""}`}>
            <div className="sidebar-brand">
                <h2 className="sidebar-brand-title">NeuroEase</h2>
                {onClose && (
                    <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close menu">
                        <X size={24} />
                    </button>
                )}
            </div>
            <nav className="sidebar-nav">
                {navItems.map(({ to, label, icon: Icon, badgeKey }) => {
                    const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === "/"}
                            onClick={onClose}
                            className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`}
                        >
                            <span className="sidebar-link-icon-wrap">
                                <Icon size={20} className="sidebar-link-icon" aria-hidden />
                                {badgeCount > 0 && (
                                    <span className="sidebar-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
                                )}
                            </span>
                            <span>{label}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
        </>
    );
};

export default Sidebar;
