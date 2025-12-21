import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    return (
        <aside style={{ width: '220px', background: '#1e293b', color: '#fff', padding: '20px' }}>
            <h2>NeuroEase</h2>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <NavLink to="/" style={{ color: '#fff' }}>Dashboard</NavLink>
                <NavLink to="/patients" style={{ color: '#fff' }}>Patients</NavLink>
                <NavLink to="/reminders" style={{ color: '#fff' }}>Reminders</NavLink>
                <NavLink to="/activity" style={{ color: '#fff' }}>Activity</NavLink>
                <NavLink to="/location" style={{ color: '#fff' }}>Location</NavLink>
            </nav>
        </aside>
    );
};

export default Sidebar;
