/**
 * Logged-in shell: header (app name + logout), main content area, bottom nav (Games, Reminders, Profile).
 * Skip link and focus order support accessibility; touch targets and contrast in CSS.
 */
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VoiceAssistListener from "./VoiceAssistListener";
import "./Layout.css";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="pa-layout">
      {user && <VoiceAssistListener />}
      <a href="#pa-main" className="pa-skip-link">
        Skip to main content
      </a>
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
          <NavLink
            to="/games"
            className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}
          >
            Games
          </NavLink>
          <NavLink
            to="/reminders"
            className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}
          >
            Reminders
          </NavLink>
          <NavLink
            to="/messages"
            className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}
          >
            Messages
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => `pa-bottom-nav-link ${isActive ? "is-active" : ""}`}
          >
            Profile
          </NavLink>
        </nav>
      )}
    </div>
  );
}
