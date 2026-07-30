import express, { Router, Request, Response } from "express";
import { getMarketSessionInfo } from "@shubhamtaywade82/dhanhq-ts";
import { MarketDataService } from "./services/market-data.service";
import { OptionChainService } from "./services/option-chain.service";
import { OptionsAnalyticsService } from "./services/options-analytics.service";
import { OptionsBacktestService } from "./services/options-backtest.service";
import { SnapshotCacheService } from "./services/snapshot-cache.service";
import { OrderExecutionService } from "./services/order-execution.service";
import { RiskManagementService } from "./services/risk-management.service";
import { TechnicalAnalysisService } from "./services/technical-analysis.service";

export const router = Router();
router.use(express.json({ limit: "50mb" }));
router.use(express.urlencoded({ limit: "50mb", extended: true }));

// 1. Session Info
router.get("/session-info", (req: Request, res: Response) => {
  const session = getMarketSessionInfo();
  res.json({ status: "success", session });
});

// 2. Fund Limits & Balance
router.get("/funds", async (req: Request, res: Response) => {
  try {
    const data = await OrderExecutionService.getFunds();
    res.json({ status: "success", data });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 3. Open Positions
router.get("/positions", async (req: Request, res: Response) => {
  try {
    const data = await OrderExecutionService.listPositions();
    res.json({ status: "success", data });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 4. Today's Orders
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const data = await OrderExecutionService.listOrders();
    res.json({ status: "success", data });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 4b. Execute Multi-Leg Spread Strategy
router.post("/orders/strategy-spread", async (req: Request, res: Response) => {
  try {
    const { buyLeg, sellLeg } = req.body;
    if (!buyLeg || !sellLeg) {
      return res.status(400).json({ error: "Both buyLeg and sellLeg are required for spread execution." });
    }
    const result = await OrderExecutionService.executeSpreadStrategy(buyLeg, sellLeg);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Ledger Statement
router.get("/ledger", async (req: Request, res: Response) => {
  try {
    const session = getMarketSessionInfo();
    const fromDate = (req.query.fromDate || session.lastCompletedTradingDay) as string;
    const toDate = (req.query.toDate || session.lastCompletedTradingDay) as string;
    const data = await OrderExecutionService.getLedger(fromDate, toDate);
    res.json({ status: "success", data });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 6. Intraday Candlestick Chart
router.get("/charts/intraday", async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol || "nifty").toString();
    const interval = (req.query.interval || "15").toString();
    const data = await MarketDataService.fetchIntradayCandles(symbol, interval);
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 6b. Historical Intraday Candlestick Chart (same interval as active chart, max 90-day window)
router.get("/charts/historical", async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol || "nifty").toString();
    const fromDate = req.query.fromDate ? req.query.fromDate.toString() : undefined;
    const toDate = req.query.toDate ? req.query.toDate.toString() : undefined;
    const interval = (req.query.interval || "15").toString();
    const data = await MarketDataService.fetchHistoricalCandles(symbol, fromDate, toDate, interval);
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 7. Multi-Timeframe Technical Analysis Bias Engine
router.get("/analysis/bias", async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol || "nifty").toString();
    const data = await TechnicalAnalysisService.computeMultiTimeframeBias(symbol);
    res.json({ status: "success", data });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 8. Expired Options Historical Data
router.post("/charts/expired-options", async (req: Request, res: Response) => {
  try {
    const result = await OptionChainService.fetchExpiredOptions(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

router.post("/charts/expired-options-session", async (req: Request, res: Response) => {
  try {
    const snapshot = await SnapshotCacheService.getOrFetchSnapshot(req.body);
    res.json(snapshot);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

router.post("/analytics/expired-options", async (req: Request, res: Response) => {
  try {
    let snapshot = req.body.snapshot;
    if (!snapshot && (req.body.fromDate || req.body.symbol)) {
      snapshot = await SnapshotCacheService.getOrFetchSnapshot(req.body);
    }
    const analytics = OptionsAnalyticsService.analyzeSession(snapshot);
    res.json({ status: "success", data: analytics });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

router.post("/backtest/expired-options", async (req: Request, res: Response) => {
  try {
    let snapshot = req.body.snapshot;
    if (!snapshot && (req.body.fromDate || req.body.symbol)) {
      snapshot = await SnapshotCacheService.getOrFetchSnapshot(req.body);
    }
    const result = OptionsBacktestService.runBacktest(snapshot, req.body.config);
    res.json({ status: "success", data: result });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// Multi-Session Dataset Cache & Backtesting Endpoints
router.get("/cache/sessions", (req: Request, res: Response) => {
  try {
    const sessions = SnapshotCacheService.listCachedSessions();
    res.json({ status: "success", count: sessions.length, data: sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cache/get-session", async (req: Request, res: Response) => {
  try {
    const snapshot = await SnapshotCacheService.getOrFetchSnapshot(req.body);
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/backtest/multi-session", async (req: Request, res: Response) => {
  try {
    const result = await SnapshotCacheService.runMultiSessionBacktest(req.body);
    res.json({ status: "success", data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Option Chain & Greeks
router.get("/option-chain", async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol || "nifty").toString();
    const expiry = req.query.expiry ? String(req.query.expiry) : undefined;
    const payload = await OptionChainService.fetchOptionChain(symbol, expiry);
    res.json(payload);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

// 10. Trader Controls (Kill Switch & P&L Exit)
router.get("/trader-controls", async (req: Request, res: Response) => {
  try {
    const status = await RiskManagementService.getTraderControlsStatus();
    res.json({ status: "success", ...status });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});

router.post("/trader-controls/killswitch", async (req: Request, res: Response) => {
  try {
    const action = req.body.status === "DEACTIVATE" ? "DEACTIVATE" : "ACTIVATE";
    const result = await RiskManagementService.setKillSwitchStatus(action);
    res.json({ status: "success", result });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});
