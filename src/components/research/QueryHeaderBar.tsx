import React from "react";
import { Database, Play, Activity, Sliders, Calendar, Zap, Layers, RefreshCw } from "lucide-react";

export interface QueryFormParams {
  symbol: string;
  securityId: string;
  exchangeSegment: string;
  instrument: string;
  expiryFlag: string;
  expiryCode: number;
  strikeRange: string;
  interval: string;
  fromDate: string;
  toDate: string;
  mode: "Replay" | "Analysis" | "Backtest";
}

interface QueryHeaderBarProps {
  form: QueryFormParams;
  onChange: (updated: QueryFormParams) => void;
  onLoadSession: () => void;
  onRunAnalysis: () => void;
  onRunBacktest: () => void;
  loading: boolean;
  meta: {
    underlyingSpotPrice: number;
    atmStrike: number;
    strikeStep: number;
    strikesCount: number;
    contractsCount: number;
  } | null;
}

export const QueryHeaderBar: React.FC<QueryHeaderBarProps> = ({
  form,
  onChange,
  onLoadSession,
  onRunAnalysis,
  onRunBacktest,
  loading,
  meta,
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "16px 20px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        background: "linear-gradient(135deg, rgba(15, 19, 28, 0.95) 0%, rgba(20, 26, 38, 0.95) 100%)",
        border: "1px solid var(--border-color)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* BRANDING HEADER & META BADGES */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ padding: "8px", background: "rgba(0, 229, 255, 0.12)", borderRadius: "8px", border: "1px solid var(--accent-cyan)" }}>
            <Database size={20} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "white", letterSpacing: "0.5px" }}>
              EXPIRED OPTIONS RESEARCH WORKBENCH
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Historical Market Replay • Chain Analytics • Quantitative Backtesting Terminal
            </div>
          </div>
        </div>

        {/* SESSION METADATA BADGE BAR */}
        {meta ? (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: "11px", background: "rgba(0,245,160,0.1)", border: "1px solid var(--accent-green)", padding: "5px 12px", borderRadius: "6px", color: "var(--accent-green)" }} className="mono">
              SPOT: ₹{meta.underlyingSpotPrice.toFixed(2)}
            </div>
            <div style={{ fontSize: "11px", background: "rgba(255,184,0,0.1)", border: "1px solid #FFB800", padding: "5px 12px", borderRadius: "6px", color: "#FFB800" }} className="mono">
              ATM: {meta.atmStrike} (STEP: {meta.strikeStep})
            </div>
            <div style={{ fontSize: "11px", background: "rgba(0,229,255,0.1)", border: "1px solid var(--accent-cyan)", padding: "5px 12px", borderRadius: "6px", color: "var(--accent-cyan)" }} className="mono">
              {meta.strikesCount} STRIKES · {meta.contractsCount} CONTRACTS
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
            ⚡ Select session params below & click Load Session to initialize research snapshot
          </div>
        )}
      </div>

      {/* QUERY INPUT CONTROLS GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px" }}>
        <div>
          <label style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>UNDERLYING SYMBOL</label>
          <select
            value={form.symbol.toLowerCase()}
            onChange={(e) => {
              const val = e.target.value;
              let secId = "13";
              if (val === "banknifty") secId = "25";
              else if (val === "sensex") secId = "51";
              else if (val === "reliance") secId = "2885";
              else if (val === "hdfcbank") secId = "1333";
              else if (val === "tcs") secId = "11536";
              else if (val === "infy") secId = "1594";
              onChange({ ...form, symbol: val.toUpperCase(), securityId: secId });
            }}
            style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px", fontWeight: 600 }}
          >
            <option value="nifty">NIFTY (13)</option>
            <option value="banknifty">BANKNIFTY (25)</option>
            <option value="sensex">SENSEX (51)</option>
            <option value="reliance">RELIANCE (2885)</option>
            <option value="hdfcbank">HDFCBANK (1333)</option>
            <option value="tcs">TCS (11536)</option>
            <option value="infy">INFY (1594)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>TRADING DATE</label>
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => onChange({ ...form, fromDate: e.target.value, toDate: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px", fontFamily: "var(--font-mono)" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>EXPIRY TYPE</label>
          <select
            value={form.expiryFlag}
            onChange={(e) => onChange({ ...form, expiryFlag: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
          >
            <option value="WEEK">WEEKLY EXPIRY</option>
            <option value="MONTH">MONTHLY EXPIRY</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>TIMEFRAME (TF)</label>
          <select
            value={form.interval}
            onChange={(e) => onChange({ ...form, interval: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
          >
            <option value="1">1 MINUTE (1m)</option>
            <option value="5">5 MINUTES (5m)</option>
            <option value="15">15 MINUTES (15m)</option>
            <option value="60">60 MINUTES (1h)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>STRIKE RANGE</label>
          <select
            value={form.strikeRange}
            onChange={(e) => onChange({ ...form, strikeRange: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
          >
            <option value="ATM-5_ATM+5">ATM-5 ↔ ATM+5 (11 Strikes)</option>
            <option value="ATM-3_ATM+3">ATM-3 ↔ ATM+3 (7 Strikes)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>WORKBENCH MODE</label>
          <select
            value={form.mode}
            onChange={(e) => onChange({ ...form, mode: e.target.value as any })}
            style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--accent-cyan)", fontSize: "12px", fontWeight: 700 }}
          >
            <option value="Replay">MARKET REPLAY</option>
            <option value="Analysis">CHAIN ANALYTICS</option>
            <option value="Backtest">BACKTEST STRATEGY</option>
          </select>
        </div>
      </div>

      {/* ACTION BUTTONS TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={onLoadSession}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 20px",
            background: "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)",
            color: "#0A0D14",
            fontWeight: 800,
            fontSize: "12px",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 14px rgba(0, 229, 255, 0.25)",
          }}
        >
          {loading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
          LOAD SESSION SNAPSHOT
        </button>

        <button
          onClick={onRunAnalysis}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 18px",
            background: "rgba(0, 229, 255, 0.12)",
            color: "var(--accent-cyan)",
            border: "1px solid var(--accent-cyan)",
            fontWeight: 700,
            fontSize: "12px",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <Activity size={14} />
          RUN CHAIN ANALYTICS
        </button>

        <button
          onClick={onRunBacktest}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 18px",
            background: "rgba(255, 184, 0, 0.12)",
            color: "#FFB800",
            border: "1px solid #FFB800",
            fontWeight: 700,
            fontSize: "12px",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <Zap size={14} />
          BACKTEST STRATEGY
        </button>
      </div>
    </div>
  );
};

export default QueryHeaderBar;
