import React, { useState, useEffect, useMemo } from "react";
import { Play, Pause, FastForward, RotateCcw, Clock, Eye, Layers, TrendingUp, BarChart2 } from "lucide-react";

interface MarketReplayViewProps {
  snapshot: any;
  selectedStrikeTag: string;
  onSelectStrikeTag: (tag: string) => void;
}

export const MarketReplayView: React.FC<MarketReplayViewProps> = ({
  snapshot,
  selectedStrikeTag,
  onSelectStrikeTag,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);

  const underlying = snapshot?.underlying || { timestamp: [], spot: [] };
  const timestamps: number[] = underlying.timestamp || snapshot?.strikes?.["ATM"]?.ce?.timestamp || [];
  const spotSeries: number[] = underlying.spot || snapshot?.strikes?.["ATM"]?.ce?.spot || [];
  const maxIdx = Math.max(0, timestamps.length - 1);

  // Playback timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && currentIdx < maxIdx) {
      const intervalMs = 1000 / speed;
      timer = setInterval(() => {
        setCurrentIdx((prev) => {
          if (prev >= maxIdx) {
            setIsPlaying(false);
            return maxIdx;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, currentIdx, maxIdx, speed]);

  // Format date helper
  const formatDate = (timestamp: number) => {
    if (!timestamp) return "-";
    const d = new Date(timestamp * 1000);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Synchronized metrics at currentIdx
  const syncData = useMemo(() => {
    const time = timestamps[currentIdx] || 0;
    const spot = spotSeries[currentIdx] || snapshot?.metadata?.underlyingSpotPrice || 24850;

    const strikesMap = snapshot?.strikes || {};
    const strikeObj = strikesMap[selectedStrikeTag] || strikesMap["ATM"] || {};
    const strikePrice = strikeObj.strikePrice || 24850;

    const ce = strikeObj.ce || {};
    const pe = strikeObj.pe || {};

    const ceClose = ce.close?.[currentIdx] ?? 0;
    const ceOpen = ce.open?.[currentIdx] ?? ceClose;
    const ceHigh = ce.high?.[currentIdx] ?? ceClose;
    const ceLow = ce.low?.[currentIdx] ?? ceClose;
    const ceVol = ce.volume?.[currentIdx] ?? 0;
    const ceOI = ce.oi?.[currentIdx] ?? 0;
    const cePrevOI = currentIdx > 0 ? ce.oi?.[currentIdx - 1] ?? ceOI : ceOI;
    const ceDeltaOI = ceOI - cePrevOI;

    const peClose = pe.close?.[currentIdx] ?? 0;
    const peOpen = pe.open?.[currentIdx] ?? peClose;
    const peHigh = pe.high?.[currentIdx] ?? peClose;
    const peLow = pe.low?.[currentIdx] ?? peClose;
    const peVol = pe.volume?.[currentIdx] ?? 0;
    const peOI = pe.oi?.[currentIdx] ?? 0;
    const pePrevOI = currentIdx > 0 ? pe.oi?.[currentIdx - 1] ?? peOI : peOI;
    const peDeltaOI = peOI - pePrevOI;

    const straddle = Number((ceClose + peClose).toFixed(2));
    const pcr = ceVol > 0 ? (peVol / ceVol).toFixed(2) : "1.00";

    return {
      time,
      spot,
      strikePrice,
      ce: { open: ceOpen, high: ceHigh, low: ceLow, close: ceClose, vol: ceVol, oi: ceOI, deltaOI: ceDeltaOI },
      pe: { open: peOpen, high: peHigh, low: peLow, close: peClose, vol: peVol, oi: peOI, deltaOI: peDeltaOI },
      straddle,
      pcr,
    };
  }, [snapshot, selectedStrikeTag, currentIdx, timestamps, spotSeries]);

  const strikesList = ["ATM-5", "ATM-4", "ATM-3", "ATM-2", "ATM-1", "ATM", "ATM+1", "ATM+2", "ATM+3", "ATM+4", "ATM+5"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* PLAYBACK CONTROLS BAR */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              fontSize: "12px",
              fontWeight: 800,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: isPlaying ? "rgba(255, 73, 92, 0.2)" : "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)",
              color: isPlaying ? "var(--accent-red)" : "#0A0D14",
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "PAUSE REPLAY" : "PLAY REPLAY"}
          </button>

          <button
            onClick={() => setCurrentIdx(0)}
            style={{
              padding: "7px 12px",
              fontSize: "11px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: "white",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
          </button>

          {/* SPEED TOGGLE */}
          <div style={{ display: "flex", gap: "4px", background: "#090C12", padding: "3px", borderRadius: "6px" }}>
            {([1, 2, 5] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background: speed === s ? "var(--bg-card)" : "transparent",
                  color: speed === s ? "var(--accent-cyan)" : "var(--text-muted)",
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* TIME SLIDER SCRUBBER */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px", minWidth: "260px" }}>
          <Clock size={15} color="var(--accent-cyan)" />
          <input
            type="range"
            min="0"
            max={maxIdx}
            value={currentIdx}
            onChange={(e) => setCurrentIdx(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent-cyan)", cursor: "pointer" }}
          />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "white", minWidth: "140px" }} className="mono">
            {formatDate(syncData.time)}
          </span>
        </div>

        {/* STRIKE OFFSETS PILLS */}
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {strikesList.map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectStrikeTag(tag)}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: selectedStrikeTag === tag ? "1px solid var(--accent-cyan)" : "1px solid var(--border-color)",
                background: selectedStrikeTag === tag ? "rgba(0, 229, 255, 0.2)" : "var(--bg-card)",
                color: selectedStrikeTag === tag ? "var(--accent-cyan)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
              className="mono"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* SYNCHRONIZED DASHBOARD PANELS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px" }}>
        {/* LEFT: MULTI-PANEL SYNCHRONIZED VISUALIZER */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* PANEL 1: NIFTY SPOT CHART */}
          <div className="glass-card" style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--accent-green)" }}>
                📈 UNDERLYING SPOT ({snapshot?.metadata?.symbol || "NIFTY"})
              </div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "white" }} className="mono">
                ₹{syncData.spot.toFixed(2)}
              </div>
            </div>
            <div style={{ height: "160px", background: "#090C12", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "12px", display: "flex", alignItems: "flex-end", gap: "2px" }}>
              {spotSeries.slice(0, currentIdx + 1).map((val, idx) => {
                const minS = Math.min(...spotSeries);
                const maxS = Math.max(...spotSeries);
                const rangeS = Math.max(1, maxS - minS);
                const heightPct = Math.min(100, Math.max(10, ((val - minS) / rangeS) * 100));
                const isSelected = idx === currentIdx;

                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: `${heightPct}%`,
                      background: isSelected ? "var(--accent-cyan)" : "var(--accent-green)",
                      opacity: isSelected ? 1 : 0.6,
                      borderRadius: "2px",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* PANEL 2: OPTION PRICES (CE VS PE) */}
          <div className="glass-card" style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "white" }}>
                🎯 {selectedStrikeTag} ({syncData.strikePrice}) CE vs PE CONTRACT PRICES
              </div>
              <div style={{ fontSize: "12px", color: "#FFB800" }} className="mono">
                ATM STRADDLE: ₹{syncData.straddle}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ padding: "12px", background: "rgba(0, 245, 160, 0.05)", border: "1px solid rgba(0, 245, 160, 0.2)", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--accent-green)", fontWeight: 700 }}>CE (CALL) PRICE</span>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-green)", marginTop: "4px" }} className="mono">
                  ₹{syncData.ce.close.toFixed(2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }} className="mono">
                  O: ₹{syncData.ce.open.toFixed(1)} | H: ₹{syncData.ce.high.toFixed(1)} | L: ₹{syncData.ce.low.toFixed(1)}
                </div>
              </div>

              <div style={{ padding: "12px", background: "rgba(255, 73, 92, 0.05)", border: "1px solid rgba(255, 73, 92, 0.2)", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--accent-red)", fontWeight: 700 }}>PE (PUT) PRICE</span>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-red)", marginTop: "4px" }} className="mono">
                  ₹{syncData.pe.close.toFixed(2)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }} className="mono">
                  O: ₹{syncData.pe.open.toFixed(1)} | H: ₹{syncData.pe.high.toFixed(1)} | L: ₹{syncData.pe.low.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: SYNCHRONIZED REPLAY TOOLTIP CARD */}
        <div className="glass-card" style={{ padding: "18px", borderRadius: "10px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-cyan)", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
            ⏱️ REPLAY TOOLTIP INSPECTOR
          </div>

          <div style={{ fontSize: "12px", color: "white", fontWeight: 700 }} className="mono">
            TIMESTAMP: {formatDate(syncData.time)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ padding: "10px", background: "var(--bg-primary)", borderRadius: "6px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>SPOT PRICE</span>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--accent-green)" }} className="mono">
                ₹{syncData.spot.toFixed(2)}
              </span>
            </div>

            <div style={{ padding: "10px", background: "rgba(0,245,160,0.06)", border: "1px solid rgba(0,245,160,0.2)", borderRadius: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-green)" }}>{selectedStrikeTag} CE CONTRACT</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px", fontSize: "11px" }} className="mono">
                <div>CLOSE: ₹{syncData.ce.close.toFixed(2)}</div>
                <div>VOL: {syncData.ce.vol.toLocaleString("en-IN")}</div>
                <div>OI: {(syncData.ce.oi / 100000).toFixed(2)}L</div>
                <div style={{ color: syncData.ce.deltaOI >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                  ΔOI: {syncData.ce.deltaOI >= 0 ? "+" : ""}{(syncData.ce.deltaOI / 1000).toFixed(1)}k
                </div>
              </div>
            </div>

            <div style={{ padding: "10px", background: "rgba(255,73,92,0.06)", border: "1px solid rgba(255,73,92,0.2)", borderRadius: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-red)" }}>{selectedStrikeTag} PE CONTRACT</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px", fontSize: "11px" }} className="mono">
                <div>CLOSE: ₹{syncData.pe.close.toFixed(2)}</div>
                <div>VOL: {syncData.pe.vol.toLocaleString("en-IN")}</div>
                <div>OI: {(syncData.pe.oi / 100000).toFixed(2)}L</div>
                <div style={{ color: syncData.pe.deltaOI >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                  ΔOI: {syncData.pe.deltaOI >= 0 ? "+" : ""}{(syncData.pe.deltaOI / 1000).toFixed(1)}k
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ padding: "8px", background: "var(--bg-primary)", borderRadius: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>PCR RATIO</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFB800" }} className="mono">{syncData.pcr}</span>
              </div>
              <div style={{ padding: "8px", background: "var(--bg-primary)", borderRadius: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>STRADDLE</span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-cyan)" }} className="mono">₹{syncData.straddle}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketReplayView;
