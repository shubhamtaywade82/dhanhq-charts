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
    const client = await DhanAuthService.getDhanClient();
    const session = getMarketSessionInfo();

    const requestBody = {
      securityId: requestData.securityId || 13,
      exchangeSegment: requestData.exchangeSegment || "NSE_FNO",
      instrument: requestData.instrument || "INDEX",
      expiryFlag: requestData.expiryFlag || "WEEK",
      expiryCode: Number(requestData.expiryCode || 1),
      strike: requestData.strike || "ATM",
      drvOptionType: requestData.drvOptionType || "CALL",
      interval: requestData.interval || "15",
      requiredData: requestData.requiredData || ["open", "high", "low", "close", "volume"],
      fromDate: requestData.fromDate || "2026-07-01",
      toDate: requestData.toDate || session.lastCompletedTradingDay,
      autoAdjustDates: true,
    };

    const response = await client.expiredOptionsData.fetch(requestBody);
    return { status: "success", request: requestBody, data: response };
  }
}
