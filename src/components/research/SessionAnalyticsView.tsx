import React from "react";
import { Activity, ShieldAlert, Award, TrendingUp, Layers, Compass } from "lucide-react";

interface SessionAnalyticsViewProps {
  snapshot: any;
  analyticsData?: any;
}

export const SessionAnalyticsView: React.FC<SessionAnalyticsViewProps> = ({
  snapshot,
  analyticsData,
}) => {
  const session = analyticsData?.sessionSummary || {
    spotStart: 24850,
    spotEnd: 24910,
    spotHigh: 24940,
    spotLow: 24820,
    spotRange: 120,
    spotReturnPct: +0.24,
    regimeTag: "TRENDING UP",
    pcrVolume: 1.15,
    pcrOI: 1.28,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* SESSION SUMMARY REPORT CARD */}
      <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={18} color="var(--accent-cyan)" />
            <span>SESSION STRUCTURE & REGIME ANALYSIS REPORT</span>
          </div>

          <div style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(0, 245, 160, 0.15)", border: "1px solid var(--accent-green)", color: "var(--accent-green)", fontWeight: 800, fontSize: "12px" }}>
            REGIME: {session.regimeTag}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
          <div style={{ padding: "12px", background: "var(--bg-primary)", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>SPOT OPEN / CLOSE</span>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "white" }} className="mono">
              ₹{session.spotStart.toFixed(1)} / ₹{session.spotEnd.toFixed(1)}
            </span>
          </div>

          <div style={{ padding: "12px", background: "var(--bg-primary)", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>SPOT DAY HIGH / LOW</span>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--accent-green)" }} className="mono">
              ₹{session.spotHigh.toFixed(1)} / ₹{session.spotLow.toFixed(1)}
            </span>
          </div>

          <div style={{ padding: "12px", background: "var(--bg-primary)", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>INTRADAY RANGE (PTS)</span>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--accent-cyan)" }} className="mono">
              {session.spotRange.toFixed(1)} pts ({session.spotReturnPct >= 0 ? "+" : ""}{session.spotReturnPct}%)
            </span>
          </div>

          <div style={{ padding: "12px", background: "var(--bg-primary)", borderRadius: "8px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>VOLUME & OI PCR</span>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#FFB800" }} className="mono">
              {session.pcrVolume} (Vol) / {session.pcrOI} (OI)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionAnalyticsView;
