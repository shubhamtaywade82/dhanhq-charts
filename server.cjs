const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const path = require("path");

// Require published @shubhamtaywade82/dhanhq-ts package
const {
  DhanClient,
  getMarketSessionInfo,
  adjustTradingDateRange,
  TechnicalAnalysis,
  analyzeMultiTimeframe,
  greeks,
  impliedVolatility,
} = require("@shubhamtaywade82/dhanhq-ts");

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/feed" });

let client = null;
let clientInitPromise = null;

// In-memory Option Chain cache to prevent Dhan 429 Rate Limit Errors
const optionChainCache = new Map();

async function getDhanClient() {
  if (client) return client;
  if (clientInitPromise) return clientInitPromise;

  clientInitPromise = (async () => {
    try {
      const endpointBaseUrl = process.env.TOKEN_SERVICE_URL || process.env.DHAN_TOKEN_SERVICE_URL;
      const bearerToken = process.env.DHAN_TOKEN_ACCESS_TOKEN || process.env.BEARER_TOKEN;
      const staticToken = process.env.DHAN_TOKEN || process.env.VITE_DHAN_TOKEN;
      const staticClientId = process.env.DHAN_CLIENT_ID || process.env.VITE_DHAN_CLIENT_ID;

      if (endpointBaseUrl && bearerToken && endpointBaseUrl !== "DUMMY" && endpointBaseUrl !== "") {
        let cleanBaseUrl = endpointBaseUrl;
        if (cleanBaseUrl.endsWith("/auth/dhan/token")) {
          cleanBaseUrl = cleanBaseUrl.slice(0, -"/auth/dhan/token".length);
        } else if (cleanBaseUrl.endsWith("/auth/dhan/token/")) {
          cleanBaseUrl = cleanBaseUrl.slice(0, -"/auth/dhan/token/".length);
        }
        console.log(`🔑 Initializing DhanClient via Token Endpoint: ${cleanBaseUrl}`);
        client = await DhanClient.fromTokenEndpoint({
          endpointBaseUrl: cleanBaseUrl,
          bearerToken,
        });
      } else if (staticToken && staticClientId && staticToken !== "DUMMY" && staticToken !== "") {
        console.log("🔑 Initializing DhanClient via static ENV token");
        client = new DhanClient({
          token: staticToken,
          clientId: staticClientId,
        });
      } else {
        console.log("⚠️ No valid credentials found, initializing with DUMMY values");
        client = new DhanClient({
          token: "DUMMY",
          clientId: "DUMMY",
        });
      }
      console.log("✅ DhanClient successfully initialized!");
      return client;
    } catch (err) {
      console.error("⚠️ Failed to initialize DhanClient, falling back to static env credentials:", err.message);
      client = new DhanClient({
        token: process.env.DHAN_TOKEN || process.env.VITE_DHAN_TOKEN || "DUMMY",
        clientId: process.env.DHAN_CLIENT_ID || process.env.VITE_DHAN_CLIENT_ID || "DUMMY",
      });
      return client;
    }
  })();

  return clientInitPromise;
}

// Map popular symbols to security IDs and real market base prices
const SYMBOL_MAP = {
  nifty: { id: "13", segment: "IDX_I", instrument: "INDEX", name: "NIFTY 50", basePrice: 24250.70, prevClose: 24176.65, dayVolume: 355926184 },
  banknifty: { id: "25", segment: "IDX_I", instrument: "INDEX", name: "NIFTY BANK", basePrice: 52100.0, prevClose: 52450.00, dayVolume: 185430200 },
  sensex: { id: "51", segment: "IDX_I", instrument: "INDEX", name: "SENSEX", basePrice: 79800.0, prevClose: 80200.00, dayVolume: 120450900 },
  reliance: { id: "2885", segment: "NSE_EQ", instrument: "EQUITY", name: "RELIANCE", basePrice: 1275.0, prevClose: 1285.40, dayVolume: 12450600 },
  hdfcbank: { id: "1333", segment: "NSE_EQ", instrument: "EQUITY", name: "HDFCBANK", basePrice: 1720.0, prevClose: 1734.20, dayVolume: 18940200 },
  tcs: { id: "11536", segment: "NSE_EQ", instrument: "EQUITY", name: "TCS", basePrice: 2430.0, prevClose: 2452.10, dayVolume: 8450100 },
  infy: { id: "1594", segment: "NSE_EQ", instrument: "EQUITY", name: "INFY", basePrice: 1820.0, prevClose: 1836.80, dayVolume: 9240800 },
};

// Background Spot Price Sync Engine (Polls real Dhan API spot prices every 5s)
async function syncRealDhanSpotPrices() {
  try {
    const c = await getDhanClient();
    for (const key of Object.keys(SYMBOL_MAP)) {
      const config = SYMBOL_MAP[key];
      try {
        const rawChain = await c.optionChain.fetchNormalized({
          underlyingScrip: Number(config.id),
          underlyingSeg: config.segment,
        });
        if (rawChain && rawChain.lastPrice > 0) {
          config.basePrice = rawChain.lastPrice;
        }
      } catch (e) {}
    }
  } catch (err) {}
}

// Start background spot sync timer
setInterval(syncRealDhanSpotPrices, 5000);

// REST API Endpoints

// 1. Session Info (IST time, session state, last active trading day)
app.get("/api/session-info", (req, res) => {
  const session = getMarketSessionInfo();
  res.json({
    status: "success",
    session,
  });
});

// 2. Fund Limits & Available Balance
app.get("/api/funds", async (req, res) => {
  try {
    const c = await getDhanClient();
    const funds = await c.funds.getLimit();
    res.json({ status: "success", data: funds });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 3. Open Positions & Holdings
app.get("/api/positions", async (req, res) => {
  try {
    const c = await getDhanClient();
    const positions = await c.positions.list();
    res.json({ status: "success", data: positions });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 4. Today's Orders
app.get("/api/orders", async (req, res) => {
  try {
    const c = await getDhanClient();
    const orders = await c.orders.list();
    res.json({ status: "success", data: orders });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 5. Ledger Statement
app.get("/api/ledger", async (req, res) => {
  try {
    const c = await getDhanClient();
    const session = getMarketSessionInfo();
    const fromDate = req.query.fromDate || session.lastCompletedTradingDay;
    const toDate = req.query.toDate || session.lastCompletedTradingDay;
    
    const data = await c.statements.ledger({ fromDate, toDate });
    res.json({ status: "success", data });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 6. Intraday Candlestick Chart (with autoAdjustDates default)
app.get("/api/charts/intraday", async (req, res) => {
  try {
    const c = await getDhanClient();
    const symbolKey = (req.query.symbol || "nifty").toString().toLowerCase();
    const interval = (req.query.interval || "15").toString();
    const config = SYMBOL_MAP[symbolKey] || SYMBOL_MAP.nifty;

    const data = await c.charts.intraday({
      securityId: config.id,
      exchangeSegment: config.segment,
      instrument: config.instrument,
      interval,
      autoAdjustDates: true,
    });

    if (!data || !data.close || data.close.length === 0) {
      return res.status(404).json({ error: "No candle data returned for " + config.name });
    }

    const candles = data.close.map((_, i) => ({
      time: data.timestamp ? data.timestamp[i] : Date.now() / 1000,
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      close: data.close[i],
      volume: data.volume ? data.volume[i] : 0,
    }));

    // Update symbol basePrice, prevClose, and total dayVolume from real candle response
    if (candles.length > 0) {
      config.basePrice = candles[candles.length - 1].close;
      config.prevClose = candles[0].open;
      config.dayVolume = candles.reduce((sum, item) => sum + (item.volume || 0), 0);
    }

    res.json({
      symbol: config.name,
      securityId: config.id,
      interval,
      prevClose: config.prevClose,
      dayVolume: config.dayVolume,
      candles,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 6b. Daily Historical Candlestick Chart Endpoint for Lazy Loading Backwards
app.get("/api/charts/historical", async (req, res) => {
  try {
    const c = await getDhanClient();
    const symbolKey = (req.query.symbol || "nifty").toString().toLowerCase();
    const config = SYMBOL_MAP[symbolKey] || SYMBOL_MAP.nifty;
    const session = getMarketSessionInfo();

    const fromDate = (req.query.fromDate || "2024-01-01").toString();
    const toDate = (req.query.toDate || session.lastCompletedTradingDay).toString();

    const data = await c.charts.historical({
      securityId: config.id,
      exchangeSegment: config.segment,
      instrument: config.instrument,
      expiryCode: 0,
      fromDate,
      toDate,
      autoAdjustDates: true,
    });

    if (!data || !data.close || data.close.length === 0) {
      return res.status(404).json({ error: "No historical data returned for " + config.name });
    }

    const candles = data.close.map((_, i) => ({
      time: data.timestamp ? data.timestamp[i] : Date.now() / 1000,
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      close: data.close[i],
      volume: data.volume ? data.volume[i] : 0,
    }));

    res.json({
      symbol: config.name,
      securityId: config.id,
      candles,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 7. Multi-Timeframe Technical Analysis Bias Engine
app.get("/api/analysis/bias", async (req, res) => {
  try {
    const c = await getDhanClient();
    const symbolKey = (req.query.symbol || "nifty").toString().toLowerCase();
    const config = SYMBOL_MAP[symbolKey] || SYMBOL_MAP.nifty;

    const ta = new TechnicalAnalysis(c.charts);
    const indicatorData = await ta.compute({
      securityId: config.id,
      exchangeSegment: config.segment,
      instrument: config.instrument,
      intervals: [5, 15, 60],
    });

    const bias = analyzeMultiTimeframe(indicatorData);
    res.json({ status: "success", data: bias });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 8. Expired Options Historical Rolling Chart Data
app.post("/api/charts/expired-options", async (req, res) => {
  try {
    const c = await getDhanClient();
    const session = getMarketSessionInfo();

    const requestBody = {
      securityId: req.body.securityId || 13,
      exchangeSegment: req.body.exchangeSegment || "NSE_FNO",
      instrument: req.body.instrument || "INDEX",
      expiryFlag: req.body.expiryFlag || "WEEK",
      expiryCode: Number(req.body.expiryCode || 1),
      strike: req.body.strike || "ATM",
      drvOptionType: req.body.drvOptionType || "CALL",
      interval: req.body.interval || "15",
      requiredData: req.body.requiredData || ["open", "high", "low", "close", "volume"],
      fromDate: req.body.fromDate || "2026-07-01",
      toDate: req.body.toDate || session.lastCompletedTradingDay,
      autoAdjustDates: true,
    };

    const response = await c.expiredOptionsData.fetch(requestBody);
    res.json({ status: "success", request: requestBody, data: response });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 9. Option Chain Normalized & Greeks Calculator
app.get("/api/option-chain", async (req, res) => {
  try {
    const c = await getDhanClient();
    const symbolKey = (req.query.symbol || "nifty").toString().toLowerCase();
    const config = SYMBOL_MAP[symbolKey] || SYMBOL_MAP.nifty;
    const requestedExpiry = req.query.expiry ? String(req.query.expiry) : null;

    const cacheKey = `${symbolKey}:${requestedExpiry || "default"}`;
    const cached = optionChainCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < 15000)) {
      return res.json(cached.payload);
    }

    const expiries = await c.optionChain.expiryList({
      underlyingScrip: Number(config.id),
      underlyingSeg: config.segment,
    });

    const selectedExpiry = requestedExpiry || (expiries.data ? expiries.data[0] : "2026-07-30");

    const rawChain = await c.optionChain.fetchNormalized({
      underlyingScrip: Number(config.id),
      underlyingSeg: config.segment,
      expiry: selectedExpiry,
    });

    let strikes = rawChain.strikes || [];
    const spotPrice = rawChain.lastPrice || (strikes.length > 0 ? strikes[Math.floor(strikes.length / 2)].strike : 0);
    
    if (spotPrice > 0) {
      config.basePrice = spotPrice; // Keep basePrice synced with real option chain spot!
    }

    if (spotPrice > 0 && strikes.length > 25) {
      let closestIdx = 0;
      let minDiff = Infinity;
      strikes.forEach((s, idx) => {
        const diff = Math.abs(s.strike - spotPrice);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      const startIdx = Math.max(0, closestIdx - 12);
      const endIdx = Math.min(strikes.length, closestIdx + 13);
      strikes = strikes.slice(startIdx, endIdx);
    }

    const payload = {
      status: "success",
      symbol: config.name,
      spotPrice,
      expiry: selectedExpiry,
      expiries: expiries.data || [],
      chain: {
        lastPrice: spotPrice,
        strikes,
      },
    };

    optionChainCache.set(cacheKey, { timestamp: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 10. Trader Controls (Kill Switch & P&L Exit)
app.get("/api/trader-controls", async (req, res) => {
  try {
    const c = await getDhanClient();
    const killSwitch = await c.traderControls.getKillSwitchStatus();
    const pnlExit = await c.traderControls.getPnlExit();
    res.json({ status: "success", killSwitch, pnlExit });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

app.post("/api/trader-controls/killswitch", async (req, res) => {
  try {
    const c = await getDhanClient();
    const action = req.body.status || "ACTIVATE";
    const result = await c.traderControls.setKillSwitch(action);
    res.json({ status: "success", result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// WebSocket Live Broadcast Engine Clamped Strictly to Real Dhan Spot Prices
wss.on("connection", (ws) => {
  console.log("🔌 React UI WebSocket client connected");

  let activeSymbol = "nifty";
  let activeConfig = SYMBOL_MAP.nifty;

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === "subscribe" && parsed.symbol) {
        const symKey = String(parsed.symbol).toLowerCase();
        if (SYMBOL_MAP[symKey]) {
          activeSymbol = symKey;
          activeConfig = SYMBOL_MAP[symKey];
          ws.simulatedPrice = activeConfig.basePrice;
        }
      }
    } catch (e) {}
  });

  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const base = activeConfig.basePrice || 24250.70;
      const prevClose = activeConfig.prevClose || (base * 0.994);

      const roundedLtp = Number(base.toFixed(2));
      const step = base * 0.0001;

      const dayChange = Number((roundedLtp - prevClose).toFixed(2));
      const dayPChange = Number(((dayChange / prevClose) * 100).toFixed(2));
      const dayVolume = activeConfig.dayVolume || 0;

      const bids = Array.from({ length: 10 }, (_, idx) => {
        const factor = (10 - idx) * 100;
        return {
          price: Number((roundedLtp - (idx + 1) * step).toFixed(2)),
          quantity: factor,
          orders: Math.max(1, Math.floor(factor / 50)),
        };
      });

      const asks = Array.from({ length: 10 }, (_, idx) => {
        const factor = (idx + 1) * 100;
        return {
          price: Number((roundedLtp + (idx + 1) * step).toFixed(2)),
          quantity: factor,
          orders: Math.max(1, Math.floor(factor / 50)),
        };
      });

      ws.send(JSON.stringify({
        type: "tick",
        symbol: activeConfig.name,
        securityId: activeConfig.id,
        ltp: roundedLtp,
        prevClose,
        change: dayChange,
        pChange: dayPChange,
        volume: dayVolume,
        bids,
        asks,
        timestamp: new Date().toISOString(),
      }));
    }
  }, 1000);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("🔌 React UI WebSocket client disconnected");
  });
});

// Serve Vite Static Production Bundle in Production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/ws")) {
    res.sendFile(path.join(distPath, "index.html"));
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Real-Time Market Dashboard Data Engine running at http://localhost:${PORT}`);
  console.log(`📦 Powered by @shubhamtaywade82/dhanhq-ts v0.3.0`);
});
