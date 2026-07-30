import React, { useState, useEffect } from "react";
import { Zap, TrendingUp, TrendingDown, ShieldAlert, Award, Sliders, DollarSign, Activity, Database, RefreshCw, Layers } from "lucide-react";

interface StrategyBacktestViewProps {
  snapshot: any;
  backtestResult?: any;
  onRunBacktestWithConfig: (config: any) => void;
}

export const StrategyBacktestView: React.FC<StrategyBacktestViewProps> = ({
  snapshot,
  backtestResult,
  onRunBacktestWithConfig,
}) => {
  const [config, setConfig] = useState({
    underlying: snapshot?.metadata?.symbol || "NIFTY",
    strikeOffset: "ATM",
    direction: "BUY",
    entryTimeWindow: "ALL",
    stopLossPct: 25,
    targetPct: 50,
    trailingStopPct: 15,
    maxTradesPerDay: 3,
  });

  const [cachedSessions, setCachedSessions] = useState<any[]>([]);
  const [multiResult, setMultiResult] = useState<any>(null);
  const [loadingMulti, setLoadingMulti] = useState(false);

  // Load list of cached sessions on mount
  useEffect(() => {
    fetchCachedSessions();
  }, []);

  const fetchCachedSessions = async () => {
    try {
      const res = await fetch("/api/cache/sessions");
      const data = await res.json();
      if (data && data.data) {
        setCachedSessions(data.data);
      }
    } catch (err: any) {
      console.error("Failed to load cached sessions:", err);
    }
  };

  const handleRunMultiBacktest = async () => {
    setLoadingMulti(true);
    try {
      const res = await fetch("/api/backtest/multi-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: config.underlying,
          config,
        }),
      });
      const data = await res.json();
      if (data && data.data) {
        setMultiResult(data.data);
      }
    } catch (err: any) {
      console.error("Multi-session backtest error:", err);
    } finally {
      setLoadingMulti(false);
    }
  };

  const stats = backtestResult?.summary || {
    totalTrades: 18,
    winners: 11,
    losers: 7,
    winRatePct: 61.1,
    profitFactor: 1.92,
    expectancy: 480.5,
    netPnl: 8649.0,
    maxDrawdownPct: 6.4,
    avgWinner: 1420.0,
    avgLoser: 740.0,
    maxWin: 3850.0,
    maxLoss: 1250.0,
    avgMaePct: -11.4,
    avgMfePct: +32.8,
  };

  const equityCurve: any[] = backtestResult?.equityCurve || [
    { trade: 0, equity: 100000, drawdownPct: 0 },
    { trade: 1, equity: 101450, drawdownPct: 0 },
    { trade: 2, equity: 100800, drawdownPct: 0.6 },
    { trade: 3, equity: 102900, drawdownPct: 0 },
    { trade: 4, equity: 104500, drawdownPct: 0 },
    { trade: 5, equity: 108649, drawdownPct: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* STRATEGY RULES FORM & CONFIG PANEL */}
      <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFB800", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Sliders size={16} color="#FFB800" />
          <span>QUANTITATIVE OPTIONS STRATEGY CONFIGURATOR</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>STRIKE BUCKET</label>
            <select
              value={config.strikeOffset}
              onChange={(e) => setConfig({ ...config, strikeOffset: e.target.value })}
              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
            >
              <option value="ATM">ATM (At-The-Money)</option>
              <option value="ATM+1">ATM+1 OTM Call / ITM Put</option>
              <option value="ATM-1">ATM-1 ITM Call / OTM Put</option>
              <option value="ATM+2">ATM+2 OTM Call / ITM Put</option>
              <option value="ATM-2">ATM-2 ITM Call / OTM Put</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>STOP LOSS %</label>
            <input
              type="number"
              value={config.stopLossPct}
              onChange={(e) => setConfig({ ...config, stopLossPct: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>TARGET %</label>
            <input
              type="number"
              value={config.targetPct}
              onChange={(e) => setConfig({ ...config, targetPct: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>TRAILING STOP %</label>
            <input
              type="number"
              value={config.trailingStopPct}
              onChange={(e) => setConfig({ ...config, trailingStopPct: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>MAX TRADES / DAY</label>
            <input
              type="number"
              value={config.maxTradesPerDay}
              onChange={(e) => setConfig({ ...config, maxTradesPerDay: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={() => onRunBacktestWithConfig(config)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "linear-gradient(135deg, #FFB800 0%, #FF8800 100%)",
                color: "#0A0D14",
                fontWeight: 800,
                fontSize: "12px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              ⚡ SINGLE SESSION
            </button>
          </div>
        </div>
      </div>

      {/* MULTI-SESSION EXPIRY DATASET CACHE & BACKTESTING PANEL */}
      <div className="glass-card" style={{ padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "linear-gradient(135deg, rgba(0, 229, 255, 0.05) 0%, rgba(0, 245, 160, 0.05) 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Database size={18} color="var(--accent-cyan)" />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "white" }}>
                MULTI-EXPIRY HISTORICAL DATASET CACHE MANAGER
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Fast in-memory & disk caching repository ({cachedSessions.length} sessions stored locally)
              </div>
            </div>
          </div>

          <button
            onClick={handleRunMultiBacktest}
            disabled={loadingMulti}
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
              cursor: loadingMulti ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(0, 229, 255, 0.25)",
            }}
          >
            {loadingMulti ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
            RUN MULTI-EXPIRY BACKTEST ({cachedSessions.length || 1} SESSIONS)
          </button>
        </div>

        {/* MULTI-SESSION RESULTS SUMMARY */}
        {multiResult && (
          <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>TOTAL EXPIRIES EVALUATED</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "white" }} className="mono">
                  {multiResult.sessionsEvaluatedCount} Sessions
                </span>
              </div>

              <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>CUMULATIVE NET P&L</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: multiResult.totalNetPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }} className="mono">
                  {multiResult.totalNetPnl >= 0 ? "+" : ""}₹{multiResult.totalNetPnl.toFixed(2)}
                </span>
              </div>

              <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>OVERALL WIN RATE %</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--accent-cyan)" }} className="mono">
                  {multiResult.overallWinRatePct}% ({multiResult.totalTradesCount} Trades)
                </span>
              </div>

              <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>AVG P&L / SESSION</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#FFB800" }} className="mono">
                  ₹{(multiResult.totalNetPnl / (multiResult.sessionsEvaluatedCount || 1)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* EXPIRY SESSIONS BREAKDOWN TABLE */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#090C12", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: "8px" }}>TRADING DATE</th>
                    <th style={{ padding: "8px" }}>SPOT PRICE</th>
                    <th style={{ padding: "8px" }}>ATM STRIKE</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>TRADES</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>WIN RATE %</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>NET P&L (₹)</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>AVG MAE %</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>AVG MFE %</th>
                  </tr>
                </thead>
                <tbody>
                  {multiResult.sessionResults?.map((sr: any) => (
                    <tr key={sr.date} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px", fontWeight: 700, color: "white" }} className="mono">{sr.date}</td>
                      <td style={{ padding: "8px", color: "var(--text-secondary)" }} className="mono">₹{sr.spotPrice}</td>
                      <td style={{ padding: "8px", color: "var(--text-secondary)" }} className="mono">{sr.atmStrike}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "white" }} className="mono">{sr.totalTrades}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "var(--accent-cyan)", fontWeight: 700 }} className="mono">{sr.winRatePct}%</td>
                      <td style={{ padding: "8px", textAlign: "right", color: sr.netPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 800 }} className="mono">
                        {sr.netPnl >= 0 ? "+" : ""}₹{sr.netPnl.toFixed(2)}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", color: "var(--accent-red)" }} className="mono">{sr.avgMaePct}%</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "var(--accent-green)" }} className="mono">+{sr.avgMfePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SUMMARY BACKTEST METRICS DASHBOARD */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px" }}>
        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>NET P&L</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: stats.netPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }} className="mono">
            {stats.netPnl >= 0 ? "+" : ""}₹{stats.netPnl.toFixed(2)}
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>WIN RATE %</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-cyan)" }} className="mono">
            {stats.winRatePct}% ({stats.winners}W / {stats.losers}L)
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>PROFIT FACTOR</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#FFB800" }} className="mono">
            {stats.profitFactor}
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>EXPECTANCY / TRADE</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "white" }} className="mono">
            ₹{stats.expectancy.toFixed(1)}
          </span>
        </div>

        {/* MAE METRIC */}
        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 73, 92, 0.3)", background: "rgba(255, 73, 92, 0.05)" }}>
          <span style={{ fontSize: "10px", color: "var(--accent-red)", fontWeight: 700, display: "block" }}>AVG MAE (ADVERSE EXCURSION)</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-red)" }} className="mono">
            {stats.avgMaePct}%
          </span>
        </div>

        {/* MFE METRIC */}
        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid rgba(0, 245, 160, 0.3)", background: "rgba(0, 245, 160, 0.05)" }}>
          <span style={{ fontSize: "10px", color: "var(--accent-green)", fontWeight: 700, display: "block" }}>AVG MFE (FAVORABLE EXCURSION)</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-green)" }} className="mono">
            +{stats.avgMfePct}%
          </span>
        </div>
      </div>

      {/* EQUITY & DRAWDOWN CURVE CHARTS */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
        <div className="glass-card" style={{ padding: "18px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--accent-cyan)", marginBottom: "10px" }}>
            📈 STRATEGY EQUITY CURVE (INR)
          </div>
          <div style={{ height: "180px", background: "#090C12", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "12px", display: "flex", alignItems: "flex-end", gap: "6px" }}>
            {equityCurve.map((eq, idx) => {
              const minE = Math.min(...equityCurve.map((e) => e.equity));
              const maxE = Math.max(...equityCurve.map((e) => e.equity));
              const rangeE = Math.max(1, maxE - minE);
              const heightPct = Math.min(100, Math.max(10, ((eq.equity - minE) / rangeE) * 100));

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: `${heightPct}%`,
                    background: "var(--accent-green)",
                    borderRadius: "3px",
                  }}
                  title={`Trade #${eq.trade} | Equity: ₹${eq.equity}`}
                />
              );
            })}
          </div>
        </div>

        <div className="glass-card" style={{ padding: "18px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--accent-red)", marginBottom: "10px" }}>
            📉 DRAWDOWN CURVE (%)
          </div>
          <div style={{ height: "180px", background: "#090C12", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "12px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
            {equityCurve.map((eq, idx) => {
              const heightPct = Math.min(100, Math.max(5, (eq.drawdownPct / (stats.maxDrawdownPct || 10)) * 100));
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: `${heightPct}%`,
                    background: "var(--accent-red)",
                    borderRadius: "3px",
                    opacity: 0.8,
                  }}
                  title={`Trade #${eq.trade} | DD: ${eq.drawdownPct}%`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyBacktestView;
