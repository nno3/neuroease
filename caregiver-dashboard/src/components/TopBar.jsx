import './TopBar.css';

const TopBar = ({ title = 'Dashboard Overview', onPrimaryAction }) => {
    return (
        <header className="topbar">
            <div className="topbar-left">
                <h1>{title}</h1>
            </div>

            <div className="topbar-right">
                <button className="primary-btn" onClick={onPrimaryAction}>
                    + Add Patient
                </button>

                <div className="user-info">
                    <div className="avatar">SJ</div>
                    <span className="username">Dr. Sarah Johnson</span>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
