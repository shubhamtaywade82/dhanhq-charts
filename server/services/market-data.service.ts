import { getMarketSessionInfo } from "@shubhamtaywade82/dhanhq-ts";
import { DhanAuthService } from "./dhan-auth.service";

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
    nifty: { id: "13", segment: "IDX_I", instrument: "INDEX", name: "NIFTY 50", basePrice: 24250.70, prevClose: 24176.65, dayVolume: 355926184 },
    banknifty: { id: "25", segment: "IDX_I", instrument: "INDEX", name: "NIFTY BANK", basePrice: 52100.0, prevClose: 52450.00, dayVolume: 185430200 },
    sensex: { id: "51", segment: "IDX_I", instrument: "INDEX", name: "SENSEX", basePrice: 79800.0, prevClose: 80200.00, dayVolume: 120450900 },
    reliance: { id: "2885", segment: "NSE_EQ", instrument: "EQUITY", name: "RELIANCE", basePrice: 1275.0, prevClose: 1285.40, dayVolume: 12450600 },
    hdfcbank: { id: "1333", segment: "NSE_EQ", instrument: "EQUITY", name: "HDFCBANK", basePrice: 1720.0, prevClose: 1734.20, dayVolume: 18940200 },
    tcs: { id: "11536", segment: "NSE_EQ", instrument: "EQUITY", name: "TCS", basePrice: 2430.0, prevClose: 2452.10, dayVolume: 8450100 },
    infy: { id: "1594", segment: "NSE_EQ", instrument: "EQUITY", name: "INFY", basePrice: 1820.0, prevClose: 1836.80, dayVolume: 9240800 },
  };

  public static getSymbolConfig(symbolKey: string): SymbolConfig {
    const key = (symbolKey || "nifty").toLowerCase();
    return this.SYMBOL_MAP[key] || this.SYMBOL_MAP.nifty;
  }

  public static async syncRealDhanSpotPrices(): Promise<void> {
    try {
      const client = await DhanAuthService.getDhanClient();
      for (const key of Object.keys(this.SYMBOL_MAP)) {
        const config = this.SYMBOL_MAP[key];
        try {
          const rawChain = await client.optionChain.fetchNormalized({
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

  public static async fetchIntradayCandles(symbolKey: string, intervalStr: string): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    const config = this.getSymbolConfig(symbolKey);

    const data = await client.charts.intraday({
      securityId: config.id,
      exchangeSegment: config.segment,
      instrument: config.instrument,
      interval: intervalStr || "15",
      autoAdjustDates: true,
    });

    if (!data || !data.close || data.close.length === 0) {
      throw new Error(`No candle data returned for ${config.name}`);
    }

    const candles = data.close.map((_: any, i: number) => ({
      time: data.timestamp ? data.timestamp[i] : Math.floor(Date.now() / 1000),
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      close: data.close[i],
      volume: data.volume ? data.volume[i] : 0,
    }));

    if (candles.length > 0) {
      config.basePrice = candles[candles.length - 1].close;
      config.prevClose = candles[0].open;
      config.dayVolume = candles.reduce((sum: number, item: any) => sum + (item.volume || 0), 0);
    }

    return {
      symbol: config.name,
      securityId: config.id,
      interval: intervalStr || "15",
      prevClose: config.prevClose,
      dayVolume: config.dayVolume,
      candles,
    };
  }

  public static async fetchHistoricalCandles(symbolKey: string, fromDateStr?: string, toDateStr?: string): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    const config = this.getSymbolConfig(symbolKey);
    const session = getMarketSessionInfo();

    const fromDate = fromDateStr || "2024-01-01";
    const toDate = toDateStr || session.lastCompletedTradingDay;

    const data = await client.charts.historical({
      securityId: config.id,
      exchangeSegment: config.segment,
      instrument: config.instrument,
      expiryCode: 0,
      fromDate,
      toDate,
      autoAdjustDates: true,
    });

    if (!data || !data.close || data.close.length === 0) {
      throw new Error(`No historical data returned for ${config.name}`);
    }

    const candles = data.close.map((_: any, i: number) => ({
      time: data.timestamp ? data.timestamp[i] : Math.floor(Date.now() / 1000),
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      close: data.close[i],
      volume: data.volume ? data.volume[i] : 0,
    }));

    return {
      symbol: config.name,
      securityId: config.id,
      candles,
    };
  }
}
