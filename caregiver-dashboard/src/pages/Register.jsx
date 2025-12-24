import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
    const navigate = useNavigate();

    // Registration state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        // Password strength validation (uppercase, lowercase, number)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
        if (!passwordRegex.test(password)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Call your backend registration API
            const response = await fetch('http://localhost:5001/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    name: name,
                    userType: 'caregiver'
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccess('Registration successful! You will be redirected to login.');

                // Clear form
                setEmail('');
                setPassword('');
                setName('');
                setConfirmPassword('');

                // Redirect to login after 2 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            } else {
                setError(data.message || data.errors?.[0] || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setError('Registration failed. Please check your connection.');
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
                marginTop: '40px',
                marginBotton: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '550px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ marginBottom: '8px', color: '#1e293b' }}>Create Caregiver Account</h1>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>
                        Register to access the NeuroEase dashboard
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

                {success && (
                    <div style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '20px',
                        fontSize: '14px'
                    }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ marginBottom: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            color: '#475569',
                            fontWeight: '500',
                            fontSize: '14px'
                        }}>
                            Full Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Dr. Sarah Johnson"
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                transition: 'border 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            color: '#475569',
                            fontWeight: '500',
                            fontSize: '14px'
                        }}>
                            Email Address *
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
                                fontSize: '14px',
                                transition: 'border 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            color: '#475569',
                            fontWeight: '500',
                            fontSize: '14px'
                        }}>
                            Password *
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
                                fontSize: '14px',
                                transition: 'border 0.2s'
                            }}
                        />
                        <div style={{
                            marginTop: '6px',
                            fontSize: '12px',
                            color: '#64748b',
                            padding: '8px',
                            background: '#f8fafc',
                            borderRadius: '4px'
                        }}>
                            <p style={{ margin: '0 0 4px 0' }}>Password must:</p>
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                <li>Be at least 8 characters long</li>
                                <li>Contain at least one uppercase letter</li>
                                <li>Contain at least one lowercase letter</li>
                                <li>Contain at least one number</li>
                            </ul>
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            color: '#475569',
                            fontWeight: '500',
                            fontSize: '14px'
                        }}>
                            Confirm Password *
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                transition: 'border 0.2s'
                            }}
                        />
                    </div>

                    <div style={{
                        background: '#f8fafc',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '24px',
                        border: '1px solid #e2e8f0'
                    }}>
                        <h4 style={{
                            margin: '0 0 8px 0',
                            fontSize: '14px',
                            color: '#475569',
                            fontWeight: '500'
                        }}>
                            Registration Information
                        </h4>
                        <p style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#64748b',
                            lineHeight: '1.4'
                        }}>
                            You are registering as a <strong>Caregiver</strong>. After registration, you will be able to:
                        </p>
                        <ul style={{
                            margin: '8px 0 0 0',
                            paddingLeft: '16px',
                            fontSize: '12px',
                            color: '#64748b',
                            lineHeight: '1.4'
                        }}>
                            <li>Add and manage patients</li>
                            <li>Create medication and appointment reminders</li>
                            <li>Monitor patient activity and location</li>
                            <li>View detailed analytics and reports</li>
                        </ul>
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
                        onMouseOver={(e) => {
                            if (!loading) e.target.style.opacity = '0.9';
                        }}
                        onMouseOut={(e) => {
                            if (!loading) e.target.style.opacity = '1';
                        }}
                    >
                        {loading ? 'Registering...' : 'Register as Caregiver'}
                    </button>
                </form>

                <div style={{
                    textAlign: 'center',
                    paddingTop: '0px',
                    borderTop: '1px solid #e2e8f0'
                }}>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
                        Already have an account?
                    </p>
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
                        Back to Login
                    </Link>
                </div>

                <div style={{
                    marginTop: '24px',
                    padding: '12px',
                    background: '#fffbeb',
                    borderRadius: '6px',
                    border: '1px solid #fde68a'
                }}>
                    <p style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#92400e',
                        lineHeight: '1.4'
                    }}>
                        <strong>Note:</strong> This registration uses actual backend API. Make sure backend is running on http://localhost:5001
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;