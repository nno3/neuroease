/**
 * Patient auth context – no password; login() is called with (user, token) after
 * activate or magic-link verification. State is persisted in localStorage via apiClient.
 */
import React, { createContext, useContext, useState, useEffect } from "react";
import { getStoredAuth, clearStoredAuth, setStoredAuth } from "../services/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user && auth?.token) {
      setUser(auth.user);
    }
    setLoading(false);
  }, []);

  /** Called after successful activate or magic-link verify; stores token and sets user */
  const login = (userData, token) => {
    setStoredAuth(userData, token);
    setUser(userData);
  };

  /** Clear stored auth and user state (e.g. before redirect to /login) */
  const logout = () => {
    clearStoredAuth();
    setUser(null);
  };

  const value = { user, loading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
