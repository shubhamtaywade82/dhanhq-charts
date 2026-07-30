export class OptionsAnalyticsService {
  /**
   * Run full quantitative analytics pipeline on canonical session snapshot
   */
  public static analyzeSession(snapshot: any): any {
    if (!snapshot || !snapshot.strikes) {
      throw new Error("Invalid session snapshot provided to OptionsAnalyticsService");
    }

    const { metadata, underlying, strikes } = snapshot;
    const timestamps: number[] = underlying?.timestamp || strikes["ATM"]?.ce?.timestamp || [];
    const spotSeries: number[] = underlying?.spot || strikes["ATM"]?.ce?.spot || [];

    const offsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    const analyzedStrikes: Record<string, any> = {};

    let totalCeVolSum = 0;
    let totalPeVolSum = 0;
    let totalCeOISum = 0;
    let totalPeOISum = 0;

    let longBuildupCeCount = 0;
    let shortBuildupCeCount = 0;
    let shortCoveringCeCount = 0;
    let longUnwindingCeCount = 0;

    let longBuildupPeCount = 0;
    let shortBuildupPeCount = 0;
    let shortCoveringPeCount = 0;
    let longUnwindingPeCount = 0;

    // Process each strike offset
    for (const off of offsets) {
      const tag = off === 0 ? "ATM" : off > 0 ? `ATM+${off}` : `ATM${off}`;
      const strikeData = strikes[tag];
      if (!strikeData) continue;

      const strikePrice = strikeData.strikePrice;
      const ceObj = strikeData.ce || {};
      const peObj = strikeData.pe || {};

      const ceAnalyzed = this.analyzeSeries(ceObj, "CALL", strikePrice, spotSeries);
      const peAnalyzed = this.analyzeSeries(peObj, "PUT", strikePrice, spotSeries);

      // Accumulate totals & buildup counts
      totalCeVolSum += ceAnalyzed.totalVolume;
      totalPeVolSum += peAnalyzed.totalVolume;
      totalCeOISum += ceAnalyzed.lastOI;
      totalPeOISum += peAnalyzed.lastOI;

      ceAnalyzed.buildupCounts.longBuildup += ceAnalyzed.buildupCounts.longBuildup;
      longBuildupCeCount += ceAnalyzed.buildupCounts.longBuildup;
      shortBuildupCeCount += ceAnalyzed.buildupCounts.shortBuildup;
      shortCoveringCeCount += ceAnalyzed.buildupCounts.shortCovering;
      longUnwindingCeCount += ceAnalyzed.buildupCounts.longUnwinding;

      longBuildupPeCount += peAnalyzed.buildupCounts.longBuildup;
      shortBuildupPeCount += peAnalyzed.buildupCounts.shortBuildup;
      shortCoveringPeCount += peAnalyzed.buildupCounts.shortCovering;
      longUnwindingPeCount += peAnalyzed.buildupCounts.longUnwinding;

      analyzedStrikes[tag] = {
        offset: off,
        strikePrice,
        ce: ceAnalyzed,
        pe: peAnalyzed,
      };
    }

    // ATM Straddle & Strangle Analytics
    const straddleAnalytics = this.computeStraddleAnalytics(strikes, metadata.atmStrike, metadata.strikeStep);

    // Call / Put Buildup Summary Percentages
    const ceTotalCandles = Math.max(1, longBuildupCeCount + shortBuildupCeCount + shortCoveringCeCount + longUnwindingCeCount);
    const peTotalCandles = Math.max(1, longBuildupPeCount + shortBuildupPeCount + shortCoveringPeCount + longUnwindingPeCount);

    const buildupSummary = {
      ce: {
        longBuildupPct: Number(((longBuildupCeCount / ceTotalCandles) * 100).toFixed(1)),
        shortBuildupPct: Number(((shortBuildupCeCount / ceTotalCandles) * 100).toFixed(1)),
        shortCoveringPct: Number(((shortCoveringCeCount / ceTotalCandles) * 100).toFixed(1)),
        longUnwindingPct: Number(((longUnwindingCeCount / ceTotalCandles) * 100).toFixed(1)),
      },
      pe: {
        longBuildupPct: Number(((longBuildupPeCount / peTotalCandles) * 100).toFixed(1)),
        shortBuildupPct: Number(((shortBuildupPeCount / peTotalCandles) * 100).toFixed(1)),
        shortCoveringPct: Number(((shortCoveringPeCount / peTotalCandles) * 100).toFixed(1)),
        longUnwindingPct: Number(((longUnwindingPeCount / peTotalCandles) * 100).toFixed(1)),
      },
    };

    // PCR (Put-Call Ratio)
    const pcrVolume = totalCeVolSum > 0 ? Number((totalPeVolSum / totalCeVolSum).toFixed(2)) : 1.0;
    const pcrOI = totalCeOISum > 0 ? Number((totalPeOISum / totalCeOISum).toFixed(2)) : 1.0;

    // Session Regime Classification
    const spotStart = spotSeries[0] || metadata.underlyingSpotPrice;
    const spotEnd = spotSeries[spotSeries.length - 1] || metadata.underlyingSpotPrice;
    const spotHigh = spotSeries.length > 0 ? Math.max(...spotSeries) : spotStart;
    const spotLow = spotSeries.length > 0 ? Math.min(...spotSeries) : spotStart;
    const spotRange = spotHigh - spotLow;
    const spotReturnPct = spotStart > 0 ? ((spotEnd - spotStart) / spotStart) * 100 : 0;

    let regimeTag = "RANGE DAY";
    if (Math.abs(spotReturnPct) > 0.8) {
      regimeTag = spotReturnPct > 0 ? "TRENDING UP" : "TRENDING DOWN";
    } else if (spotRange > spotStart * 0.015) {
      regimeTag = "VOLATILITY EXPANSION";
    }

    return {
      metadata,
      sessionSummary: {
        timestamps,
        spotStart,
        spotEnd,
        spotHigh,
        spotLow,
        spotRange,
        spotReturnPct: Number(spotReturnPct.toFixed(2)),
        regimeTag,
        pcrVolume,
        pcrOI,
        totalCeVolume: totalCeVolSum,
        totalPeVolume: totalPeVolSum,
      },
      buildupSummary,
      straddleAnalytics,
      analyzedStrikes,
    };
  }

  /**
   * Helper: Analyze single contract series
   */
  private static analyzeSeries(seriesObj: any, optionType: "CALL" | "PUT", strikePrice: number, spotSeries: number[]): any {
    const timestamp = seriesObj.timestamp || [];
    const open = seriesObj.open || [];
    const high = seriesObj.high || [];
    const low = seriesObj.low || [];
    const close = seriesObj.close || [];
    const volume = seriesObj.volume || [];
    const oi = seriesObj.oi || [];

    const candles: any[] = [];
    let longBuildup = 0;
    let shortBuildup = 0;
    let shortCovering = 0;
    let longUnwinding = 0;
    let totalVol = 0;

    for (let i = 0; i < close.length; i++) {
      const cClose = close[i] || 0;
      const cOpen = open[i] || cClose;
      const cHigh = high[i] || cClose;
      const cLow = low[i] || cClose;
      const cVol = volume[i] || 0;
      const cOI = oi[i] || 0;
      const cSpot = spotSeries[i] || (seriesObj.spot ? seriesObj.spot[i] : 0);

      totalVol += cVol;

      // Price & OI Deltas
      const prevClose = i > 0 ? close[i - 1] : cOpen;
      const prevOI = i > 0 ? oi[i - 1] || cOI : cOI;

      const deltaPrice = cClose - prevClose;
      const deltaOI = cOI - prevOI;

      // Buildup Classification
      let buildupType = "NEUTRAL";
      if (deltaPrice > 0 && deltaOI >= 0) {
        buildupType = "LONG BUILDUP";
        longBuildup++;
      } else if (deltaPrice < 0 && deltaOI >= 0) {
        buildupType = "SHORT BUILDUP";
        shortBuildup++;
      } else if (deltaPrice > 0 && deltaOI < 0) {
        buildupType = "SHORT COVERING";
        shortCovering++;
      } else if (deltaPrice < 0 && deltaOI < 0) {
        buildupType = "LONG UNWINDING";
        longUnwinding++;
      }

      // Intrinsic & Extrinsic Values
      const intrinsic =
        cSpot > 0
          ? optionType === "CALL"
            ? Math.max(0, cSpot - strikePrice)
            : Math.max(0, strikePrice - cSpot)
          : 0;
      const extrinsic = Math.max(0, cClose - intrinsic);

      candles.push({
        index: i,
        time: timestamp[i] || 0,
        spot: cSpot,
        open: cOpen,
        high: cHigh,
        low: cLow,
        close: cClose,
        volume: cVol,
        oi: cOI,
        deltaPrice: Number(deltaPrice.toFixed(2)),
        deltaOI,
        buildupType,
        intrinsic: Number(intrinsic.toFixed(2)),
        extrinsic: Number(extrinsic.toFixed(2)),
      });
    }

    const firstClose = close[0] || 0;
    const lastClose = close[close.length - 1] || 0;
    const maxHigh = close.length > 0 ? Math.max(...high) : 0;
    const minLow = close.length > 0 ? Math.min(...low) : 0;
    const lastOI = oi[oi.length - 1] || 0;

    return {
      totalVolume: totalVol,
      firstClose,
      lastClose,
      netChange: Number((lastClose - firstClose).toFixed(2)),
      maxHigh,
      minLow,
      lastOI,
      buildupCounts: { longBuildup, shortBuildup, shortCovering, longUnwinding },
      candles,
    };
  }

  /**
   * Helper: Compute ATM Straddle & Strangle series
   */
  private static computeStraddleAnalytics(strikes: any, atmStrike: number, step: number): any {
    const atmObj = strikes["ATM"];
    const atmCeClose = atmObj?.ce?.close || [];
    const atmPeClose = atmObj?.pe?.close || [];
    const timestamps = atmObj?.ce?.timestamp || [];

    const straddleSeries: any[] = [];
    const length = Math.min(atmCeClose.length, atmPeClose.length);

    for (let i = 0; i < length; i++) {
      const cePrice = atmCeClose[i] || 0;
      const pePrice = atmPeClose[i] || 0;
      const straddlePrice = cePrice + pePrice;
      straddleSeries.push({
        index: i,
        time: timestamps[i] || 0,
        cePrice,
        pePrice,
        straddlePrice: Number(straddlePrice.toFixed(2)),
      });
    }

    const straddlePrices = straddleSeries.map((s) => s.straddlePrice);
    const startPrice = straddlePrices[0] || 0;
    const lastPrice = straddlePrices[straddlePrices.length - 1] || 0;
    const maxHigh = straddlePrices.length > 0 ? Math.max(...straddlePrices) : 0;
    const minLow = straddlePrices.length > 0 ? Math.min(...straddlePrices) : 0;
    const maxDrawdown = startPrice > 0 ? ((startPrice - minLow) / startPrice) * 100 : 0;

    return {
      atmStrike,
      startPrice,
      lastPrice,
      maxHigh,
      minLow,
      maxDrawdownPct: Number(maxDrawdown.toFixed(2)),
      straddleSeries,
    };
  }
}
