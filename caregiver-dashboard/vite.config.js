import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

/** Phone camera/mic: set VITE_DEV_HTTPS=1 — plain http://192.168.x.x is blocked by mobile browsers */
const useHttps = process.env.VITE_DEV_HTTPS === "1";

function isBenignProxySocketErr(err) {
  const c = err?.code;
  if (c === "EPIPE" || c === "ECONNRESET") return true;
  return /EPIPE|ECONNRESET/.test(String(err?.message || ""));
}

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true,
    https: useHttps,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:5001",
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            if (isBenignProxySocketErr(err)) return;
            console.error("[vite] /socket.io proxy error:", err);
          });
          proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
            socket.on("error", (e) => {
              if (isBenignProxySocketErr(e)) return;
              console.error("[vite] /socket.io proxy ws error:", e);
            });
          });
        },
      },
    },
  },
});
