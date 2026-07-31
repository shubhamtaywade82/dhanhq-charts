export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ICTSession {
  id: string;
  name: string;
  type: "ASIA" | "LONDON" | "NEW_YORK";
  startTime: number;
  endTime: number;
  high: number;
  low: number;
}

export interface ICTSilverBulletWindow {
  id: string;
  name: string;
  type: "LONDON_SB" | "NY_AM_SB" | "NY_PM_SB";
  startTime: number;
  endTime: number;
}

export interface ICTOTEZone {
  swingHigh: number;
  swingLow: number;
  trend: "BULLISH" | "BEARISH";
  fib618: number;
  fib705: number;
  fib790: number;
  startTime: number;
}

export interface ICTJudasSwing {
  id: string;
  type: "BULLISH_JUDAS" | "BEARISH_JUDAS";
  candleTime: number;
  level: number;
  asiaHigh: number;
  asiaLow: number;
}

interface SessionAcc {
  type: "ASIA" | "LONDON" | "NEW_YORK";
  name: string;
  candles: CandleData[];
}

interface SBAcc {
  type: "LONDON_SB" | "NY_AM_SB" | "NY_PM_SB";
  name: string;
  candles: CandleData[];
}

/**
 * Detect ICT Trading Sessions & Kill Zones across intraday candlestick data.
 * - Asia Session Range: 01:30 - 06:00 IST
 * - London Kill Zone: 12:30 - 15:30 IST
 * - New York Kill Zone: 17:30 - 20:30 IST
 */
export function detectICTSessions(candles: CandleData[]): ICTSession[] {
  if (!candles || candles.length === 0) return [];

  const sessions: ICTSession[] = [];
  let currentSession: SessionAcc | null = null;

  const pushCurrentSession = () => {
    if (!currentSession || currentSession.candles.length === 0) return;
    const cList = currentSession.candles;
    sessions.push({
      id: `session-${currentSession.type}-${cList[0].time}`,
      name: currentSession.name,
      type: currentSession.type,
      startTime: cList[0].time,
      endTime: cList[cList.length - 1].time,
      high: Math.max(...cList.map((c: CandleData) => c.high)),
      low: Math.min(...cList.map((c: CandleData) => c.low)),
    });
  };

  candles.forEach((candle) => {
    const date = new Date(candle.time * 1000);
    const istMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + 330;
    const normalizedMinutes = (istMinutes % 1440 + 1440) % 1440;

    let targetType: "ASIA" | "LONDON" | "NEW_YORK" | null = null;
    let name = "";

    if (normalizedMinutes >= 90 && normalizedMinutes < 360) {
      targetType = "ASIA";
      name = "ASIA RANGE";
    } else if (normalizedMinutes >= 750 && normalizedMinutes < 930) {
      targetType = "LONDON";
      name = "LONDON KZ";
    } else if (normalizedMinutes >= 1050 && normalizedMinutes < 1230) {
      targetType = "NEW_YORK";
      name = "NY KZ";
    }

    if (targetType) {
      if (!currentSession || currentSession.type !== targetType) {
        pushCurrentSession();
        currentSession = { type: targetType, name, candles: [candle] };
      } else {
        currentSession.candles.push(candle);
      }
    } else {
      if (currentSession) {
        pushCurrentSession();
        currentSession = null;
      }
    }
  });

  pushCurrentSession();

  return sessions;
}

/**
 * Detect ICT Silver Bullet Windows across intraday candlestick data.
 * - London Open SB: 03:00 - 04:00 EST (13:30 - 14:30 IST)
 * - NY AM SB: 10:00 - 11:00 EST (19:30 - 20:30 IST)
 * - NY PM SB: 14:00 - 15:00 EST (23:30 - 00:30 IST)
 */
export function detectSilverBulletWindows(candles: CandleData[]): ICTSilverBulletWindow[] {
  if (!candles || candles.length === 0) return [];

  const windows: ICTSilverBulletWindow[] = [];
  let currentSB: SBAcc | null = null;

  const pushCurrentSB = () => {
    if (!currentSB || currentSB.candles.length === 0) return;
    const cList = currentSB.candles;
    windows.push({
      id: `sb-${currentSB.type}-${cList[0].time}`,
      name: currentSB.name,
      type: currentSB.type,
      startTime: cList[0].time,
      endTime: cList[cList.length - 1].time,
    });
  };

  candles.forEach((candle) => {
    const date = new Date(candle.time * 1000);
    const istMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + 330;
    const normalizedMinutes = (istMinutes % 1440 + 1440) % 1440;

    let targetType: "LONDON_SB" | "NY_AM_SB" | "NY_PM_SB" | null = null;
    let name = "";

    if (normalizedMinutes >= 810 && normalizedMinutes < 870) {
      targetType = "LONDON_SB";
      name = "SILVER BULLET (LDN 🎯)";
    } else if (normalizedMinutes >= 1170 && normalizedMinutes < 1230) {
      targetType = "NY_AM_SB";
      name = "SILVER BULLET (NY AM 🎯)";
    } else if (normalizedMinutes >= 1410 || normalizedMinutes < 30) {
      targetType = "NY_PM_SB";
      name = "SILVER BULLET (NY PM 🎯)";
    }

    if (targetType) {
      if (!currentSB || currentSB.type !== targetType) {
        pushCurrentSB();
        currentSB = { type: targetType, name, candles: [candle] };
      } else {
        currentSB.candles.push(candle);
      }
    } else {
      if (currentSB) {
        pushCurrentSB();
        currentSB = null;
      }
    }
  });

  pushCurrentSB();

  return windows;
}

/**
 * Detect ICT Optimal Trade Entry (OTE Zone: 0.618 - 0.705 ⭐ - 0.790 Fib Retracement Levels).
 */
export function detectICTOTEZone(candles: CandleData[], lookback = 80): ICTOTEZone | null {
  if (!candles || candles.length < 20) return null;

  const slice = candles.slice(-Math.min(candles.length, lookback));
  let maxHigh = -Infinity;
  let minLow = Infinity;
  let highTime = slice[0].time;
  let lowTime = slice[0].time;

  slice.forEach((c) => {
    if (c.high > maxHigh) {
      maxHigh = c.high;
      highTime = c.time;
    }
    if (c.low < minLow) {
      minLow = c.low;
      lowTime = c.time;
    }
  });

  if (maxHigh <= minLow) return null;

  const range = maxHigh - minLow;
  const isBullish = highTime > lowTime;
  const trend = isBullish ? "BULLISH" : "BEARISH";

  let fib618 = 0;
  let fib705 = 0;
  let fib790 = 0;

  if (isBullish) {
    fib618 = maxHigh - range * 0.618;
    fib705 = maxHigh - range * 0.705;
    fib790 = maxHigh - range * 0.790;
  } else {
    fib618 = minLow + range * 0.618;
    fib705 = minLow + range * 0.705;
    fib790 = minLow + range * 0.790;
  }

  const startTime = Math.min(highTime, lowTime);

  return {
    swingHigh: maxHigh,
    swingLow: minLow,
    trend,
    fib618,
    fib705,
    fib790,
    startTime,
  };
}

/**
 * Detect ICT Judas Swings (Session Open False Expansion & Fakeout Traps).
 * Identifies London/NY open wicks piercing Asian Range High/Low that close back inside.
 */
export function detectJudasSwings(candles: CandleData[]): ICTJudasSwing[] {
  if (!candles || candles.length < 15) return [];

  const judasList: ICTJudasSwing[] = [];
  const sessions = detectICTSessions(candles);
  const asiaSessions = sessions.filter((s) => s.type === "ASIA");

  asiaSessions.forEach((asia) => {
    const postAsiaCandles = candles.filter((c) => c.time > asia.endTime);

    postAsiaCandles.forEach((c) => {
      const date = new Date(c.time * 1000);
      const istMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + 330;
      const normalizedMinutes = (istMinutes % 1440 + 1440) % 1440;

      // Only check during London Open (750m - 930m) or NY Open (1050m - 1230m)
      const isKillZone = (normalizedMinutes >= 750 && normalizedMinutes < 930) || (normalizedMinutes >= 1050 && normalizedMinutes < 1230);
      if (!isKillZone) return;

      // Bearish Judas (False Pump): Wick pierces above Asian High, but body closes below
      if (c.high > asia.high && c.close < asia.high) {
        const id = `judas-bear-${asia.id}-${c.time}`;
        if (!judasList.some((j) => j.id === id)) {
          judasList.push({
            id,
            type: "BEARISH_JUDAS",
            candleTime: c.time,
            level: c.high,
            asiaHigh: asia.high,
            asiaLow: asia.low,
          });
        }
      }

      // Bullish Judas (False Dip): Wick pierces below Asian Low, but body closes above
      if (c.low < asia.low && c.close > asia.low) {
        const id = `judas-bull-${asia.id}-${c.time}`;
        if (!judasList.some((j) => j.id === id)) {
          judasList.push({
            id,
            type: "BULLISH_JUDAS",
            candleTime: c.time,
            level: c.low,
            asiaHigh: asia.high,
            asiaLow: asia.low,
          });
        }
      }
    });
  });

  return judasList;
}

export interface ICTAMDCycle {
  id: string;
  trend: "BULLISH" | "BEARISH";
  accumStartTime: number;
  accumEndTime: number;
  accumHigh: number;
  accumLow: number;
  manipStartTime: number;
  manipEndTime: number;
  manipLevel: number;
  distribStartTime: number;
  distribEndTime: number;
  distribLevel: number;
}

/**
 * Detect ICT AMD (Power of 3) Cycles: Accumulation → Manipulation → Distribution.
 * Uses intraday IST session windows:
 * - Accumulation: Asia Session Range (01:30 - 06:00 IST)
 * - Manipulation (Judas Swing): London Open false move (12:30 - 14:30 IST)
 * - Distribution: True directional move (14:30 - 20:30 IST)
 */
export function detectAMDCycles(candles: CandleData[]): ICTAMDCycle[] {
  if (!candles || candles.length < 20) return [];

  const cycles: ICTAMDCycle[] = [];

  // Group candles by calendar day (IST-adjusted)
  const dayMap = new Map<string, CandleData[]>();
  candles.forEach((c) => {
    const date = new Date(c.time * 1000);
    // IST = UTC+5:30, normalize to IST midnight
    const istMs = date.getTime() + 330 * 60 * 1000;
    const dayKey = new Date(istMs).toISOString().slice(0, 10);
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
    dayMap.get(dayKey)!.push(c);
  });

  dayMap.forEach((dayCandles, dayKey) => {
    const accumCandles = dayCandles.filter((c) => {
      const istMins = toISTMinutes(c.time);
      return istMins >= 90 && istMins < 360; // 01:30 - 06:00
    });
    const manipCandles = dayCandles.filter((c) => {
      const istMins = toISTMinutes(c.time);
      return istMins >= 750 && istMins < 870; // 12:30 - 14:30
    });
    const distribCandles = dayCandles.filter((c) => {
      const istMins = toISTMinutes(c.time);
      return istMins >= 870 && istMins < 1230; // 14:30 - 20:30
    });

    if (accumCandles.length < 2 || manipCandles.length < 1 || distribCandles.length < 1) return;

    const accumHigh = Math.max(...accumCandles.map((c) => c.high));
    const accumLow = Math.min(...accumCandles.map((c) => c.low));

    // Manipulation: false expansion vs accumulation range
    const manipHigh = Math.max(...manipCandles.map((c) => c.high));
    const manipLow = Math.min(...manipCandles.map((c) => c.low));

    const distribClose = distribCandles[distribCandles.length - 1].close;
    const distribOpen = distribCandles[0].open;

    // Bullish AMD: Manipulation sweeps below accum low, distribution closes above accum high
    if (manipLow < accumLow && distribClose > accumHigh) {
      cycles.push({
        id: `amd-bull-${dayKey}`,
        trend: "BULLISH",
        accumStartTime: accumCandles[0].time,
        accumEndTime: accumCandles[accumCandles.length - 1].time,
        accumHigh,
        accumLow,
        manipStartTime: manipCandles[0].time,
        manipEndTime: manipCandles[manipCandles.length - 1].time,
        manipLevel: manipLow,
        distribStartTime: distribCandles[0].time,
        distribEndTime: distribCandles[distribCandles.length - 1].time,
        distribLevel: distribClose,
      });
    }

    // Bearish AMD: Manipulation sweeps above accum high, distribution closes below accum low
    if (manipHigh > accumHigh && distribClose < accumLow) {
      cycles.push({
        id: `amd-bear-${dayKey}`,
        trend: "BEARISH",
        accumStartTime: accumCandles[0].time,
        accumEndTime: accumCandles[accumCandles.length - 1].time,
        accumHigh,
        accumLow,
        manipStartTime: manipCandles[0].time,
        manipEndTime: manipCandles[manipCandles.length - 1].time,
        manipLevel: manipHigh,
        distribStartTime: distribCandles[0].time,
        distribEndTime: distribCandles[distribCandles.length - 1].time,
        distribLevel: distribClose,
      });
    }
  });

  return cycles.sort((a, b) => a.accumStartTime - b.accumStartTime);
}

function toISTMinutes(unixSec: number): number {
  const date = new Date(unixSec * 1000);
  const istMins = date.getUTCHours() * 60 + date.getUTCMinutes() + 330;
  return (istMins % 1440 + 1440) % 1440;
}
