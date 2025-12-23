import { NavLink } from 'react-router-dom';
const linkStyle = ({ isActive }) => ({
    color: "#e2e8f0",
    textDecoration: "none",
    padding: "10px 12px",
    borderRadius: 10,
    background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
});
const Sidebar = () => {
    return (
        <aside style={{ width: '220px', background: '#1e293b', color: '#fff', padding: '20px' }}>
            <h2 style={{ marginTop: 6, marginBottom: 18 }}>NeuroEase</h2>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <NavLink to="/" style={linkStyle}>Dashboard</NavLink>
                <NavLink to="/patients" style={linkStyle}>Patients</NavLink>
                <NavLink to="/reminders" style={linkStyle}>Reminders</NavLink>
                <NavLink to="/activity" style={linkStyle}>Activity</NavLink>
                <NavLink to="/location" style={linkStyle}>Location</NavLink>
            </nav>
        </aside>
    );
};

export default Sidebar;