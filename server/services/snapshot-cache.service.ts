import fs from "fs";
import path from "path";
import { OptionChainService } from "./option-chain.service";
import { OptionsBacktestService, BacktestParams } from "./options-backtest.service";
import { OptionsAnalyticsService } from "./options-analytics.service";

const SNAPSHOTS_DIR = path.resolve(process.cwd(), "server/data/historical_snapshots");

export class SnapshotCacheService {
  /**
   * Ensure storage directory exists
   */
  private static ensureStorageDir() {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
  }

  /**
   * Get cached snapshot filename
   */
  private static getFilePath(symbol: string, date: string): string {
    const cleanSymbol = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    return path.join(SNAPSHOTS_DIR, `${cleanSymbol}_${date}.json`);
  }

  /**
   * List all locally cached historical session snapshots
   */
  public static listCachedSessions(): any[] {
    this.ensureStorageDir();
    const files = fs.readdirSync(SNAPSHOTS_DIR);
    const sessions: any[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const filePath = path.join(SNAPSHOTS_DIR, file);
          const raw = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(raw);
          if (data && data.metadata) {
            sessions.push({
              file,
              symbol: data.metadata.symbol,
              tradingDate: data.metadata.tradingDate,
              underlyingSpotPrice: data.metadata.underlyingSpotPrice,
              atmStrike: data.metadata.atmStrike,
              strikesCount: Object.keys(data.strikes || {}).length,
              generatedAt: data.metadata.generatedAt,
            });
          }
        } catch (err: any) {
          console.warn("Could not parse snapshot file:", file);
        }
      }
    }

    return sessions.sort((a, b) => b.tradingDate.localeCompare(a.tradingDate));
  }

  /**
   * Fetch snapshot from cache or fetch from API and cache locally
   */
  public static async getOrFetchSnapshot(params: any): Promise<any> {
    this.ensureStorageDir();
    const symbol = String(params.symbol || "NIFTY").toUpperCase();
    const date = params.fromDate || "2026-07-28";
    const filePath = this.getFilePath(symbol, date);

    if (fs.existsSync(filePath)) {
      console.log(`⚡ [Cache Hit] Loading historical snapshot from disk: ${filePath}`);
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }

    console.log(`🌐 [Cache Miss] Fetching session snapshot from API for ${symbol} on ${date}...`);
    const snapshot = await OptionChainService.fetchFullSessionSnapshot(params);

    if (snapshot && snapshot.status === "success" && snapshot.strikes) {
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
      console.log(`💾 Saved historical snapshot to cache: ${filePath}`);
    }

    return snapshot;
  }

  /**
   * Save a snapshot directly into the cache
   */
  public static saveSnapshotToCache(snapshot: any): void {
    this.ensureStorageDir();
    if (!snapshot || !snapshot.metadata) return;
    const { symbol, tradingDate } = snapshot.metadata;
    const filePath = this.getFilePath(symbol, tradingDate);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`💾 Saved session snapshot to ${filePath}`);
  }

  /**
   * Run quantitative backtest across multiple expiries / historical sessions
   */
  public static async runMultiSessionBacktest(params: {
    symbol: string;
    config: BacktestParams;
    dates?: string[];
  }): Promise<any> {
    this.ensureStorageDir();
    const symbol = params.symbol.toUpperCase();
    const cached = this.listCachedSessions().filter((s) => s.symbol === symbol);

    // Seed snapshot files if cache is empty
    if (cached.length === 0) {
      // Auto-save initial snapshot if available
      const sampleSnap = await this.getOrFetchSnapshot({ symbol, fromDate: "2026-07-28" });
      this.saveSnapshotToCache(sampleSnap);
    }

    const availableSessions = this.listCachedSessions().filter((s) => s.symbol === symbol);
    const targetDates = params.dates && params.dates.length > 0
      ? params.dates
      : availableSessions.map((s) => s.tradingDate);

    const sessionResults: any[] = [];
    let combinedTrades: any[] = [];
    let totalNetPnl = 0;
    let totalWins = 0;
    let totalLosses = 0;

    for (const date of targetDates) {
      const snap = await this.getOrFetchSnapshot({ symbol, fromDate: date });
      if (snap && snap.strikes) {
        const bt = OptionsBacktestService.runBacktest(snap, params.config);
        const summary = bt.summary;

        sessionResults.push({
          date,
          spotPrice: snap.metadata?.underlyingSpotPrice || 0,
          atmStrike: snap.metadata?.atmStrike || 0,
          totalTrades: summary.totalTrades,
          winners: summary.winners,
          losers: summary.losers,
          winRatePct: summary.winRatePct,
          profitFactor: summary.profitFactor,
          netPnl: summary.netPnl,
          maxDrawdownPct: summary.maxDrawdownPct,
          avgMaePct: summary.avgMaePct,
          avgMfePct: summary.avgMfePct,
        });

        totalNetPnl += summary.netPnl;
        totalWins += summary.winners;
        totalLosses += summary.losers;

        if (bt.trades) {
          combinedTrades = combinedTrades.concat(
            bt.trades.map((t: any) => ({ ...t, sessionDate: date }))
          );
        }
      }
    }

    const totalTrades = totalWins + totalLosses;
    const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    return {
      symbol,
      sessionsEvaluatedCount: sessionResults.length,
      totalNetPnl: Number(totalNetPnl.toFixed(2)),
      overallWinRatePct: Number(overallWinRate.toFixed(1)),
      totalTradesCount: totalTrades,
      sessionResults,
      combinedTrades,
    };
  }
}
