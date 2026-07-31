export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface FVGPattern {
  id: string;
  type: "BULLISH" | "BEARISH";
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  mitigated: boolean;
  mitigatedTime?: number;
}

export interface OrderBlockPattern {
  id: string;
  type: "BULLISH_OB" | "BEARISH_OB";
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  mitigated: boolean;
  mitigatedTime?: number;
}

export interface MarketStructureBreak {
  id: string;
  type: "BULLISH_BOS" | "BEARISH_BOS" | "BULLISH_CHOCH" | "BEARISH_CHOCH";
  category: "MAJOR" | "INTERNAL";
  level: number;
  swingTime: number;
  breakTime: number;
  mitigated: boolean;
}

/**
 * Detect Fair Value Gaps (FVG) across intraday candlestick series.
 */
export function detectFVGs(candles: CandleData[], minGapPct = 0.03): FVGPattern[] {
  if (!candles || candles.length < 3) return [];

  const fvgs: FVGPattern[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      const gapPct = ((top - bottom) / bottom) * 100;

      if (gapPct >= minGapPct) {
        let mitigated = false;
        let mitigatedTime: number | undefined;

        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].low <= bottom) {
            mitigated = true;
            mitigatedTime = candles[j].time;
            break;
          }
        }

        fvgs.push({
          id: `fvg-bull-${c1.time}-${i}`,
          type: "BULLISH",
          startTime: c1.time,
          endTime: mitigatedTime || candles[candles.length - 1].time,
          top,
          bottom,
          mitigated,
          mitigatedTime,
        });
      }
    } else if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      const gapPct = ((top - bottom) / bottom) * 100;

      if (gapPct >= minGapPct) {
        let mitigated = false;
        let mitigatedTime: number | undefined;

        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].high >= top) {
            mitigated = true;
            mitigatedTime = candles[j].time;
            break;
          }
        }

        fvgs.push({
          id: `fvg-bear-${c1.time}-${i}`,
          type: "BEARISH",
          startTime: c1.time,
          endTime: mitigatedTime || candles[candles.length - 1].time,
          top,
          bottom,
          mitigated,
          mitigatedTime,
        });
      }
    }
  }

  return fvgs;
}

/**
 * Detect High-Conviction Order Blocks (OB) across intraday candlestick series.
 */
export function detectOrderBlocks(candles: CandleData[], minImpulseMult = 1.5): OrderBlockPattern[] {
  if (!candles || candles.length < 5) return [];

  const obs: OrderBlockPattern[] = [];
  const recentSlice = candles.slice(-50);
  const avgRange = recentSlice.reduce((sum, c) => sum + (c.high - c.low), 0) / recentSlice.length;

  for (let i = 1; i < candles.length - 2; i++) {
    const prevCandle = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const isBearishPrev = prevCandle.close < prevCandle.open;
    const isBullishPrev = prevCandle.close > prevCandle.open;

    const bullImpulse = (next1.close - next1.open) + (next2.close - next2.open);
    if (isBearishPrev && bullImpulse > avgRange * minImpulseMult) {
      const top = prevCandle.high;
      const bottom = prevCandle.low;

      let mitigated = false;
      let mitigatedTime: number | undefined;

      for (let j = i + 3; j < candles.length; j++) {
        if (candles[j].low <= top) {
          mitigated = true;
          mitigatedTime = candles[j].time;
          break;
        }
      }

      obs.push({
        id: `ob-bull-${prevCandle.time}-${i}`,
        type: "BULLISH_OB",
        startTime: prevCandle.time,
        endTime: mitigatedTime || candles[candles.length - 1].time,
        top,
        bottom,
        mitigated,
        mitigatedTime,
      });
    }

    const bearImpulse = (prevCandle.open - next1.close) + (next1.open - next2.close);
    if (isBullishPrev && bearImpulse > avgRange * minImpulseMult) {
      const top = prevCandle.high;
      const bottom = prevCandle.low;

      let mitigated = false;
      let mitigatedTime: number | undefined;

      for (let j = i + 3; j < candles.length; j++) {
        if (candles[j].high >= bottom) {
          mitigated = true;
          mitigatedTime = candles[j].time;
          break;
        }
      }

      obs.push({
        id: `ob-bear-${prevCandle.time}-${i}`,
        type: "BEARISH_OB",
        startTime: prevCandle.time,
        endTime: mitigatedTime || candles[candles.length - 1].time,
        top,
        bottom,
        mitigated,
        mitigatedTime,
      });
    }
  }

  return obs;
}

/**
 * Detect Market Structure Breaks (BOS & CHoCH) categorized by Major (Macro) and Internal (Micro) structures.
 */
export function detectMarketStructure(candles: CandleData[]): MarketStructureBreak[] {
  if (!candles || candles.length < 15) return [];

  const breaks: MarketStructureBreak[] = [];

  // Helper pass for a specific swing length
  const scanStructurePass = (swingLength: number, category: "MAJOR" | "INTERNAL") => {
    const swingHighs: { index: number; time: number; price: number }[] = [];
    const swingLows: { index: number; time: number; price: number }[] = [];

    for (let i = swingLength; i < candles.length - swingLength; i++) {
      const currentHigh = candles[i].high;
      const currentLow = candles[i].low;

      let isHigh = true;
      let isLow = true;

      for (let k = i - swingLength; k <= i + swingLength; k++) {
        if (k === i) continue;
        if (candles[k].high >= currentHigh) isHigh = false;
        if (candles[k].low <= currentLow) isLow = false;
      }

      if (isHigh) swingHighs.push({ index: i, time: candles[i].time, price: currentHigh });
      if (isLow) swingLows.push({ index: i, time: candles[i].time, price: currentLow });
    }

    let currentTrend: "BULLISH" | "BEARISH" = "BULLISH";

    for (let i = swingLength; i < candles.length; i++) {
      const candle = candles[i];

      // Check recent swing high breaks
      const prevHighs = swingHighs.filter((h) => h.index < i);
      const lastHigh = prevHighs[prevHighs.length - 1];

      if (lastHigh && candle.close > lastHigh.price) {
        const alreadyRecorded = breaks.some(
          (b) => b.category === category && b.swingTime === lastHigh.time
        );
        if (!alreadyRecorded) {
          const isChoch = currentTrend === "BEARISH";
          breaks.push({
            id: `struct-${category.toLowerCase()}-high-${lastHigh.time}-${i}`,
            type: isChoch ? "BULLISH_CHOCH" : "BULLISH_BOS",
            category,
            level: lastHigh.price,
            swingTime: lastHigh.time,
            breakTime: candle.time,
            mitigated: false,
          });
          currentTrend = "BULLISH";
        }
      }

      // Check recent swing low breaks
      const prevLows = swingLows.filter((l) => l.index < i);
      const lastLow = prevLows[prevLows.length - 1];

      if (lastLow && candle.close < lastLow.price) {
        const alreadyRecorded = breaks.some(
          (b) => b.category === category && b.swingTime === lastLow.time
        );
        if (!alreadyRecorded) {
          const isChoch = currentTrend === "BULLISH";
          breaks.push({
            id: `struct-${category.toLowerCase()}-low-${lastLow.time}-${i}`,
            type: isChoch ? "BEARISH_CHOCH" : "BEARISH_BOS",
            category,
            level: lastLow.price,
            swingTime: lastLow.time,
            breakTime: candle.time,
            mitigated: false,
          });
          currentTrend = "BEARISH";
        }
      }
    }
  };

  // Run Major Structure Pass (Macro: swingLength = 7)
  scanStructurePass(7, "MAJOR");
  // Run Internal Structure Pass (Micro: swingLength = 3)
  scanStructurePass(3, "INTERNAL");

  return breaks;
}
