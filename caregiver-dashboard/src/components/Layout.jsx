import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./Layout.css";

const Layout = () => {
    const handleAddPatient = () => {
        alert("Add Patient clicked (wire this later)");
    };

    return (
        <div className="layout">
            <Sidebar />
            <div className="layout-main">
                <TopBar
                    title="Dashboard Overview"
                    onPrimaryAction={handleAddPatient}
                />
                <main className="layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;