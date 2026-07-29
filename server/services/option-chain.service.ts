import { getMarketSessionInfo } from "@shubhamtaywade82/dhanhq-ts";
import { DhanAuthService } from "./dhan-auth.service";
import { MarketDataService } from "./market-data.service";

export class OptionChainService {
  private static optionChainCache = new Map<string, { timestamp: number; payload: any }>();

  public static async fetchOptionChain(symbolKey: string, requestedExpiry?: string | null): Promise<any> {
    const config = MarketDataService.getSymbolConfig(symbolKey);
    const cacheKey = `${symbolKey.toLowerCase()}:${requestedExpiry || "default"}`;
    const cached = this.optionChainCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 15000) {
      return cached.payload;
    }

    const client = await DhanAuthService.getDhanClient();

    const expiries = await client.optionChain.expiryList({
      underlyingScrip: Number(config.id),
      underlyingSeg: config.segment,
    });

    const selectedExpiry = requestedExpiry || (expiries.data ? expiries.data[0] : "2026-07-30");

    const rawChain = await client.optionChain.fetchNormalized({
      underlyingScrip: Number(config.id),
      underlyingSeg: config.segment,
      expiry: selectedExpiry,
    });

    let strikes = rawChain.strikes || [];
    const spotPrice = rawChain.lastPrice || (strikes.length > 0 ? strikes[Math.floor(strikes.length / 2)].strike : 0);

    if (spotPrice > 0) {
      config.basePrice = spotPrice;
    }

    if (spotPrice > 0 && strikes.length > 25) {
      let closestIdx = 0;
      let minDiff = Infinity;
      strikes.forEach((s: any, idx: number) => {
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

    this.optionChainCache.set(cacheKey, { timestamp: Date.now(), payload });
    return payload;
  }

  public static async fetchExpiredOptions(requestData: any): Promise<any> {
    const session = getMarketSessionInfo();

    let instrument = requestData.instrument || "OPTIDX";
    if (instrument === "INDEX") instrument = "OPTIDX";
    if (instrument === "EQUITY") instrument = "OPTSTK";

    const requestBody = {
      securityId: String(requestData.securityId || "13"),
      exchangeSegment: requestData.exchangeSegment || "NSE_FNO",
      instrument,
      expiryFlag: requestData.expiryFlag || "WEEK",
      expiryCode: Number(requestData.expiryCode || 1),
      strike: requestData.strike || "ATM",
      drvOptionType: requestData.drvOptionType || "CALL",
      interval: String(requestData.interval || "15"),
      requiredData: ["open", "high", "low", "close", "volume"],
      fromDate: requestData.fromDate || "2026-07-01",
      toDate: requestData.toDate || session.lastCompletedTradingDay,
      autoAdjustDates: true,
    };

    try {
      const client = await DhanAuthService.getDhanClient();
      const response = await client.expiredOptionsData.fetch(requestBody);

      // Verify if response contains real candle points
      const hasPoints =
        response &&
        ((response.data?.ce?.close && Array.isArray(response.data.ce.close) && response.data.ce.close.length > 0) ||
          (response.data?.pe?.close && Array.isArray(response.data.pe.close) && response.data.pe.close.length > 0) ||
          (response.ce?.close && Array.isArray(response.ce.close) && response.ce.close.length > 0) ||
          (response.pe?.close && Array.isArray(response.pe.close) && response.pe.close.length > 0) ||
          (response.data?.close && Array.isArray(response.data.close) && response.data.close.length > 0) ||
          (response.close && Array.isArray(response.close) && response.close.length > 0) ||
          (Array.isArray(response.data) && response.data.length > 0) ||
          (Array.isArray(response) && response.length > 0));

      if (hasPoints) {
        return { status: "success", request: requestBody, data: response };
      }
    } catch (err: any) {
      console.warn("⚠️ Expired options API fetch notice:", err.message);
    }

    // Fallback: Generate mock intraday expired option candles if Dhan API is offline or returns empty points
    const fallbackData = this.generateMockExpiredCandles(
      requestBody.fromDate,
      requestBody.toDate,
      requestBody.interval,
      requestBody.strike,
      requestBody.drvOptionType
    );

    return { status: "success", request: requestBody, data: fallbackData, isMock: true };
  }

  private static generateMockExpiredCandles(
    fromDateStr: string,
    toDateStr: string,
    intervalStr: string,
    strikeStr: string,
    optionType: string
  ) {
    const intervalMinutes = Math.max(1, parseInt(intervalStr, 10) || 15);
    const start = new Date(fromDateStr);
    const end = new Date(toDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const now = new Date();
      start.setTime(now.getTime() - 14 * 86400 * 1000);
      end.setTime(now.getTime());
    }

    let basePrice = optionType === "CALL" ? 180 : 160;
    if (strikeStr.includes("+")) basePrice *= 0.7;
    if (strikeStr.includes("-")) basePrice *= 1.4;

    const startTimes: number[] = [];
    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const closes: number[] = [];
    const volumes: number[] = [];

    let currentPrice = basePrice;
    let curr = new Date(start);
    curr.setHours(9, 15, 0, 0);

    const stepMs = intervalMinutes * 60 * 1000;

    while (curr.getTime() <= end.getTime() + 24 * 3600 * 1000) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
        const dayStart = new Date(curr);
        dayStart.setHours(9, 15, 0, 0);
        const dayEnd = new Date(curr);
        dayEnd.setHours(15, 30, 0, 0);

        let candleTime = dayStart.getTime();
        while (candleTime <= dayEnd.getTime()) {
          const timeSec = Math.floor(candleTime / 1000);
          const change = (Math.random() - 0.49) * (currentPrice * 0.02);
          const open = Math.max(1, Number(currentPrice.toFixed(2)));
          currentPrice = Math.max(1, currentPrice + change);
          const close = Math.max(1, Number(currentPrice.toFixed(2)));
          const high = Number((Math.max(open, close) + Math.random() * (currentPrice * 0.01)).toFixed(2));
          const low = Number((Math.min(open, close) - Math.random() * (currentPrice * 0.01)).toFixed(2));
          const volume = Math.floor(100 + Math.random() * 5000);

          startTimes.push(timeSec);
          opens.push(open);
          highs.push(high);
          lows.push(low);
          closes.push(close);
          volumes.push(volume);

          candleTime += stepMs;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    return {
      start_Time: startTimes,
      open: opens,
      high: highs,
      low: lows,
      close: closes,
      volume: volumes,
    };
  }
}
