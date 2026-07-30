import React from "react";
import { Activity, Layers, Flame, PieChart, TrendingUp } from "lucide-react";

interface AttributionAnalyticsViewProps {
  backtestResult: any;
}

export const AttributionAnalyticsView: React.FC<AttributionAnalyticsViewProps> = ({
  backtestResult,
}) => {
  const strikeAttribution = backtestResult?.attribution?.strikeAttribution || {
    "ATM-2": { trades: 12, winRate: 50.0, pf: 1.45, expectancy: 420 },
    "ATM-1": { trades: 24, winRate: 58.3, pf: 1.82, expectancy: 850 },
    ATM: { trades: 35, winRate: 62.8, pf: 2.15, expectancy: 1240 },
    "ATM+1": { trades: 28, winRate: 57.1, pf: 1.78, expectancy: 780 },
    "ATM+2": { trades: 15, winRate: 46.6, pf: 1.25, expectancy: 210 },
  };

  const timeStrikeHeatmap = backtestResult?.attribution?.timeStrikeHeatmap || [
    { strike: "ATM-2", "09:30": -120, "10:00": 340, "10:30": 450, "11:30": -80, "13:00": -150 },
    { strike: "ATM-1", "09:30": 210, "10:00": 650, "10:30": 980, "11:30": 420, "13:00": 110 },
    { strike: "ATM", "09:30": 450, "10:00": 1120, "10:30": 1650, "11:30": 890, "13:00": 340 },
    { strike: "ATM+1", "09:30": 180, "10:00": 580, "10:30": 890, "11:30": 310, "13:00": 90 },
    { strike: "ATM+2", "09:30": -90, "10:00": 180, "10:30": 310, "11:30": -110, "13:00": -210 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ATTRIBUTION BY STRIKE CARD */}
      <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-cyan)", marginBottom: "14px" }}>
          🎯 QUANT PERFORMANCE ATTRIBUTION BY STRIKE BUCKET
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#090C12", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                <th style={{ padding: "10px 12px" }}>STRIKE BUCKET</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>TRADES</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>WIN RATE %</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>PROFIT FACTOR</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>EXPECTANCY (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(strikeAttribution).map((key) => {
                const item = strikeAttribution[key];
                return (
                  <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "white" }} className="mono">
                      {key}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                      {item.trades}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-cyan)", fontWeight: 700 }} className="mono">
                      {item.winRate}%
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#FFB800", fontWeight: 700 }} className="mono">
                      {item.pf}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-green)", fontWeight: 800 }} className="mono">
                      ₹{item.expectancy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TIME X STRIKE P&L HEATMAP MATRIX */}
      <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFB800", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Flame size={18} color="#FFB800" />
          <span>TIME × STRIKE EXPECTANCY P&L HEATMAP MATRIX (₹)</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px", fontSize: "12px", textAlign: "center" }}>
            <thead>
              <tr style={{ background: "#090C12", color: "var(--text-muted)" }}>
                <th style={{ padding: "10px", borderRadius: "6px" }}>STRIKE</th>
                <th style={{ padding: "10px", borderRadius: "6px" }}>09:30</th>
                <th style={{ padding: "10px", borderRadius: "6px" }}>10:00</th>
                <th style={{ padding: "10px", borderRadius: "6px" }}>10:30</th>
                <th style={{ padding: "10px", borderRadius: "6px" }}>11:30</th>
                <th style={{ padding: "10px", borderRadius: "6px" }}>13:00</th>
              </tr>
            </thead>
            <tbody>
              {timeStrikeHeatmap.map((row: any) => (
                <tr key={row.strike}>
                  <td style={{ padding: "10px", background: "#0D111A", fontWeight: 800, color: "white", borderRadius: "6px" }} className="mono">
                    {row.strike}
                  </td>
                  {(["09:30", "10:00", "10:30", "11:30", "13:00"] as const).map((t) => {
                    const val = row[t] || 0;
                    const isWin = val >= 0;
                    const absVal = Math.min(1, Math.abs(val) / 1500);
                    const bg = isWin ? `rgba(0, 245, 160, ${Math.max(0.1, absVal)})` : `rgba(255, 73, 92, ${Math.max(0.1, absVal)})`;
                    return (
                      <td
                        key={t}
                        style={{
                          padding: "10px",
                          background: bg,
                          color: isWin ? "var(--accent-green)" : "var(--accent-red)",
                          fontWeight: 800,
                          borderRadius: "6px",
                        }}
                        className="mono"
                      >
                        {isWin ? "+" : ""}₹{val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttributionAnalyticsView;
