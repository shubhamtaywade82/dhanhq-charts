import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import net from "net";
import fs from "fs";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes";
import { MarketDataService } from "./services/market-data.service";
import { WebSocketFeedService } from "./services/websocket-feed.service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

process.on("uncaughtException", (err) => {
  console.warn("⚠️ Uncaught exception notice:", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  console.warn("⚠️ Unhandled promise rejection notice:", reason);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/feed" });

// Attach REST API Router
app.use("/api", router);

// Attach WebSocket Feed Service
WebSocketFeedService.attach(wss);

// Background Spot Price Sync Engine (Syncs on startup and polls real Dhan API spot prices every 5s)
MarketDataService.syncRealDhanSpotPrices();
setInterval(() => {
  MarketDataService.syncRealDhanSpotPrices();
}, 5000);

// Serve Vite Static Production Bundle in Production Mode
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/ws")) {
    res.sendFile(path.join(distPath, "index.html"));
  }
});

const PROJECT_ROOT = path.join(__dirname, "..");

async function findFreePort(start: number, maxTries = 20): Promise<number> {
  for (let port = start; port < start + maxTries; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tester = net.createServer();
        tester.once("error", reject);
        tester.listen(port, () => tester.close(() => resolve()));
      });
      return port;
    } catch {}
  }
  throw new Error(`No free port found in range ${start}-${start + maxTries}`);
}

const PORT = await findFreePort(Number(process.env.PORT) || 3001);
fs.writeFileSync(path.join(PROJECT_ROOT, ".backend-port"), String(PORT));

server.listen(PORT, () => {
  console.log(`🚀 Dedicated DhanHQ Options Trading Backend Server running at http://localhost:${PORT}`);
  console.log(`📦 Powered by @shubhamtaywade82/dhanhq-ts v0.3.0`);
});
