import { Outlet } from "react-router-dom";
import "./Layout.css";

export default function Layout() {
  return (
    <div className="pa-layout">
      <header className="pa-header">
        <h1 className="pa-header-title">NeuroEase</h1>
      </header>
      <main className="pa-main">
        <Outlet />
      </main>
    </div>
  );
}
