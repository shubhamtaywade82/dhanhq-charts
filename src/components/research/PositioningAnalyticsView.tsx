import React from "react";
import { Activity, TrendingUp, TrendingDown, Layers, PieChart } from "lucide-react";

interface PositioningAnalyticsViewProps {
  snapshot: any;
  analyticsData?: any;
}

export const PositioningAnalyticsView: React.FC<PositioningAnalyticsViewProps> = ({
  snapshot,
  analyticsData,
}) => {
  const buildup = analyticsData?.buildupSummary || {
    ce: { longBuildupPct: 18.0, shortBuildupPct: 47.0, shortCoveringPct: 21.0, longUnwindingPct: 14.0 },
    pe: { longBuildupPct: 41.0, shortBuildupPct: 19.0, shortCoveringPct: 25.0, longUnwindingPct: 15.0 },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* BUILDUP CLASSIFICATION DISTRIBUTION CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* CALL SIDE BUILDUP */}
        <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-green)", marginBottom: "14px" }}>
            📈 CALL SIDE (CE) POSITIONING & BUILDUP DISTRIBUTION
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "var(--accent-green)" }}>LONG BUILDUP (Price ↑, OI ↑)</span>
                <span style={{ color: "white" }}>{buildup.ce.longBuildupPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.ce.longBuildupPct}%`, height: "100%", background: "var(--accent-green)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "var(--accent-red)" }}>SHORT BUILDUP (Price ↓, OI ↑)</span>
                <span style={{ color: "white" }}>{buildup.ce.shortBuildupPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.ce.shortBuildupPct}%`, height: "100%", background: "var(--accent-red)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "var(--accent-cyan)" }}>SHORT COVERING (Price ↑, OI ↓)</span>
                <span style={{ color: "white" }}>{buildup.ce.shortCoveringPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.ce.shortCoveringPct}%`, height: "100%", background: "var(--accent-cyan)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "#FFB800" }}>LONG UNWINDING (Price ↓, OI ↓)</span>
                <span style={{ color: "white" }}>{buildup.ce.longUnwindingPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.ce.longUnwindingPct}%`, height: "100%", background: "#FFB800", borderRadius: "4px" }} />
              </div>
            </div>
          </div>
        </div>

        {/* PUT SIDE BUILDUP */}
        <div className="glass-card" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-red)", marginBottom: "14px" }}>
            📉 PUT SIDE (PE) POSITIONING & BUILDUP DISTRIBUTION
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "var(--accent-green)" }}>LONG BUILDUP (Price ↑, OI ↑)</span>
                <span style={{ color: "white" }}>{buildup.pe.longBuildupPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.pe.longBuildupPct}%`, height: "100%", background: "var(--accent-green)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "var(--accent-red)" }}>SHORT BUILDUP (Price ↓, OI ↑)</span>
                <span style={{ color: "white" }}>{buildup.pe.shortBuildupPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.pe.shortBuildupPct}%`, height: "100%", background: "var(--accent-red)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "var(--accent-cyan)" }}>SHORT COVERING (Price ↑, OI ↓)</span>
                <span style={{ color: "white" }}>{buildup.pe.shortCoveringPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.pe.shortCoveringPct}%`, height: "100%", background: "var(--accent-cyan)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                <span style={{ color: "#FFB800" }}>LONG UNWINDING (Price ↓, OI ↓)</span>
                <span style={{ color: "white" }}>{buildup.pe.longUnwindingPct}%</span>
              </div>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={{ width: `${buildup.pe.longUnwindingPct}%`, height: "100%", background: "#FFB800", borderRadius: "4px" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositioningAnalyticsView;
