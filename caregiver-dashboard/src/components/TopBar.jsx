import './TopBar.css';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function getInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || '?').toUpperCase();
}

const TopBar = ({ title = 'Dashboard Overview', onPrimaryAction, onMenuClick }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const goToSettings = () => navigate('/settings');

    return (
        <header className="topbar">
            <div className="topbar-left">
                {onMenuClick && (
                    <button type="button" className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
                        <Menu size={24} />
                    </button>
                )}
                <h1 className="topbar-title">{title}</h1>
            </div>

            <div className="topbar-right">
                <div className="user-info" onClick={goToSettings} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToSettings(); } }} aria-label="Go to settings">
                    {user?.avatar ? (
                        <img src={user.avatar} alt="" className="topbar-avatar-img" />
                    ) : (
                        <div className="avatar">{getInitials(user?.name)}</div>
                    )}
                    <span className="username">{user?.name || 'User'}</span>
                </div>
            </div>
        </header>
    );
};

export default TopBar;