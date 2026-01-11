import './TopBar.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const TopBar = ({ title = 'Dashboard Overview', onPrimaryAction }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            logout();
            navigate('/login');
        }
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <h1></h1>
            </div>

            <div className="topbar-right">


                <div className="user-info" style={{ cursor: 'pointer' }} onClick={handleLogout}>
                    <div className="avatar">SJ</div>
                    <span className="username">{user?.name || 'Dr. Sarah Johnson'}</span>
                </div>
            </div>
        </header>
    );
};

export default TopBar;