import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout = () => {
    const handleAddPatient = () => {
        alert('Add Patient clicked (wire this later)');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <TopBar
                    title="Dashboard Overview"
                    onPrimaryAction={handleAddPatient}
                />

                <main style={{ padding: '24px', backgroundColor: '#f1f5f9', flex: 1 }}>
                    <p>Dashboard Skeleton</p>
                </main>
            </div>
        </div>
    );
};

export default Layout;
