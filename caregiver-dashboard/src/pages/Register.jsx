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

        // Only basic UX validation - backend is the source
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const normalizedEmail = (email || '').trim().toLowerCase();
            const response = await fetch('http://localhost:5001/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: normalizedEmail,
                    password: password,
                    name: name,
                    userType: 'caregiver'
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccess(`Registration successful! We sent a verification link to ${normalizedEmail}. Please check your email and click the link to verify your account, then you can log in.`);
                setPassword('');
                setConfirmPassword('');
                setName('');
                setEmail(normalizedEmail);
            } else {
                // Display backend validation errors
                const errorMessage = data.errors && data.errors.length > 0
                    ? data.errors[0]  // Show first specific error
                    : data.message || 'Registration failed. Please try again.';
                setError(errorMessage);
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
                marginTop: '15px',
                marginBottom: '15px',
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
                        <p style={{ margin: '0 0 10px 0' }}>{success}</p>
                        <Link to="/login" style={{ color: '#166534', fontWeight: '600', textDecoration: 'underline' }}>
                            Go to login →
                        </Link>
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
                            }} />
                            {/* Helpful hints (not validation) */}
                        <div style={{
                            marginTop: '6px',
                            fontSize: '12px',
                            color: '#64748b',
                            fontStyle: 'italic'
                        }} >
                            Hint: Password should be at least 8 characters with uppercase, lowercase, a number, and a special character (@$!%*?&)
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
                            padding: '10px 14px',
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
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;