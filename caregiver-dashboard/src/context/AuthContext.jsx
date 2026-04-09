/**
 * Caregiver auth context – holds user state and login/logout. On mount, restores
 * user from localStorage if token and user data exist. login() calls backend and
 * stores token + user; logout() clears them and redirects to /login.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../services/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            try {
                const token = localStorage.getItem('token');
                const userData = localStorage.getItem('user');

                if (token && userData) {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);
                }
            } catch (error) {
                console.error('Auth check error:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email, password) => {
        try {
            // Require credentials; no silent mock fallback
            if (!email || !password) {
                return {
                    success: false,
                    error: 'Email and password are required.',
                    errors: []
                };
            }

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    password: password
                })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success) {
                const userData = data.data.user;
                const token = data.data.token;

                setUser(userData);
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(userData));

                return { success: true };
            }

            const errorMsg = data.errors?.[0] || data.message || 'Login failed. Please check your credentials.';
            return {
                success: false,
                error: errorMsg,
                errors: data.errors || [],
                code: data.code
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: 'Could not reach the server. Is the backend running at ' + (API_BASE || 'the API URL') + '?',
                errors: []
            };
        }
    };

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { success: true };
    }, []);

    useEffect(() => {
        const onSessionExpired = () => logout();
        window.addEventListener('ne-caregiver-auth-expired', onSessionExpired);
        return () => window.removeEventListener('ne-caregiver-auth-expired', onSessionExpired);
    }, [logout]);

    const loginWithToken = (userData, token) => {
        if (!userData || !token) return { success: false, error: 'Invalid session' };
        setUser(userData);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        return { success: true };
    };
    const token = localStorage.getItem("token");

    const updateUser = (userData) => {
        if (userData) {
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            loginWithToken,
            logout,
            updateUser,
            loading,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);