import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
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

// Background Spot Price Sync Engine (Syncs on startup and polls real Dhan API spot prices every 2s)
MarketDataService.syncRealDhanSpotPrices();
setInterval(() => {
  MarketDataService.syncRealDhanSpotPrices();
}, 100);

// Serve Vite Static Production Bundle in Production Mode
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/ws")) {
    res.sendFile(path.join(distPath, "index.html"));
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Dedicated DhanHQ Options Trading Backend Server running at http://localhost:${PORT}`);
  console.log(`📦 Powered by @shubhamtaywade82/dhanhq-ts v0.3.0`);
});
