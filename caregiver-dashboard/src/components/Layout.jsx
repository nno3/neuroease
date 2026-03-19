import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./Layout.css";

const isUsabilityTesting = import.meta.env.VITE_USABILITY_TESTING === "1";

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
                {isUsabilityTesting && (
                    <>
                        <div className="disclaimer-banner disclaimer-banner--content" role="status">
                            <strong>Content notice:</strong> This study relates to memory difficulties/dementia and includes examples involving reminders, medication, and safety features. Some people may find this topic sensitive.
                        </div>
                        <div className="disclaimer-banner disclaimer-banner--testing" role="status">
                            <strong>Usability testing:</strong> Use your real email when creating a patient so you receive the activation link. All other data (names, medical info, reminders) is simulated.
                        </div>
                    </>
                )}
                <main className="layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;