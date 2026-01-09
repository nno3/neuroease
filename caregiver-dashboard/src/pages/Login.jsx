import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

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
            const result = await login(email, password);
            console.log('Login result:', result);
            if (result && result.success) {
                navigate('/');
            } else {
                // Check if result has specific errors
                setError(result?.error || 'Login failed. Please make sure your Email and Password are correct.');
            }
        } catch (error) {
            console.error('Login failed:', error);
            setError('Login failed. Please make sure your Email and Password are correct.');
        } finally {
            setLoading(false);
        }
    };
    const handleQuickLogin = async () => {
        setLoading(true);
        setError('');

        try {
            // Call login without credentials for quick login
            const result = await login('test@example.com', 'Test123!');
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
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ marginBottom: '8px', color: '#1e293b' }}>NeuroEase</h1>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>
                        Caregiver Dashboard Login
                    </p>
                </div>

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
                            fontWeight: '500',
                            fontSize: '14px'
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
                            fontWeight: '500',
                            fontSize: '14px'
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
                            opacity: loading ? 0.7 : 1,
                            transition: 'all 0.2s',
                            marginBottom: '16px'
                        }}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <p style={{ color: '#64748b', marginBottom: '12px', fontSize: '14px' }}>
                        For development testing:
                    </p>
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
                            opacity: loading ? 0.7 : 1,
                            fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? 'Logging in...' : 'Quick Login as Caregiver'}
                    </button>
                </div>

                <div style={{
                    textAlign: 'center',
                    paddingTop: '24px',
                    borderTop: '1px solid #e2e8f0'
                }}>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
                        Don't have an account?
                    </p>
                    <Link
                        to="/register"
                        style={{
                            display: 'inline-block',
                            padding: '10px 24px',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.background = '#e2e8f0';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = '#f1f5f9';
                        }}
                    >
                        Register as Caregiver
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Login;