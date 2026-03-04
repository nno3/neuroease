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

// Register service worker immediately so it's ready for push in both Safari tab and PWA (home screen/dock).
// Explicit scope "/" ensures the SW controls the full app in both contexts.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
