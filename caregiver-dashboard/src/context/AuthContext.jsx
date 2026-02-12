import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing token on mount
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
            // Check if we're using quick login
            if (!email && !password) {
                return quickLogin();
            }

            console.log('Attempting login with:', { email: email.substring(0, 10) + '...' });

            // API login
            const response = await fetch('http://localhost:5001/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();
            console.log('Login response:', {
                status: response.status,
                ok: response.ok,
                data: data
            });

            if (response.ok && data.success) {
                // Store user data and token
                const userData = data.data.user;
                const token = data.data.token;

                setUser(userData);
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(userData));

                return { success: true };
            } else {
                const errorMsg = data.errors?.[0] || data.message || 'Login failed. Please check your credentials.';
                return {
                    success: false,
                    error: errorMsg,
                    errors: data.errors || [],
                    code: data.code
                };
            }
        } catch (error) {
            console.error('Login error:', error);

            // Fallback to quick login for development
            console.warn('API not available, using quick login for development');
            return quickLogin();
        }
    };

    // Quick login function for development
    const quickLogin = () => {
        const mockUser = {
            id: 1,
            name: 'Dr. Sarah Johnson',
            email: 'caregiver@neuroease.com',
            role: 'caregiver',
            userType: 'caregiver'
        };

        const mockToken = 'mock-jwt-token-for-development';

        setUser(mockUser);
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify(mockUser));

        return { success: true };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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