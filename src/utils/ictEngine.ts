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

interface SessionAcc {
  type: "ASIA" | "LONDON" | "NEW_YORK";
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

    // Asia Session: 01:30 IST (90m) to 06:00 IST (360m)
    if (normalizedMinutes >= 90 && normalizedMinutes < 360) {
      targetType = "ASIA";
      name = "ASIA RANGE";
    }
    // London Kill Zone: 12:30 IST (750m) to 15:30 IST (930m)
    else if (normalizedMinutes >= 750 && normalizedMinutes < 930) {
      targetType = "LONDON";
      name = "LONDON KZ";
    }
    // New York Kill Zone: 17:30 IST (1050m) to 20:30 IST (1230m)
    else if (normalizedMinutes >= 1050 && normalizedMinutes < 1230) {
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
