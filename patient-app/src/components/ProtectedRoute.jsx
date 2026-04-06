/**
 * Wraps routes that require a logged-in patient. Shows loading until auth is restored from storage;
 * if no user, redirects to /login. Used for Layout (Home, Reminders).
 */
import React from 'react';
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="pa-page pa-page--center">
        <div className="pa-card">
          <p className="pa-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
