import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

/** Phone camera/mic: set VITE_DEV_HTTPS=1 — plain http://192.168.x.x is blocked by mobile browsers */
const useHttps = process.env.VITE_DEV_HTTPS === "1";

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true, // Listen on LAN — npm run dev prints http://192.168.x.x:5173 for other devices
    https: useHttps,
    port: 5173,
    strictPort: true, // Fail if port in use instead of trying next
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
      },
    },
  },
});
