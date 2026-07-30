import React, { useState, useMemo } from "react";
import { Flame, Layers, Activity, Sliders, Filter } from "lucide-react";

interface TimeStrikeHeatmapViewProps {
  snapshot: any;
  analyticsData?: any;
}

export const TimeStrikeHeatmapView: React.FC<TimeStrikeHeatmapViewProps> = ({
  snapshot,
  analyticsData,
}) => {
  const [metric, setMetric] = useState<"return" | "oi" | "volume" | "buildup">("return");
  const [optionSide, setOptionSide] = useState<"CE" | "PE">("CE");

  const underlying = snapshot?.underlying || { timestamp: [], spot: [] };
  const timestamps: number[] = underlying.timestamp || snapshot?.strikes?.["ATM"]?.ce?.timestamp || [];

  const offsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

  // Helper to compute heatmap cell values & styles
  const getCellData = (strikeTag: string, timeIdx: number) => {
    const strikeObj = snapshot?.strikes?.[strikeTag];
    if (!strikeObj) return { text: "-", color: "transparent", bg: "transparent" };

    const targetObj = optionSide === "CE" ? strikeObj.ce : strikeObj.pe;
    if (!targetObj || !targetObj.close) return { text: "-", color: "var(--text-muted)", bg: "transparent" };

    const closeArr = targetObj.close || [];
    const openArr = targetObj.open || [];
    const volArr = targetObj.volume || [];
    const oiArr = targetObj.oi || [];

    const closeVal = closeArr[timeIdx] || 0;
    const openVal = openArr[0] || closeVal;
    const volVal = volArr[timeIdx] || 0;
    const oiVal = oiArr[timeIdx] || 0;

    const returnPct = openVal > 0 ? ((closeVal - openVal) / openVal) * 100 : 0;

    if (metric === "return") {
      const text = `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(0)}%`;
      const absPct = Math.min(100, Math.abs(returnPct));
      const bg =
        returnPct >= 0
          ? `rgba(0, 245, 160, ${Math.max(0.1, absPct / 100)})`
          : `rgba(255, 73, 92, ${Math.max(0.1, absPct / 100)})`;
      const color = returnPct >= 0 ? "var(--accent-green)" : "var(--accent-red)";
      return { text, color, bg };
    } else if (metric === "volume") {
      const text = (volVal / 1000).toFixed(0) + "k";
      const bg = `rgba(0, 229, 255, ${Math.min(0.8, Math.max(0.1, volVal / 1000000))})`;
      return { text, color: "var(--accent-cyan)", bg };
    } else if (metric === "oi") {
      const text = (oiVal / 100000).toFixed(1) + "L";
      const bg = `rgba(255, 184, 0, ${Math.min(0.8, Math.max(0.1, oiVal / 2000000))})`;
      return { text, color: "#FFB800", bg };
    } else {
      const prevClose = timeIdx > 0 ? closeArr[timeIdx - 1] : openVal;
      const prevOI = timeIdx > 0 ? oiArr[timeIdx - 1] || oiVal : oiVal;
      const pDiff = closeVal - prevClose;
      const oiDiff = oiVal - prevOI;

      let text = "N";
      let bg = "rgba(255,255,255,0.05)";
      let color = "var(--text-muted)";

      if (pDiff > 0 && oiDiff >= 0) {
        text = "LB";
        bg = "rgba(0, 245, 160, 0.35)";
        color = "var(--accent-green)";
      } else if (pDiff < 0 && oiDiff >= 0) {
        text = "SB";
        bg = "rgba(255, 73, 92, 0.35)";
        color = "var(--accent-red)";
      } else if (pDiff > 0 && oiDiff < 0) {
        text = "SC";
        bg = "rgba(0, 229, 255, 0.35)";
        color = "var(--accent-cyan)";
      } else if (pDiff < 0 && oiDiff < 0) {
        text = "LU";
        bg = "rgba(255, 184, 0, 0.35)";
        color = "#FFB800";
      }

      return { text, color, bg };
    }
  };

  const formatDateShort = (timestamp: number) => {
    if (!timestamp) return "-";
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* HEATMAP CONTROLS BAR */}
      <div
        className="glass-card"
        style={{
          padding: "14px 20px",
          borderRadius: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Flame size={18} color="var(--accent-cyan)" />
          <span style={{ fontSize: "14px", fontWeight: 800, color: "white" }}>
            TIME × STRIKE OPTION HEATMAP MATRIX
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* OPTION SIDE TOGGLE */}
          <div style={{ display: "flex", gap: "4px", background: "#090C12", padding: "3px", borderRadius: "6px" }}>
            <button
              onClick={() => setOptionSide("CE")}
              style={{
                padding: "4px 12px",
                fontSize: "11px",
                fontWeight: 700,
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: optionSide === "CE" ? "rgba(0, 245, 160, 0.2)" : "transparent",
                color: optionSide === "CE" ? "var(--accent-green)" : "var(--text-muted)",
              }}
            >
              CALLS (CE)
            </button>
            <button
              onClick={() => setOptionSide("PE")}
              style={{
                padding: "4px 12px",
                fontSize: "11px",
                fontWeight: 700,
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: optionSide === "PE" ? "rgba(255, 73, 92, 0.2)" : "transparent",
                color: optionSide === "PE" ? "var(--accent-red)" : "var(--text-muted)",
              }}
            >
              PUTS (PE)
            </button>
          </div>

          {/* METRIC SELECTOR */}
          <div style={{ display: "flex", gap: "4px", background: "#090C12", padding: "3px", borderRadius: "6px" }}>
            {(["return", "volume", "oi", "buildup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background: metric === m ? "var(--bg-card)" : "transparent",
                  color: metric === m ? "var(--accent-cyan)" : "var(--text-muted)",
                  textTransform: "uppercase",
                }}
              >
                {m === "return" ? "RETURN %" : m === "volume" ? "VOLUME" : m === "oi" ? "OI" : "BUILDUP"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HEATMAP MATRIX GRID TABLE */}
      <div
        style={{
          overflowX: "auto",
          background: "var(--bg-card)",
          borderRadius: "10px",
          border: "1px solid var(--border-color)",
          padding: "12px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "3px", fontSize: "11px", textAlign: "center" }}>
          <thead>
            <tr>
              <th style={{ padding: "8px", background: "#090C12", color: "var(--text-muted)", borderRadius: "4px", minWidth: "90px" }}>
                STRIKE
              </th>
              {timestamps.map((t, idx) => (
                <th key={idx} style={{ padding: "6px 4px", background: "#090C12", color: "var(--text-secondary)", borderRadius: "4px", minWidth: "45px" }} className="mono">
                  {formatDateShort(t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offsets.map((off) => {
              const tag = off === 0 ? "ATM" : off > 0 ? `ATM+${off}` : `ATM${off}`;
              const strikePrice = (snapshot?.metadata?.atmStrike || 24850) + off * (snapshot?.metadata?.strikeStep || 50);
              const isAtm = off === 0;

              return (
                <tr key={tag}>
                  <td
                    style={{
                      padding: "8px 10px",
                      background: isAtm ? "rgba(255, 184, 0, 0.15)" : "#0D111A",
                      border: isAtm ? "1px solid #FFB800" : "1px solid var(--border-color)",
                      color: isAtm ? "#FFB800" : "white",
                      fontWeight: 800,
                      borderRadius: "4px",
                    }}
                    className="mono"
                  >
                    {strikePrice} ({tag})
                  </td>

                  {timestamps.map((_, timeIdx) => {
                    const cell = getCellData(tag, timeIdx);
                    return (
                      <td
                        key={timeIdx}
                        style={{
                          padding: "6px 2px",
                          background: cell.bg,
                          color: cell.color,
                          fontWeight: 700,
                          borderRadius: "4px",
                          border: "1px solid rgba(255,255,255,0.04)",
                        }}
                        className="mono"
                      >
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimeStrikeHeatmapView;
