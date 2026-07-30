import React from "react";
import { TrendingUp, Layers, Activity, DollarSign, ShieldAlert } from "lucide-react";

interface PremiumAnalyticsViewProps {
  snapshot: any;
  analyticsData?: any;
}

export const PremiumAnalyticsView: React.FC<PremiumAnalyticsViewProps> = ({
  snapshot,
  analyticsData,
}) => {
  const straddleInfo = analyticsData?.straddleAnalytics;
  const straddleSeries: any[] = straddleInfo?.straddleSeries || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ATM STRADDLE KPI CARDS BAR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>ATM STRADDLE STRIKE</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "white" }} className="mono">
            {straddleInfo?.atmStrike || snapshot?.metadata?.atmStrike || 24850}
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>OPEN STRADDLE PREMIUM</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-green)" }} className="mono">
            ₹{straddleInfo?.startPrice?.toFixed(2) || "105.00"}
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>LAST STRADDLE PREMIUM</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-cyan)" }} className="mono">
            ₹{straddleInfo?.lastPrice?.toFixed(2) || "14.55"}
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>STRADDLE HIGH / LOW</span>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "white" }} className="mono">
            ₹{straddleInfo?.maxHigh?.toFixed(1) || "-"} / ₹{straddleInfo?.minLow?.toFixed(1) || "-"}
          </span>
        </div>

        <div className="glass-card" style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>MAX PREMIUM DECAY %</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--accent-red)" }} className="mono">
            -{straddleInfo?.maxDrawdownPct?.toFixed(1) || "86.1"}%
          </span>
        </div>
      </div>

      {/* ATM STRADDLE DECAY CHART */}
      <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-cyan)", marginBottom: "12px" }}>
          📉 INTRADAY ATM STRADDLE (CE + PE) PREMIUM DECAY SERIES
        </div>

        <div style={{ height: "240px", background: "#090C12", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "16px", display: "flex", alignItems: "flex-end", gap: "3px" }}>
          {straddleSeries.map((s, idx) => {
            const maxVal = Math.max(...straddleSeries.map((item) => item.straddlePrice));
            const minVal = Math.min(...straddleSeries.map((item) => item.straddlePrice));
            const range = Math.max(1, maxVal - minVal);
            const heightPct = Math.min(100, Math.max(8, ((s.straddlePrice - minVal) / range) * 100));

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${heightPct}%`,
                  background: "linear-gradient(180deg, #00E5FF 0%, #00F5A0 100%)",
                  borderRadius: "3px",
                  opacity: 0.85,
                }}
                title={`Time: ${new Date(s.time * 1000).toLocaleTimeString()} | Straddle: ₹${s.straddlePrice}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PremiumAnalyticsView;
