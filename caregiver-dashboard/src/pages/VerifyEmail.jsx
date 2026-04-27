import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../services/apiClient';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'warning' | 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Missing verification link. Please use the link from your email.');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = res.headers.get('content-type')?.includes('json') ? await res.json() : {};
                if (cancelled) return;
                if (res.ok && data.success) {
                    setStatus('success');
                    setMessage(
                        data.message
                        || (data.code === 'LINK_INACTIVE'
                            ? 'This link is no longer active. If you can log in, your email is already verified.'
                            : 'Your email has been verified. You can now log in.')
                    );
                } else if (res.status === 400 && data.code === 'EXPIRED') {
                    setStatus('warning');
                    setMessage(data.message || 'This verification link has expired. Request a new one from the login page.');
                } else {
                    setStatus('error');
                    setMessage(data.message || 'We could not verify that link. Request a new one from the login page if you still need to verify.');
                }
            } catch (err) {
                if (!cancelled) {
                    setStatus('error');
                    const isNetwork = err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('Failed to fetch'));
                    setMessage(isNetwork
                        ? 'Could not reach the server. Use http (not https) for the link if you are on localhost, and ensure the backend is running.'
                        : 'Something went wrong. Please try again or request a new link.');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [token]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f1f5f9',
            padding: '24px'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '440px',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '8px', color: '#1e293b', fontSize: '22px' }}>Email verification</h1>

                {status === 'loading' && (
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Verifying your email…</p>
                )}

                {status === 'success' && (
                    <>
                        <p style={{ color: '#166534', fontSize: '14px', marginBottom: '20px' }}>{message}</p>
                        <Link
                            to="/login"
                            style={{
                                display: 'inline-block',
                                padding: '10px 24px',
                                background: '#4A90E2',
                                color: 'white',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '600',
                                textDecoration: 'none'
                            }}
                        >
                            Log in
                        </Link>
                    </>
                )}

                {status === 'warning' && (
                    <>
                        <p style={{ color: '#9a3412', fontSize: '14px', marginBottom: '20px' }}>{message}</p>
                        <Link
                            to="/login"
                            style={{
                                display: 'inline-block',
                                padding: '10px 24px',
                                background: '#4A90E2',
                                color: 'white',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '600',
                                textDecoration: 'none'
                            }}
                        >
                            Back to login
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <p style={{ color: '#991b1b', fontSize: '14px', marginBottom: '20px' }}>{message}</p>
                        <Link
                            to="/login"
                            style={{
                                display: 'inline-block',
                                padding: '10px 24px',
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '600',
                                textDecoration: 'none'
                            }}
                        >
                            Back to login
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
