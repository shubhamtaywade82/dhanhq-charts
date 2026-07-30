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
  public static SYMBOL_MAP: Record<string, SymbolConfig> = {
    nifty: { id: "13", segment: "IDX_I", instrument: "INDEX", name: "NIFTY 50", basePrice: 24255.10, prevClose: 24176.65, dayVolume: 355926184 },
    banknifty: { id: "25", segment: "IDX_I", instrument: "INDEX", name: "NIFTY BANK", basePrice: 56891.95, prevClose: 56950.00, dayVolume: 185430200 },
    sensex: { id: "51", segment: "IDX_I", instrument: "INDEX", name: "SENSEX", basePrice: 77652.95, prevClose: 77800.00, dayVolume: 120450900 },
    reliance: { id: "2885", segment: "NSE_EQ", instrument: "EQUITY", name: "RELIANCE", basePrice: 1285.50, prevClose: 1285.40, dayVolume: 12450600 },
    hdfcbank: { id: "1333", segment: "NSE_EQ", instrument: "EQUITY", name: "HDFCBANK", basePrice: 750.50, prevClose: 754.20, dayVolume: 18940200 },
    tcs: { id: "11536", segment: "NSE_EQ", instrument: "EQUITY", name: "TCS", basePrice: 4250.00, prevClose: 4252.10, dayVolume: 8450100 },
    infy: { id: "1594", segment: "NSE_EQ", instrument: "EQUITY", name: "INFY", basePrice: 1850.00, prevClose: 1836.80, dayVolume: 9240800 },
  };

  public static getSymbolConfig(symbolKey: string): SymbolConfig {
    const key = (symbolKey || "nifty").toLowerCase();
    return this.SYMBOL_MAP[key] || this.SYMBOL_MAP.nifty;
  }

  /**
   * Synchronize real-time spot prices directly from DhanHQ live REST API
   * using DhanRateLimiter with paced request intervals to prevent HTTP 429 errors.
   */
  public static async syncRealDhanSpotPrices(): Promise<void> {
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
    }
  }

  public static async fetchIntradayCandles(symbolKey: string, intervalStr: string): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    const config = this.getSymbolConfig(symbolKey);

    try {
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
}
