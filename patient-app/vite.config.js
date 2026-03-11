import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { join } from "path";

export default defineConfig({
  plugins: [
    react(),
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
    },
  },
});
