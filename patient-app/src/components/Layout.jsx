import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
      <header className="pa-header">
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
      <main className="pa-main">
        <Outlet />
      </main>
    </div>
  );
}
