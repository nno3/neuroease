import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    Bell,
    Activity,
    MapPin,
    Settings,
} from "lucide-react";
import "./Sidebar.css";

const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/reminders", label: "Reminders", icon: Bell },
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/location", label: "Location", icon: MapPin },
];

const Sidebar = () => {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <h2 className="sidebar-brand-title">NeuroEase</h2>
            </div>
            <nav className="sidebar-nav">
                {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
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
                    className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`}
                >
                    <Settings size={20} className="sidebar-link-icon" aria-hidden />
                    <span>Settings</span>
                </NavLink>
            </nav>
        </aside>
    );
};

export default Sidebar;
