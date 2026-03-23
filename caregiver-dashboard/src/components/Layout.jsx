import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./Layout.css";

const isUsabilityTesting = import.meta.env.VITE_USABILITY_TESTING === "1";
const DISCLAIMER_DURATION_MS = 4000;

const routeTitles = {
    "/": "Dashboard Overview",
    "/patients": "Patients",
    "/reminders": "Reminders",
    "/activity": "Activity",
    "/location": "Location",
    "/settings": "Settings",
};

const Layout = () => {
    const { pathname } = useLocation();
    const [showDisclaimers, setShowDisclaimers] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const title = routeTitles[pathname] || "NeuroEase";

    useEffect(() => {
        if (!isUsabilityTesting) return;
        const t = setTimeout(() => setShowDisclaimers(false), DISCLAIMER_DURATION_MS);
        return () => clearTimeout(t);
    }, []);

    const handleAddPatient = () => {
        alert("Add Patient clicked (wire this later)");
    };

    return (
        <div className="layout">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="layout-main">
                <TopBar
                    title={title}
                    onPrimaryAction={handleAddPatient}
                    onMenuClick={() => setSidebarOpen((o) => !o)}
                />
                {isUsabilityTesting && showDisclaimers && (
                    <div className="disclaimer-banners-container" role="status" aria-live="polite">
                        <div className="disclaimer-banner disclaimer-banner--content">
                            <strong>Content notice:</strong> This study relates to memory difficulties/dementia and includes examples involving reminders, medication, and safety features. Some people may find this topic sensitive.
                        </div>
                        <div className="disclaimer-banner disclaimer-banner--testing">
                            <strong>Usability testing:</strong> Use your real email when creating a patient. All other data is simulated. On Location, use simulated locations only. Participation is voluntary.
                        </div>
                    </div>
                )}
                <main className="layout-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;