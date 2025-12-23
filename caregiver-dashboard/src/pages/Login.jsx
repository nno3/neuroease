import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Pass email and password to login function
            const result = await login(email, password);
            if (result && result.success) {
                navigate('/');
            } else {
                setError('Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login failed:', error);
            setError('Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLogin = async () => {
        setLoading(true);
        setError('');

        try {
            // Use mock credentials for quick login
            const result = await login('caregiver@neuroease.com', 'password123');
            if (result && result.success) {
                navigate('/');
            } else {
                setError('Quick login failed');
            }
        } catch (error) {
            setError('Quick login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f1f5f9'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h1 style={{ marginBottom: '24px', color: '#1e293b' }}>NeuroEase Login</h1>

                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '20px',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ marginBottom: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            color: '#475569',
                            fontWeight: '500'
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="caregiver@neuroease.com"
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            color: '#475569',
                            fontWeight: '500'
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#64748b', marginBottom: '12px' }}>For development testing:</p>
                    <button
                        onClick={handleQuickLogin}
                        disabled={loading}
                        style={{
                            padding: '10px 20px',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Logging in...' : 'Quick Login as Caregiver'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;