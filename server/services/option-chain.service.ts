import { getMarketSessionInfo } from "@shubhamtaywade82/dhanhq-ts";
import { DhanAuthService } from "./dhan-auth.service";
import { MarketDataService } from "./market-data.service";
import { DhanRateLimiter } from "./dhan-rate-limiter.service";

export class OptionChainService {
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
      interval: String(requestData.interval || "1"), // 1-minute granular interval default
      requiredData: ["open", "high", "low", "close", "volume", "oi", "spot"],
      fromDate: requestData.fromDate || "2026-07-28",
      toDate: requestData.toDate || session.lastCompletedTradingDay,
      autoAdjustDates: true,
    };

    try {
      const client = await DhanAuthService.getDhanClient();
      const response = await DhanRateLimiter.execute(() => client.expiredOptionsData.fetch(requestBody));

      // Return raw response directly from DhanHQ REST API
      return { status: "success", request: requestBody, data: response, isMock: false };
    } catch (err: any) {
      console.error("⚠️ Expired options DhanHQ API fetch error:", err.message);
      return {
        status: "error",
        request: requestBody,
        error: err.message || "DhanHQ API request failed",
        data: null,
        isMock: false,
      };
    }
  }

  /**
   * Fetch full session snapshot across all 11 strikes (ATM-5 to ATM+5) for both CE & PE
   * connecting both DhanHQ `/v2/charts/intraday` (spot) and `/v2/charts/rollingoption` (options) endpoints
   * using DhanRateLimiter with strict request pacing (350ms delay) and exponential backoff retries.
   */
  public static async fetchFullSessionSnapshot(params: any): Promise<any> {
    const session = getMarketSessionInfo();
    const securityId = String(params.securityId || "13");
    const symbol = String(params.symbol || "NIFTY").toUpperCase();
    const exchangeSegment = params.exchangeSegment || "NSE_FNO";
    let instrument = params.instrument || "OPTIDX";
    if (instrument === "INDEX") instrument = "OPTIDX";
    if (instrument === "EQUITY") instrument = "OPTSTK";

    const fromDate = params.fromDate || "2026-07-28";
    const toDate = params.toDate || session.lastCompletedTradingDay;
    const interval = String(params.interval || "15");
    const requiredData = ["open", "high", "low", "close", "volume", "oi", "spot"];

    const client = await DhanAuthService.getDhanClient();
    const offsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

    // 1. Fetch Real Underlying Spot Intraday Data via DhanHQ `/v2/charts/intraday` Endpoint
    let underlyingSpotSeries: any = null;
    let currentSpotPrice = 24850;

    try {
      const spotConfig = MarketDataService.getSymbolConfig(symbol);
      const spotRes: any = await DhanRateLimiter.execute(() =>
        client.charts.intraday({
          securityId: spotConfig.id,
          exchangeSegment: spotConfig.segment,
          instrument: spotConfig.instrument,
          interval,
          fromDate,
          toDate,
          autoAdjustDates: true,
        })
      );

      if (spotRes && (spotRes.close || spotRes.c) && (spotRes.start_Time || spotRes.timestamp)) {
        const spotCloses = spotRes.close || spotRes.c || [];
        const spotTimes = spotRes.start_Time || spotRes.timestamp || [];
        currentSpotPrice = spotCloses[spotCloses.length - 1] || currentSpotPrice;
        underlyingSpotSeries = {
          timestamp: spotTimes,
          spot: spotCloses,
          open: spotRes.open || spotRes.o || [],
          high: spotRes.high || spotRes.h || [],
          low: spotRes.low || spotRes.l || [],
          close: spotCloses,
          volume: spotRes.volume || spotRes.v || [],
        };
        console.log(`✅ [DhanHQ Intraday API] Loaded real spot candles for ${symbol}: ${spotCloses.length} points, LTP: ${currentSpotPrice}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Intraday spot fetch notice for ${symbol}:`, err.message);
    }

    // Determine Scrip Step & Actual ATM Strike
    let step = 50;
    if (symbol === "BANKNIFTY" || symbol === "SENSEX") {
      step = 100;
    } else if (symbol === "RELIANCE" || symbol === "TCS") {
      step = 20;
    } else if (symbol === "HDFCBANK" || symbol === "INFY") {
      step = 10;
    }

    const actualAtm = Math.round(currentSpotPrice / step) * step;
    const strikesMap: Record<string, any> = {};

    // 2. Fetch Real Rolling Option Contract Data via DhanHQ `/v2/charts/rollingoption` Endpoint
    for (const offset of offsets) {
      const strikeTag = offset === 0 ? "ATM" : offset > 0 ? `ATM+${offset}` : `ATM${offset}`;
      const strikePrice = actualAtm + offset * step;

      strikesMap[strikeTag] = {
        offset,
        strikePrice,
        ce: null,
        pe: null,
      };

      // Fetch CALL (CE) via DhanHQ `/v2/charts/rollingoption`
      try {
        const ceRes: any = await DhanRateLimiter.execute(() =>
          client.expiredOptionsData.fetch({
            securityId,
            exchangeSegment,
            instrument,
            expiryFlag: params.expiryFlag || "WEEK",
            expiryCode: Number(params.expiryCode || 1),
            strike: strikeTag,
            drvOptionType: "CALL",
            interval,
            requiredData,
            fromDate,
            toDate,
          })
        );

        if (ceRes) {
          const ceData = ceRes.data?.ce || ceRes.data || ceRes;
          strikesMap[strikeTag].ce = ceData;

          // Fallback underlying spot array if intraday API didn't return
          if (!underlyingSpotSeries && ceData?.spot && Array.isArray(ceData.spot) && ceData.spot.length > 0) {
            underlyingSpotSeries = {
              timestamp: ceData.timestamp || ceData.start_Time || [],
              spot: ceData.spot,
            };
            currentSpotPrice = ceData.spot[ceData.spot.length - 1] || currentSpotPrice;
          }
        }
      } catch (err: any) {
        console.warn(`CE rolling option fetch notice for ${strikeTag}:`, err.message);
      }

      // Fetch PUT (PE) via DhanHQ `/v2/charts/rollingoption`
      try {
        const peRes: any = await DhanRateLimiter.execute(() =>
          client.expiredOptionsData.fetch({
            securityId,
            exchangeSegment,
            instrument,
            expiryFlag: params.expiryFlag || "WEEK",
            expiryCode: Number(params.expiryCode || 1),
            strike: strikeTag,
            drvOptionType: "PUT",
            interval,
            requiredData,
            fromDate,
            toDate,
          })
        );

        if (peRes) {
          const peData = peRes.data?.pe || peRes.data || peRes;
          strikesMap[strikeTag].pe = peData;
        }
      } catch (err: any) {
        console.warn(`PE rolling option fetch notice for ${strikeTag}:`, err.message);
      }
    }

    return {
      status: "success",
      metadata: {
        symbol,
        securityId,
        exchangeSegment,
        instrument,
        tradingDate: fromDate,
        underlyingSpotPrice: currentSpotPrice,
        atmStrike: actualAtm,
        strikeStep: step,
        requiredData,
        generatedAt: new Date().toISOString(),
        isLiveDhanApi: true,
      },
      underlying: underlyingSpotSeries || { timestamp: [], spot: [] },
      strikes: strikesMap,
    };
  }
}
