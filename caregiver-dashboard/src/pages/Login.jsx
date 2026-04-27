import React from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../services/apiClient';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendStatus, setResendStatus] = useState(''); // '' | 'sending' | 'sent' | 'error'
    const [emailNotVerified, setEmailNotVerified] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');
        setEmailNotVerified(false);

        try {
            const result = await login(email, password);
            if (result && result.success) {
                navigate('/');
            } else {
                setError(result?.error || 'Login failed. Please make sure your Email and Password are correct.');
                if (result?.code === 'EMAIL_NOT_VERIFIED') setEmailNotVerified(true);
            }
        } catch {
            setError('Login failed. Please make sure your Email and Password are correct.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        const trimEmail = (email || '').trim().toLowerCase();
        if (!trimEmail) {
            setError('Enter your email above first.');
            return;
        }
        setResendStatus('sending');
        setError('');
        try {
            const res = await fetch(`${API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimEmail }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setResendStatus('sent');
            } else {
                setResendStatus('error');
                setError(data.message || 'Failed to send verification email.');
            }
        } catch {
            setResendStatus('error');
            setError('Failed to send. Please try again.');
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
                {emailNotVerified && (
                    <div style={{
                        background: '#fffbeb',
                        color: '#92400e',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '20px',
                        fontSize: '14px'
                    }}>
                        <p style={{ margin: '0 0 8px 0' }}>Your email is not verified yet.</p>
                        {resendStatus === 'sent' ? (
                            <p style={{ margin: 0, color: '#166534' }}>Verification email sent. Check your inbox.</p>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={resendStatus === 'sending'}
                                style={{
                                    padding: '6px 12px',
                                    background: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: resendStatus === 'sending' ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                            </button>
                        )}
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