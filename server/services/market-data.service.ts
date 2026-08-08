import { DhanAuthService } from "./dhan-auth.service";
import { DhanRateLimiter } from "./dhan-rate-limiter.service";
import { SnapshotCacheService } from "./snapshot-cache.service";

export interface SymbolConfig {
  id: string;
  segment: string;
  instrument: string;
  name: string;
  basePrice: number;
  prevClose: number;
  dayVolume: number;
}

export class MarketDataService {
  private static isSyncing = false;

  /** Seed values are zeros — real prices arrive from the 5s Dhan intraday sync / live market feed. */
  public static SYMBOL_MAP: Record<string, SymbolConfig> = {
    nifty: { id: "13", segment: "IDX_I", instrument: "INDEX", name: "NIFTY 50", basePrice: 0, prevClose: 0, dayVolume: 0 },
    banknifty: { id: "25", segment: "IDX_I", instrument: "INDEX", name: "NIFTY BANK", basePrice: 0, prevClose: 0, dayVolume: 0 },
    sensex: { id: "51", segment: "IDX_I", instrument: "INDEX", name: "SENSEX", basePrice: 0, prevClose: 0, dayVolume: 0 },
    reliance: { id: "2885", segment: "NSE_EQ", instrument: "EQUITY", name: "RELIANCE", basePrice: 0, prevClose: 0, dayVolume: 0 },
    hdfcbank: { id: "1333", segment: "NSE_EQ", instrument: "EQUITY", name: "HDFCBANK", basePrice: 0, prevClose: 0, dayVolume: 0 },
    tcs: { id: "11536", segment: "NSE_EQ", instrument: "EQUITY", name: "TCS", basePrice: 0, prevClose: 0, dayVolume: 0 },
    infy: { id: "1594", segment: "NSE_EQ", instrument: "EQUITY", name: "INFY", basePrice: 0, prevClose: 0, dayVolume: 0 },
  };

  public static getSymbolConfig(symbolKey: string): SymbolConfig {
    const key = (symbolKey || "nifty").toLowerCase();
    return this.SYMBOL_MAP[key] || this.SYMBOL_MAP.nifty;
  }

  public static getSymbolConfigById(securityId: string): SymbolConfig | undefined {
    return Object.values(this.SYMBOL_MAP).find((c) => c.id === String(securityId));
  }

  /**
   * Synchronize real-time spot prices directly from DhanHQ live REST API
   * using DhanRateLimiter with paced request intervals to prevent HTTP 429 errors.
   */
  public static async syncRealDhanSpotPrices(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const client = await DhanAuthService.getDhanClient();
      // Primary active indices to sync continuously
      const primaryKeys = ["nifty", "banknifty", "sensex"];

      for (const key of primaryKeys) {
        const config = this.SYMBOL_MAP[key];
        try {
          // Fetch exact 1m live market candles from DhanHQ intraday chart endpoint
          const res: any = await DhanRateLimiter.execute(() =>
            client.charts.intraday({
              securityId: config.id,
              exchangeSegment: config.segment,
              instrument: config.instrument,
              interval: "1",
              autoAdjustDates: true,
            })
          );

          if (res && (res.close || res.c) && (res.close?.length > 0 || res.c?.length > 0)) {
            const closes = res.close || res.c || [];
            const opens = res.open || res.o || [];
            const volumes = res.volume || res.v || [];

            const livePrice = closes[closes.length - 1];
            if (livePrice && livePrice > 0) {
              config.basePrice = Number(livePrice.toFixed(2));
              if (opens.length > 0 && opens[0] > 0) {
                config.prevClose = Number(opens[0].toFixed(2));
              }
              if (volumes.length > 0) {
                config.dayVolume = volumes.reduce((a: number, b: number) => a + b, 0);
              }
              console.log(`✅ [DhanHQ Spot Sync] ${config.name} (${config.id}) -> ₹${config.basePrice}`);
            }
          }
        } catch (e: any) {
          console.warn(`⚠️ Spot sync notice for ${config.name}:`, e.message);
        }
      }
    } catch (err: any) {
      console.warn("⚠️ Spot sync error:", err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  public static async fetchIntradayCandles(symbolKey: string, intervalStr: string): Promise<any> {
    const config = this.getSymbolConfig(symbolKey);

    try {
      const client = await DhanAuthService.getDhanClient();
      const data: any = await DhanRateLimiter.execute(() =>
        client.charts.intraday({
          securityId: config.id,
          exchangeSegment: config.segment,
          instrument: config.instrument,
          interval: intervalStr || "1",
          autoAdjustDates: true,
        })
      );

      if (data && (data.close || data.c) && (data.close?.length > 0 || data.c?.length > 0)) {
        const closeArray = data.close || data.c;
        const timeArray = data.start_Time || data.timestamp || [];

        // Synchronize real base price from exact latest intraday candle
        const latestPrice = closeArray[closeArray.length - 1];
        if (latestPrice > 0) {
          config.basePrice = Number(latestPrice.toFixed(2));
        }

        const candles = closeArray.map((c: number, idx: number) => ({
          time: timeArray[idx] || Math.floor(Date.now() / 1000) - (closeArray.length - idx) * 60,
          open: (data.open || data.o)?.[idx] || c,
          high: (data.high || data.h)?.[idx] || c,
          low: (data.low || data.l)?.[idx] || c,
          close: c,
          volume: (data.volume || data.v)?.[idx] || 1000,
        }));

        return { symbol: config.name, securityId: config.id, candles, isMock: false };
      }
    } catch (err: any) {
      console.warn(`⚠️ Intraday API notice for ${config.name}:`, err.message);
    }

    // Fallback: Read real historical spot series from local snapshot cache
    try {
      const cached = SnapshotCacheService.listCachedSessions().find(s => s.symbol.toLowerCase() === symbolKey.toLowerCase());
      if (cached) {
        const snap = await SnapshotCacheService.getOrFetchSnapshot({ symbol: cached.symbol, fromDate: cached.tradingDate });
        if (snap && snap.underlying && snap.underlying.spot && snap.underlying.spot.length > 0) {
          const timestamps = snap.underlying.timestamp || [];
          const spot = snap.underlying.spot || [];
          config.basePrice = spot[spot.length - 1] || config.basePrice;

          const candles = spot.map((price: number, idx: number) => ({
            time: timestamps[idx] || Math.floor(Date.now() / 1000) - (spot.length - idx) * 60,
            open: (snap.underlying.open || spot)[idx] || price,
            high: (snap.underlying.high || spot)[idx] || price,
            low: (snap.underlying.low || spot)[idx] || price,
            close: price,
            volume: (snap.underlying.volume || [])[idx] || 5000,
          }));

          return { symbol: config.name, securityId: config.id, candles, isMock: false };
        }
      }
    } catch (e) {}

    // Emergency Fallback Candles
    const candles = Array.from({ length: 25 }, (_, i) => {
      const time = Math.floor(Date.now() / 1000) - (25 - i) * 60;
      return {
        time,
        open: config.basePrice - 10 + i * 0.5,
        high: config.basePrice + 15 + i * 0.5,
        low: config.basePrice - 15 + i * 0.5,
        close: config.basePrice + i * 0.5,
        volume: 10000 + i * 500,
      };
    });

    return { symbol: config.name, securityId: config.id, candles, isMock: true };
  }

  /**
   * Fetch intraday OHLCV candles at the given interval for a past date range.
   * Used when the user scrolls left on the chart — keeps candle granularity
   * consistent with the active timeframe (1m, 5m, 15m, etc.).
   * DhanHQ intraday endpoint max window = 90 days.
   */
  public static async fetchHistoricalCandles(symbolKey: string, fromDate?: string, toDate?: string, interval: string = "15"): Promise<any> {
    const config = this.getSymbolConfig(symbolKey);

    // Clamp window to max 90 days (DhanHQ intraday limit)
    const toObj = toDate ? new Date(toDate) : new Date();
    const fromObj = fromDate ? new Date(fromDate) : (() => {
      const d = new Date(toObj);
      d.setDate(d.getDate() - 90);
      return d;
    })();

    // Never exceed 90-day window
    const maxFrom = new Date(toObj);
    maxFrom.setDate(maxFrom.getDate() - 90);
    if (fromObj < maxFrom) fromObj.setTime(maxFrom.getTime());

    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const from = fmt(fromObj);
    const to = fmt(toObj);

    try {
      const client = await DhanAuthService.getDhanClient();
      const data: any = await DhanRateLimiter.execute(() =>
        client.charts.intraday({
          securityId: config.id,
          exchangeSegment: config.segment as any,
          instrument: config.instrument as any,
          interval: (interval || "15") as any,
          fromDate: from,
          toDate: to,
        })
      );

      if (data && (data.close || data.c) && (data.close?.length > 0 || data.c?.length > 0)) {
        const closeArray = data.close || data.c;
        const timeArray = data.start_Time || data.timestamp || [];
        const openArray = data.open || data.o || [];
        const highArray = data.high || data.h || [];
        const lowArray = data.low || data.l || [];
        const volArray = data.volume || data.v || [];

        const intervalSec = interval.endsWith("s")
          ? parseInt(interval, 10)
          : (parseInt(interval, 10) || 15) * 60;

        const candles = closeArray.map((c: number, idx: number) => ({
          time: timeArray[idx] || Math.floor(fromObj.getTime() / 1000) + idx * intervalSec,
          open: openArray[idx] || c,
          high: highArray[idx] || c,
          low: lowArray[idx] || c,
          close: c,
          volume: volArray[idx] || 1000,
        }));

        console.log(`✅ [Historical Intraday] Fetched ${candles.length} ${interval}m candles for ${config.name} (${from} → ${to})`);
        return { symbol: config.name, securityId: config.id, candles, isMock: false };
      }
    } catch (err: any) {
      console.warn(`⚠️ Historical intraday API notice for ${config.name}:`, err.message);
    }

    // Fallback: generate synthetic intraday candles for the window
    const intervalSec = interval.endsWith("s")
      ? parseInt(interval, 10)
      : (parseInt(interval, 10) || 15) * 60;
    const totalBars = Math.floor((toObj.getTime() - fromObj.getTime()) / 1000 / intervalSec);
    const baseTime = Math.floor(fromObj.getTime() / 1000);
    const fallbackCandles = Array.from({ length: Math.min(totalBars, 500) }, (_, i) => {
      const time = baseTime + i * intervalSec;
      const drift = (i - totalBars / 2) * 0.1;
      return {
        time,
        open: config.basePrice + drift - 5,
        high: config.basePrice + drift + 8,
        low: config.basePrice + drift - 8,
        close: config.basePrice + drift,
        volume: 5000 + Math.floor(Math.random() * 5000),
      };
    });

    return { symbol: config.name, securityId: config.id, candles: fallbackCandles, isMock: true };
  }
}
