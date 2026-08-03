export type PaperOptionType = "CE" | "PE";
export type PaperExitReason = "STOP" | "TARGET" | "EOD" | "FLIP" | "MANUAL";

export interface PaperSettings {
  stopPct: number;
  targetPct: number;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  optionType: PaperOptionType;
  strike: number;
  lotSize: number;
  entryTime: number;
  entryPremium: number;
  stopPremium: number;
  targetPremium: number;
  estimatedEntry: boolean;
  lastPremium: number;
  lastTime: number;
  maePct: number;
  mfePct: number;
}

export interface PaperTrade extends PaperPosition {
  exitTime: number;
  exitPremium: number;
  exitReason: PaperExitReason;
  pnl: number;
  returnPct: number;
}

export interface PaperAccount {
  symbol: string;
  cash: number;
  open: PaperPosition | null;
  closed: PaperTrade[];
  startedAt: number;
  totalTrades: number;
  wins: number;
}

export const PAPER_START_EQUITY = 100000;
export const DEFAULT_PAPER_SETTINGS: PaperSettings = { stopPct: 20, targetPct: 40 };

export function lotSizeForSymbol(symbol: string): number {
  const key = (symbol || "").toUpperCase();
  if (key === "BANKNIFTY") return 15;
  if (key === "SENSEX") return 10;
  return 75;
}

/** Crude premium estimate (intrinsic + 0.5% time value) used when no live quote is available. */
export function estimatePremium(spot: number, strike: number, optionType: PaperOptionType): number {
  const intrinsic =
    optionType === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  return Number((intrinsic + strike * 0.005).toFixed(2));
}

/** Minutes elapsed since midnight IST (NSE session timezone). */
export function minutesToISt(ms: number): number {
  const d = new Date(ms);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
}

/** Session-end exit trigger: 15:25 IST. */
export const isSessionEndISt = (ms: number): boolean => minutesToISt(ms) >= 925;

export function createPaperAccount(symbol: string): PaperAccount {
  return {
    symbol,
    cash: PAPER_START_EQUITY,
    open: null,
    closed: [],
    startedAt: Date.now(),
    totalTrades: 0,
    wins: 0,
  };
}

export function paperEquity(acc: PaperAccount): number {
  const openValue = acc.open ? acc.open.lastPremium * acc.open.lotSize : 0;
  return acc.cash + openValue;
}

export function realizedPnl(acc: PaperAccount): number {
  return acc.closed.reduce((sum, t) => sum + t.pnl, 0);
}

/** Open a paper position (no-op when a position is already open). */
export function openPaperPosition(
  acc: PaperAccount,
  opts: { optionType: PaperOptionType; strike: number; entryPremium: number; estimatedEntry: boolean; now: number }
): PaperAccount {
  if (acc.open || opts.entryPremium <= 0) return acc;
  const { stopPct, targetPct } = DEFAULT_PAPER_SETTINGS;
  const position: PaperPosition = {
    id: `${acc.symbol}-${opts.optionType}-${opts.strike}-${opts.now}`,
    symbol: acc.symbol,
    optionType: opts.optionType,
    strike: opts.strike,
    lotSize: lotSizeForSymbol(acc.symbol),
    entryTime: opts.now,
    entryPremium: opts.entryPremium,
    stopPremium: Number((opts.entryPremium * (1 - stopPct / 100)).toFixed(2)),
    targetPremium: Number((opts.entryPremium * (1 + targetPct / 100)).toFixed(2)),
    estimatedEntry: opts.estimatedEntry,
    lastPremium: opts.entryPremium,
    lastTime: opts.now,
    maePct: 0,
    mfePct: 0,
  };
  return { ...acc, cash: Number((acc.cash - opts.entryPremium * position.lotSize).toFixed(2)), open: position };
}

/** Close the open position at the given premium. */
export function closePaperPosition(
  acc: PaperAccount,
  premium: number,
  now: number,
  reason: PaperExitReason
): { acc: PaperAccount; trade: PaperTrade | null } {
  if (!acc.open) return { acc, trade: null };
  const open = acc.open;
  const pnl = (premium - open.entryPremium) * open.lotSize;
  const trade: PaperTrade = {
    ...open,
    exitTime: now,
    exitPremium: premium,
    exitReason: reason,
    pnl: Number(pnl.toFixed(2)),
    returnPct: Number((((premium - open.entryPremium) / open.entryPremium) * 100).toFixed(2)),
  };
  return {
    acc: {
      ...acc,
      cash: Number((acc.cash + premium * open.lotSize).toFixed(2)),
      open: null,
      closed: [...acc.closed, trade],
      totalTrades: acc.totalTrades + 1,
      wins: acc.wins + (pnl > 0 ? 1 : 0),
    },
    trade,
  };
}

/**
 * Mark-to-market the open position; auto-closes on stop/target.
 * Returns the updated account plus the closed trade (if any).
 */
export function markPaperPosition(
  acc: PaperAccount,
  premium: number,
  now: number
): { acc: PaperAccount; trade: PaperTrade | null } {
  if (!acc.open || premium <= 0) return { acc, trade: null };
  const open = acc.open;
  const returnPct = ((premium - open.entryPremium) / open.entryPremium) * 100;
  const updated: PaperPosition = {
    ...open,
    lastPremium: premium,
    lastTime: now,
    maePct: Number(Math.min(open.maePct, returnPct).toFixed(2)),
    mfePct: Number(Math.max(open.mfePct, returnPct).toFixed(2)),
  };
  if (premium <= updated.stopPremium) {
    return closePaperPosition({ ...acc, open: updated }, premium, now, "STOP");
  }
  if (premium >= updated.targetPremium) {
    return closePaperPosition({ ...acc, open: updated }, premium, now, "TARGET");
  }
  return { acc: { ...acc, open: updated }, trade: null };
}

export function loadPaperAccount(symbol: string): PaperAccount | null {
  try {
    const raw = localStorage.getItem(`dhan_paper_${symbol.toLowerCase()}`);
    return raw ? (JSON.parse(raw) as PaperAccount) : null;
  } catch {
    return null;
  }
}

export function savePaperAccount(acc: PaperAccount): void {
  try {
    localStorage.setItem(`dhan_paper_${acc.symbol.toLowerCase()}`, JSON.stringify(acc));
  } catch {}
}

export function resetPaperAccount(symbol: string): PaperAccount {
  try {
    localStorage.removeItem(`dhan_paper_${symbol.toLowerCase()}`);
  } catch {}
  return createPaperAccount(symbol);
}

/** Fetch the latest premium for a strike; falls back to an estimated premium when unavailable. */
export async function fetchPaperQuote(
  symbol: string,
  strike: number,
  optionType: PaperOptionType,
  spot: number
): Promise<{ premium: number; estimated: boolean }> {
  try {
    const res = await fetch(`/api/paper/quote?symbol=${encodeURIComponent(symbol)}&strike=${strike}&optionType=${optionType}`);
    const json = await res.json();
    if (json && json.premium > 0) return { premium: Number(json.premium), estimated: false };
  } catch {}
  return { premium: estimatePremium(spot, strike, optionType), estimated: true };
}
