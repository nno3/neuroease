/**
 * Patient app entry – mounts React app with router. In dev we unregister service
 * workers so the browser doesn’t serve an old cached bundle; in production we
 * register the PWA service worker for installability.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Register service worker. ?v=3 forces fresh fetch when we update sw.js (bypasses cache).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js?v=3", { scope: "/" }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
