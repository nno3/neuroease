import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { readFileSync } from "fs";
import { join } from "path";

const useHttps = process.env.VITE_DEV_HTTPS === "1";

function isBenignProxySocketErr(err) {
  const c = err?.code;
  if (c === "EPIPE" || c === "ECONNRESET") return true;
  return /EPIPE|ECONNRESET/.test(String(err?.message || ""));
}

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    {
      name: "manifest-mime",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/manifest.webmanifest" || req.url?.startsWith("/manifest.webmanifest?")) {
            try {
              const dir = join(process.cwd(), "public");
              const body = readFileSync(join(dir, "manifest.webmanifest"), "utf-8");
              res.setHeader("Content-Type", "application/manifest+json");
              res.end(body);
              return;
            } catch (_) {}
          }
          next();
        });
      },
    },
  ],
  server: {
    https: useHttps,
    port: 5175,
    strictPort: true, // Fail if port in use instead of trying next
    host: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
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
