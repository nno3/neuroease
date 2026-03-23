import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    Bell,
    Activity,
    MapPin,
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
];

const Sidebar = ({ isOpen = false, onClose }) => {
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
                {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        onClick={onClose}
                        className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`}
                    >
                        <Icon size={20} className="sidebar-link-icon" aria-hidden />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
            <nav className="sidebar-nav sidebar-nav-bottom">
                <NavLink
                    to="/settings"
                    onClick={onClose}
                    className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`}
                >
                    <Settings size={20} className="sidebar-link-icon" aria-hidden />
                    <span>Settings</span>
                </NavLink>
            </nav>
        </aside>
        </>
    );
};

export default Sidebar;
