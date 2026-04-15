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
import { applyAccessibilityToDocument } from "./utils/accessibilityPrefs";

applyAccessibilityToDocument();

// PWA: register SW only in production. In dev, unregister so we don't intercept Vite HMR,
// Socket.IO (other origin), or fail closed when the API is down (FetchEvent / Failed to fetch).
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js?v=3", { scope: "/" }).catch(() => {});
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister();
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
