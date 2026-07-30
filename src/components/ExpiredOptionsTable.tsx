import React, { useState, useMemo } from "react";
import {
  Download,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  Table,
  Clock,
  Sliders,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
} from "lucide-react";

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface SpotInfo {
  spot: number;
  step: number;
  atmStrike: number;
  calculatedStrike: number;
  offset: number;
  moneynessTag: string;
  diffFromSpot: number;
  diffPct: number;
}

export interface ExpiredOptionsTableProps {
  candles: CandlePoint[];
  symbol: string;
  strike: string;
  optionType: string;
  spotInfo?: SpotInfo;
  allStrikesData?: Record<
    string,
    {
      offset: number;
      strikePrice: number;
      ce?: { timestamp: number[]; open: number[]; high: number[]; low: number[]; close: number[]; volume: number[]; oi?: number[] } | null;
      pe?: { timestamp: number[]; open: number[]; high: number[]; low: number[]; close: number[]; volume: number[]; oi?: number[] } | null;
    }
  >;
}

export const ExpiredOptionsTable: React.FC<ExpiredOptionsTableProps> = ({
  candles,
  symbol,
  strike,
  optionType,
  spotInfo,
  allStrikesData,
}) => {
  const [viewMode, setViewMode] = useState<"MATRIX" | "TIMESERIES" | "HEATMAP">("MATRIX");
  const [activeOptionTypeTab, setActiveOptionTypeTab] = useState<"CALL" | "PUT">((optionType as any) || "CALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "BULLISH" | "BEARISH">("ALL");
  const [sortField, setSortField] = useState<"time" | "open" | "high" | "low" | "close" | "volume" | "oi" | "intrinsic" | "extrinsic">("time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedTimeIdx, setSelectedTimeIdx] = useState<number>(0);

  const spotVal = spotInfo?.spot || 24850;
  const atmStrike = spotInfo?.atmStrike || 24850;
  const strikeStep = spotInfo?.step || 50;

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

  // Timestamps list across candles
  const timestamps = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return candles.map((c) => c.time);
  }, [candles]);

  // Max volume & Max OI across current candle set
  const maxVolume = useMemo(() => {
    if (!candles || candles.length === 0) return 1;
    return Math.max(...candles.map((c) => c.volume || 1));
  }, [candles]);

  const maxOI = useMemo(() => {
    if (!candles || candles.length === 0) return 1;
    return Math.max(...candles.map((c) => c.oi || 1));
  }, [candles]);

  // Calculate Intrinsic & Extrinsic Values for a candle using ITS HISTORICAL SPOT CLOSE PRICE AT THAT TIMESTAMP
  const calculateOptionGreeks = (c: CandlePoint & { spot?: number }, optType: string, targetStrike: number) => {
    const historicalSpot = c.spot && c.spot > 0 ? c.spot : spotVal;
    const intrinsic = optType === "CALL" ? Math.max(0, historicalSpot - targetStrike) : Math.max(0, targetStrike - historicalSpot);
    const extrinsic = Math.max(0, c.close - intrinsic);
    const moneyness =
      targetStrike === atmStrike
        ? "ATM"
        : optType === "CALL"
        ? targetStrike < historicalSpot
          ? "ITM"
          : "OTM"
        : targetStrike > historicalSpot
        ? "ITM"
        : "OTM";
    return { historicalSpot, intrinsic, extrinsic, moneyness };
  };

  // Enriched Timeseries candle points
  const enrichedCandles = useMemo(() => {
    const targetStrikeNum = spotInfo?.calculatedStrike || atmStrike;
    return candles.map((c) => {
      const greeks = calculateOptionGreeks(c, activeOptionTypeTab, targetStrikeNum);
      const isBullish = c.close >= c.open;
      const change = c.close - c.open;
      const pChange = c.open !== 0 ? (change / c.open) * 100 : 0;
      const range = c.high - c.low;
      return {
        ...c,
        ...greeks,
        isBullish,
        change,
        pChange,
        range,
      };
    });
  }, [candles, spotVal, atmStrike, spotInfo, activeOptionTypeTab]);

  // Filter & Sort enriched candles
  const processedCandles = useMemo(() => {
    let list = [...enrichedCandles];

    if (filterType === "BULLISH") {
      list = list.filter((c) => c.isBullish);
    } else if (filterType === "BEARISH") {
      list = list.filter((c) => !c.isBullish);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const dateStr = formatDate(c.time).toLowerCase();
        return dateStr.includes(q) || c.close.toString().includes(q) || c.volume.toString().includes(q);
      });
    }

    list.sort((a, b) => {
      let valA = (a as any)[sortField] ?? 0;
      let valB = (b as any)[sortField] ?? 0;
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [enrichedCandles, filterType, searchQuery, sortField, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(processedCandles.length / pageSize) || 1;
  const paginatedCandles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedCandles.slice(start, start + pageSize);
  }, [processedCandles, currentPage, pageSize]);

  // Calculate Option Chain Matrix Snapshot across all strikes (ATM-5 to ATM+5)
  const optionChainMatrix = useMemo(() => {
    const offsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    let totalCeVol = 0;
    let totalPeVol = 0;
    const timeSpot = (candles[selectedTimeIdx] as any)?.spot || spotVal;

    const rows = offsets.map((off) => {
      const tag = off === 0 ? "ATM" : off > 0 ? `ATM+${off}` : `ATM${off}`;
      const targetStrike = atmStrike + off * strikeStep;
      const strikeData = allStrikesData?.[tag];

      // Extract CE candle at time index
      const ceObj = strikeData?.ce;
      const peObj = strikeData?.pe;
      const idx = Math.min(selectedTimeIdx, (ceObj?.close?.length || 1) - 1);

      const ceClose = ceObj?.close?.[idx] ?? 0;
      const ceOpen = ceObj?.open?.[idx] ?? ceClose;
      const ceHigh = ceObj?.high?.[idx] ?? ceClose;
      const ceLow = ceObj?.low?.[idx] ?? ceClose;
      const ceVol = ceObj?.volume?.[idx] ?? 0;
      const ceOI = ceObj?.oi?.[idx] ?? 0;

      const peClose = peObj?.close?.[idx] ?? 0;
      const peOpen = peObj?.open?.[idx] ?? peClose;
      const peHigh = peObj?.high?.[idx] ?? peClose;
      const peLow = peObj?.low?.[idx] ?? peClose;
      const peVol = peObj?.volume?.[idx] ?? 0;
      const peOI = peObj?.oi?.[idx] ?? 0;

      totalCeVol += ceVol;
      totalPeVol += peVol;

      // Calculate Intrinsic values using Historical Spot Close at this exact timestamp
      const ceIntrinsic = Math.max(0, timeSpot - targetStrike);
      const ceExtrinsic = Math.max(0, ceClose - ceIntrinsic);
      const peIntrinsic = Math.max(0, targetStrike - timeSpot);
      const peExtrinsic = Math.max(0, peClose - peIntrinsic);

      const moneyness =
        off === 0 ? "ATM" : targetStrike < timeSpot ? "ITM (CE) / OTM (PE)" : "OTM (CE) / ITM (PE)";

      return {
        tag,
        off,
        targetStrike,
        moneyness,
        ce: { close: ceClose, open: ceOpen, high: ceHigh, low: ceLow, vol: ceVol, oi: ceOI, intrinsic: ceIntrinsic, extrinsic: ceExtrinsic },
        pe: { close: peClose, open: peOpen, high: peHigh, low: peLow, vol: peVol, oi: peOI, intrinsic: peIntrinsic, extrinsic: peExtrinsic },
      };
    });

    const pcr = totalCeVol > 0 ? (totalPeVol / totalCeVol).toFixed(2) : "1.00";

    return { rows, totalCeVol, totalPeVol, pcr };
  }, [allStrikesData, atmStrike, strikeStep, spotVal, selectedTimeIdx]);

  // Export CSV
  const exportCSV = () => {
    if (!candles || candles.length === 0) return;
    const targetStrike = spotInfo?.calculatedStrike || atmStrike;
    const headers = ["Timestamp,Date (IST),Symbol,Spot Price,Strike,Option Type,Moneyness,Open,High,Low,Close,Change,Range,Intrinsic Value,Extrinsic Value,Volume,Open Interest"];
    const rows = processedCandles.map((c) => {
      return `${c.time},"${formatDate(c.time)}",${symbol},${spotVal},${targetStrike},${activeOptionTypeTab},"${c.moneyness}",${c.open},${c.high},${c.low},${c.close},${c.change.toFixed(2)},${c.range.toFixed(2)},${c.intrinsic.toFixed(2)},${c.extrinsic.toFixed(2)},${c.volume},${c.oi || 0}`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expired_${symbol}_${targetStrike}_${activeOptionTypeTab}_AdvancedSeries.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ADVANCED HEADER & KPI CONTROL BAR */}
      <div
        className="glass-card"
        style={{
          padding: "16px 20px",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          background: "linear-gradient(135deg, rgba(15, 19, 28, 0.95) 0%, rgba(20, 26, 38, 0.95) 100%)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* SCRIP & SPOT PRICE KPI BADGES */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ padding: "8px", background: "rgba(0, 229, 255, 0.12)", borderRadius: "8px", border: "1px solid var(--accent-cyan)" }}>
                <Layers size={18} color="var(--accent-cyan)" />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "white" }}>{symbol.toUpperCase()} EXPIRED OPTIONS MATRIX</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Side-by-Side Call / Put Historical Analytics Engine</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ padding: "6px 12px", background: "rgba(0, 245, 160, 0.1)", border: "1px solid var(--accent-green)", borderRadius: "8px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>SPOT PRICE</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--accent-green)" }} className="mono">
                  ₹{spotVal.toFixed(2)}
                </span>
              </div>

              <div style={{ padding: "6px 12px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>ATM STRIKE</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "white" }} className="mono">
                  {atmStrike}
                </span>
              </div>

              <div style={{ padding: "6px 12px", background: "rgba(255, 184, 0, 0.1)", border: "1px solid #FFB800", borderRadius: "8px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>PUT-CALL RATIO (PCR)</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "#FFB800" }} className="mono">
                  {optionChainMatrix.pcr}
                </span>
              </div>
            </div>
          </div>

          {/* VIEW MODE SWITCHER TABS */}
          <div style={{ display: "flex", gap: "6px", background: "#090C12", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <button
              onClick={() => setViewMode("MATRIX")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 700,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "MATRIX" ? "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)" : "transparent",
                color: viewMode === "MATRIX" ? "#0A0D14" : "var(--text-muted)",
              }}
            >
              <Table size={14} />
              OPTION CHAIN MATRIX
            </button>

            <button
              onClick={() => setViewMode("TIMESERIES")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 700,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "TIMESERIES" ? "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)" : "transparent",
                color: viewMode === "TIMESERIES" ? "#0A0D14" : "var(--text-muted)",
              }}
            >
              <Clock size={14} />
              INTRADAY CANDLE GRID
            </button>

            <button
              onClick={() => setViewMode("HEATMAP")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 700,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "HEATMAP" ? "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)" : "transparent",
                color: viewMode === "HEATMAP" ? "#0A0D14" : "var(--text-muted)",
              }}
            >
              <Flame size={14} />
              VOLUME & OI HEATMAP
            </button>
          </div>
        </div>

        {/* INTRADAY TIME SCRUBBER SLIDER (FOR MATRIX & HEATMAP VIEWS) */}
        {timestamps.length > 0 && (viewMode === "MATRIX" || viewMode === "HEATMAP") && (
          <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "rgba(9, 12, 18, 0.8)", padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--accent-cyan)", fontWeight: 700, minWidth: "180px" }}>
              <Clock size={14} />
              <span>TIME SCRUBBER: {formatDate(timestamps[Math.min(selectedTimeIdx, timestamps.length - 1)])}</span>
            </div>
            <input
              type="range"
              min="0"
              max={timestamps.length - 1}
              value={selectedTimeIdx}
              onChange={(e) => setSelectedTimeIdx(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent-cyan)", cursor: "pointer" }}
            />
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }} className="mono">
              Candle {selectedTimeIdx + 1} / {timestamps.length}
            </span>
          </div>
        )}
      </div>

      {/* VIEW 1: DUAL OPTION CHAIN MATRIX VIEW (SIDE-BY-SIDE CE VS PE) */}
      {viewMode === "MATRIX" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              overflowX: "auto",
              background: "var(--bg-card)",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "center" }}>
              <thead>
                {/* TOP HEADER CATEGORIES */}
                <tr style={{ background: "#06080C", borderBottom: "1px solid var(--border-color)" }}>
                  <th colSpan={5} style={{ padding: "10px", color: "var(--accent-green)", fontSize: "12px", fontWeight: 800, borderRight: "2px solid var(--border-color)" }}>
                    📈 CALL OPTIONS (CE)
                  </th>
                  <th colSpan={3} style={{ padding: "10px", color: "var(--accent-yellow)", fontSize: "12px", fontWeight: 800, borderRight: "2px solid var(--border-color)" }}>
                    🎯 STRIKE MATRIX
                  </th>
                  <th colSpan={5} style={{ padding: "10px", color: "var(--accent-red)", fontSize: "12px", fontWeight: 800 }}>
                    📉 PUT OPTIONS (PE)
                  </th>
                </tr>

                {/* DETAILED COLUMN HEADERS */}
                <tr style={{ background: "#0D111A", borderBottom: "2px solid var(--border-color)", color: "var(--text-muted)", fontSize: "11px" }}>
                  {/* CALLS */}
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>OI</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>VOLUME</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>INTRINSIC (₹)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>EXTRINSIC (₹)</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", borderRight: "2px solid var(--border-color)", color: "var(--accent-green)", fontWeight: 700 }}>
                    CE LTP (₹)
                  </th>

                  {/* STRIKE MIDDLE */}
                  <th style={{ padding: "10px 12px" }}>OFFSET</th>
                  <th style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 800, color: "white" }}>STRIKE</th>
                  <th style={{ padding: "10px 12px", borderRight: "2px solid var(--border-color)" }}>MONEYNESS</th>

                  {/* PUTS */}
                  <th style={{ padding: "10px 14px", textAlign: "left", color: "var(--accent-red)", fontWeight: 700 }}>
                    PE LTP (₹)
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>EXTRINSIC (₹)</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>INTRINSIC (₹)</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>VOLUME</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>OI</th>
                </tr>
              </thead>
              <tbody>
                {optionChainMatrix.rows.map((row) => {
                  const isAtm = row.off === 0;
                  const isItmCe = row.targetStrike < spotVal;
                  const isItmPe = row.targetStrike > spotVal;

                  return (
                    <tr
                      key={row.tag}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                        background: isAtm
                          ? "rgba(255, 184, 0, 0.1)"
                          : isItmCe
                          ? "rgba(0, 245, 160, 0.03)"
                          : isItmPe
                          ? "rgba(255, 73, 92, 0.03)"
                          : "transparent",
                        transition: "background 0.15s ease",
                      }}
                      className="table-row-hover"
                    >
                      {/* CE DATA */}
                      <td style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)" }} className="mono">
                        {(row.ce.oi || 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-cyan)" }} className="mono">
                        {(row.ce.vol || 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: row.ce.intrinsic > 0 ? "var(--accent-green)" : "var(--text-muted)" }} className="mono">
                        ₹{row.ce.intrinsic.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                        ₹{row.ce.extrinsic.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", borderRight: "2px solid var(--border-color)" }} className="mono">
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "5px",
                            fontWeight: 800,
                            fontSize: "12px",
                            background: "rgba(0, 245, 160, 0.15)",
                            color: "var(--accent-green)",
                            border: "1px solid rgba(0, 245, 160, 0.3)",
                          }}
                        >
                          ₹{row.ce.close.toFixed(2)}
                        </span>
                      </td>

                      {/* STRIKE MIDDLE */}
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)" }} className="mono">
                        {row.tag}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 900, fontSize: "14px", color: isAtm ? "#FFB800" : "white" }} className="mono">
                        {row.targetStrike}
                      </td>
                      <td style={{ padding: "10px 12px", borderRight: "2px solid var(--border-color)" }}>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: 700,
                            background: isAtm ? "rgba(255,184,0,0.2)" : isItmCe ? "rgba(0,245,160,0.12)" : "rgba(0,229,255,0.12)",
                            color: isAtm ? "#FFB800" : isItmCe ? "var(--accent-green)" : "var(--accent-cyan)",
                          }}
                        >
                          {isAtm ? "ATM" : isItmCe ? "ITM (CE)" : "ITM (PE)"}
                        </span>
                      </td>

                      {/* PE DATA */}
                      <td style={{ padding: "10px 14px", textAlign: "left" }} className="mono">
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "5px",
                            fontWeight: 800,
                            fontSize: "12px",
                            background: "rgba(255, 73, 92, 0.15)",
                            color: "var(--accent-red)",
                            border: "1px solid rgba(255, 73, 92, 0.3)",
                          }}
                        >
                          ₹{row.pe.close.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-secondary)" }} className="mono">
                        ₹{row.pe.extrinsic.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "left", color: row.pe.intrinsic > 0 ? "var(--accent-red)" : "var(--text-muted)" }} className="mono">
                        ₹{row.pe.intrinsic.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "left", color: "var(--accent-cyan)" }} className="mono">
                        {(row.pe.vol || 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                        {(row.pe.oi || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: INTRADAY CANDLE TIMESERIES GRID VIEW */}
      {viewMode === "TIMESERIES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* TOOLBAR: SEARCH, FILTERS, OPTION TYPE TOGGLE & CSV EXPORT */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "12px 16px",
              background: "var(--bg-card)",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* CALL / PUT SELECTOR */}
              <div style={{ display: "flex", gap: "4px", background: "#090C12", padding: "3px", borderRadius: "6px" }}>
                <button
                  onClick={() => setActiveOptionTypeTab("CALL")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: activeOptionTypeTab === "CALL" ? "rgba(0, 245, 160, 0.2)" : "transparent",
                    color: activeOptionTypeTab === "CALL" ? "var(--accent-green)" : "var(--text-muted)",
                  }}
                >
                  CALLS (CE)
                </button>
                <button
                  onClick={() => setActiveOptionTypeTab("PUT")}
                  style={{
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: activeOptionTypeTab === "PUT" ? "rgba(255, 73, 92, 0.2)" : "transparent",
                    color: activeOptionTypeTab === "PUT" ? "var(--accent-red)" : "var(--text-muted)",
                  }}
                >
                  PUTS (PE)
                </button>
              </div>

              {/* SEARCH INPUT */}
              <div style={{ position: "relative", minWidth: "200px" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search timestamp, price..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 30px",
                    fontSize: "12px",
                    background: "#090C12",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "white",
                  }}
                />
              </div>

              {/* BULLISH / BEARISH FILTER */}
              <div style={{ display: "flex", gap: "4px", background: "#090C12", padding: "3px", borderRadius: "6px" }}>
                {(["ALL", "BULLISH", "BEARISH"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setFilterType(t);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      background: filterType === t ? "var(--bg-card)" : "transparent",
                      color:
                        filterType === t
                          ? t === "BULLISH"
                            ? "var(--accent-green)"
                            : t === "BEARISH"
                            ? "var(--accent-red)"
                            : "var(--accent-cyan)"
                          : "var(--text-muted)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                <span>ROWS:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    background: "#090C12",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    color: "white",
                  }}
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <button
                onClick={exportCSV}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(0, 229, 255, 0.1)",
                  border: "1px solid var(--accent-cyan)",
                  color: "var(--accent-cyan)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <Download size={13} />
                EXPORT CSV
              </button>
            </div>
          </div>

          {/* TIMESERIES TABLE */}
          <div
            style={{
              overflowX: "auto",
              background: "var(--bg-card)",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#090C12", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "10px 12px", width: "40px" }}>#</th>
                  <th onClick={() => { setSortField("time"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      DATE & TIME (IST)
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>SPOT PRICE (₹)</th>
                  <th onClick={() => { setSortField("open"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    OPEN (₹)
                  </th>
                  <th onClick={() => { setSortField("high"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    HIGH (₹)
                  </th>
                  <th onClick={() => { setSortField("low"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    LOW (₹)
                  </th>
                  <th onClick={() => { setSortField("close"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    CLOSE (₹)
                  </th>
                  <th onClick={() => { setSortField("intrinsic"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    INTRINSIC (₹)
                  </th>
                  <th onClick={() => { setSortField("extrinsic"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    EXTRINSIC (₹)
                  </th>
                  <th onClick={() => { setSortField("volume"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    VOLUME
                  </th>
                  <th onClick={() => { setSortField("oi"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }} style={{ padding: "10px 12px", textAlign: "right", cursor: "pointer" }}>
                    OPEN INTEREST
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCandles.length > 0 ? (
                  paginatedCandles.map((candle, idx) => {
                    const volPct = Math.min(100, Math.max(8, (candle.volume / maxVolume) * 100));
                    const oiPct = Math.min(100, Math.max(8, ((candle.oi || 0) / maxOI) * 100));

                    return (
                      <tr
                        key={`${candle.time}-${idx}`}
                        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.03)" }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: "8px 12px", color: "var(--text-muted)" }} className="mono">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 500, color: "#E2E8F0" }} className="mono">
                          {formatDate(candle.time)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--accent-green)", fontWeight: 600 }} className="mono">
                          ₹{candle.historicalSpot.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                          ₹{candle.open.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--accent-green)", fontWeight: 600 }} className="mono">
                          ₹{candle.high.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--accent-red)", fontWeight: 600 }} className="mono">
                          ₹{candle.low.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }} className="mono">
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: 700,
                              fontSize: "11px",
                              background: candle.isBullish ? "rgba(0, 245, 160, 0.12)" : "rgba(255, 73, 92, 0.12)",
                              color: candle.isBullish ? "var(--accent-green)" : "var(--accent-red)",
                              border: candle.isBullish ? "1px solid rgba(0, 245, 160, 0.3)" : "1px solid rgba(255, 73, 92, 0.3)",
                            }}
                          >
                            ₹{candle.close.toFixed(2)} ({candle.isBullish ? "+" : ""}{candle.pChange.toFixed(1)}%)
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: candle.intrinsic > 0 ? "var(--accent-cyan)" : "var(--text-muted)" }} className="mono">
                          ₹{candle.intrinsic.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                          ₹{candle.extrinsic.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }} className="mono">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                            <span>{candle.volume.toLocaleString("en-IN")}</span>
                            <div style={{ width: "40px", height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }}>
                              <div style={{ width: `${volPct}%`, height: "100%", background: "var(--accent-cyan)", borderRadius: "3px" }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }} className="mono">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                            <span>{(candle.oi || 0).toLocaleString("en-IN")}</span>
                            <div style={{ width: "40px", height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }}>
                              <div style={{ width: `${oiPct}%`, height: "100%", background: "var(--accent-yellow)", borderRadius: "3px" }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                      No matching candle records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", fontSize: "11px", color: "var(--text-muted)" }}>
            <div>
              Showing {processedCandles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, processedCandles.length)} of {processedCandles.length} entries
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ padding: "4px 8px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "4px", color: currentPage === 1 ? "var(--text-muted)" : "white", cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="mono">Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: "4px 8px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "4px", color: currentPage >= totalPages ? "var(--text-muted)" : "white", cursor: currentPage >= totalPages ? "not-allowed" : "pointer" }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: VOLUME & OPEN INTEREST HEATMAP MATRIX VIEW */}
      {viewMode === "HEATMAP" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="glass-card" style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px", color: "var(--accent-cyan)" }}>
              🔥 OPTION STRIKE VOLUME & OPEN INTEREST DISTRIBUTION HEATMAP
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
              {optionChainMatrix.rows.map((row) => {
                const ceVolPct = Math.min(100, Math.max(5, (row.ce.vol / (optionChainMatrix.totalCeVol || 1)) * 300));
                const peVolPct = Math.min(100, Math.max(5, (row.pe.vol / (optionChainMatrix.totalPeVol || 1)) * 300));

                return (
                  <div
                    key={row.tag}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 100px 2fr",
                      gap: "12px",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: row.off === 0 ? "rgba(255,184,0,0.08)" : "rgba(255,255,255,0.02)",
                      border: row.off === 0 ? "1px solid #FFB800" : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                    }}
                  >
                    {/* CALLS BAR */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "11px", color: "var(--accent-green)", fontWeight: 700 }} className="mono">
                        CE Vol: {row.ce.vol.toLocaleString("en-IN")}
                      </span>
                      <div style={{ width: "140px", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ width: `${ceVolPct}%`, height: "100%", background: "linear-gradient(90deg, #00E5FF, #00F5A0)", borderRadius: "4px" }} />
                      </div>
                    </div>

                    {/* STRIKE CENTER */}
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: row.off === 0 ? "#FFB800" : "white" }} className="mono">
                        {row.targetStrike} ({row.tag})
                      </span>
                    </div>

                    {/* PUTS BAR */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "140px", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${peVolPct}%`, height: "100%", background: "linear-gradient(90deg, #FF495C, #FFB800)", borderRadius: "4px" }} />
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--accent-red)", fontWeight: 700 }} className="mono">
                        PE Vol: {row.pe.vol.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpiredOptionsTable;
