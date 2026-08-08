import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const backendPort =
  process.env.BACKEND_PORT ||
  (() => {
    try {
      return fs.readFileSync(path.join(root, ".backend-port"), "utf8").trim();
    } catch {
      return "3001";
    }
  })();

const backendTarget = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
});
