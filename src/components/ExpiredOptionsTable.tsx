import React, { useState, useMemo } from "react";
import { Download, Search, ArrowUpDown, ChevronLeft, ChevronRight, Activity, Target } from "lucide-react";

interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SpotInfo {
  spot: number;
  step: number;
  atmStrike: number;
  calculatedStrike: number;
  offset: number;
  moneynessTag: string;
  diffFromSpot: number;
  diffPct: number;
}

interface ExpiredOptionsTableProps {
  candles: CandlePoint[];
  symbol: string;
  strike: string;
  optionType: string;
  spotInfo?: SpotInfo;
}

export const ExpiredOptionsTable: React.FC<ExpiredOptionsTableProps> = ({
  candles,
  symbol,
  strike,
  optionType,
  spotInfo,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "BULLISH" | "BEARISH">("ALL");
  const [sortField, setSortField] = useState<"time" | "open" | "high" | "low" | "close" | "volume" | "range">("time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Compute table statistics
  const stats = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    const maxHigh = Math.max(...candles.map((c) => c.high));
    const minLow = Math.min(...candles.map((c) => c.low));
    const totalVol = candles.reduce((acc, c) => acc + c.volume, 0);
    const avgClose = candles.reduce((acc, c) => acc + c.close, 0) / candles.length;
    const firstClose = candles[0].close;
    const lastClose = candles[candles.length - 1].close;
    const netChange = lastClose - firstClose;
    const netPChange = firstClose !== 0 ? (netChange / firstClose) * 100 : 0;

    return {
      count: candles.length,
      maxHigh,
      minLow,
      totalVol,
      avgClose,
      firstClose,
      lastClose,
      netChange,
      netPChange,
    };
  }, [candles]);

  // Max volume for scaling visual volume bars
  const maxVolume = useMemo(() => {
    if (!candles || candles.length === 0) return 1;
    return Math.max(...candles.map((c) => c.volume || 1));
  }, [candles]);

  // Format date helper
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Filter and Sort candles
  const processedCandles = useMemo(() => {
    let list = [...candles];

    // Filter by bullish/bearish
    if (filterType === "BULLISH") {
      list = list.filter((c) => c.close >= c.open);
    } else if (filterType === "BEARISH") {
      list = list.filter((c) => c.close < c.open);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const dateStr = formatDate(c.time).toLowerCase();
        return (
          dateStr.includes(q) ||
          c.close.toString().includes(q) ||
          c.volume.toString().includes(q)
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      let valA: number;
      let valB: number;
      if (sortField === "time") {
        valA = a.time;
        valB = b.time;
      } else if (sortField === "open") {
        valA = a.open;
        valB = b.open;
      } else if (sortField === "high") {
        valA = a.high;
        valB = b.high;
      } else if (sortField === "low") {
        valA = a.low;
        valB = b.low;
      } else if (sortField === "close") {
        valA = a.close;
        valB = b.close;
      } else if (sortField === "volume") {
        valA = a.volume;
        valB = b.volume;
      } else {
        valA = a.high - a.low;
        valB = b.high - b.low;
      }

      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [candles, filterType, searchQuery, sortField, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(processedCandles.length / pageSize) || 1;
  const paginatedCandles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedCandles.slice(start, start + pageSize);
  }, [processedCandles, currentPage, pageSize]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // CSV Export functionality (includes Spot Price, ATM Strike, Target Strike & Moneyness)
  const exportCSV = () => {
    if (!candles || candles.length === 0) return;

    const spotVal = spotInfo?.spot ?? 0;
    const atmVal = spotInfo?.atmStrike ?? 0;
    const calcStrike = spotInfo?.calculatedStrike ?? 0;
    const moneyness = spotInfo?.moneynessTag ?? "ATM";

    const headers = ["Timestamp,Date IST,Underlying Scrip,Spot Price (INR),ATM Strike,Option Strike,Moneyness,Open (INR),High (INR),Low (INR),Close (INR),Change (INR),Range (INR),Volume"];
    const rows = processedCandles.map((c) => {
      const change = (c.close - c.open).toFixed(2);
      const range = (c.high - c.low).toFixed(2);
      return `${c.time},"${formatDate(c.time)}",${symbol},${spotVal},${atmVal},${calcStrike} ${optionType},"${moneyness}",${c.open},${c.high},${c.low},${c.close},${change},${range},${c.volume}`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expired_${symbol}_${calcStrike}_${optionType}_HistoricalData.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* SPOT & ATM CONTEXT BANNER FOR TABLE VIEW */}
      {spotInfo && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "10px",
            padding: "12px 16px",
            background: "rgba(15, 19, 28, 0.8)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>UNDERLYING SCRIP</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-cyan)" }} className="mono">
              {symbol}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>LIVE SPOT PRICE</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-green)" }} className="mono">
              ₹{spotInfo.spot.toFixed(2)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>ATM STRIKE PRICE</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "white" }} className="mono">
              {spotInfo.atmStrike}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>QUERY STRIKE ({strike})</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-cyan)" }} className="mono">
              {spotInfo.calculatedStrike} {optionType}
            </div>
            <div style={{ fontSize: "10px", color: spotInfo.diffFromSpot >= 0 ? "var(--accent-green)" : "var(--accent-red)" }} className="mono">
              {spotInfo.diffFromSpot >= 0 ? "+" : ""}{spotInfo.diffFromSpot.toFixed(1)} pts
            </div>
          </div>

          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>SPOT MONEYNESS</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#FFB800", marginTop: "2px" }}>
              {spotInfo.moneynessTag}
            </div>
          </div>
        </div>
      )}

      {/* TOOLBAR: SEARCH, FILTERS & CSV EXPORT */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", minWidth: "220px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search date, price, volume..."
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

          {/* CANDLE TYPE FILTER */}
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
          {/* PAGE SIZE SELECTOR */}
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

          {/* EXPORT CSV BUTTON */}
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

      {/* DATA TABLE CONTAINER */}
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
              <th style={{ padding: "10px 14px", width: "40px" }}>#</th>
              <th
                onClick={() => toggleSort("time")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  DATE & TIME (IST)
                  <ArrowUpDown size={12} />
                </div>
              </th>
              {spotInfo && (
                <>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>UNDERLYING SPOT (₹)</th>
                  <th style={{ padding: "10px 14px", textAlign: "center" }}>TARGET STRIKE</th>
                </>
              )}
              <th
                onClick={() => toggleSort("open")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none", textAlign: "right" }}
              >
                OPEN (₹)
              </th>
              <th
                onClick={() => toggleSort("high")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none", textAlign: "right" }}
              >
                HIGH (₹)
              </th>
              <th
                onClick={() => toggleSort("low")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none", textAlign: "right" }}
              >
                LOW (₹)
              </th>
              <th
                onClick={() => toggleSort("close")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none", textAlign: "right" }}
              >
                CLOSE (₹)
              </th>
              <th
                onClick={() => toggleSort("range")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none", textAlign: "right" }}
              >
                RANGE (₹)
              </th>
              <th
                onClick={() => toggleSort("volume")}
                style={{ padding: "10px 14px", cursor: "pointer", userSelect: "none", textAlign: "right" }}
              >
                VOLUME
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedCandles.length > 0 ? (
              paginatedCandles.map((candle, idx) => {
                const isBullish = candle.close >= candle.open;
                const change = candle.close - candle.open;
                const pChange = candle.open !== 0 ? (change / candle.open) * 100 : 0;
                const range = candle.high - candle.low;
                const volPct = Math.min(100, Math.max(8, (candle.volume / maxVolume) * 100));

                return (
                  <tr
                    key={`${candle.time}-${idx}`}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                      transition: "background 0.15s ease",
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: "8px 14px", color: "var(--text-muted)" }} className="mono">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td style={{ padding: "8px 14px", fontWeight: 500, color: "#E2E8F0" }} className="mono">
                      {formatDate(candle.time)}
                    </td>

                    {/* SPOT & STRIKE COLUMNS */}
                    {spotInfo && (
                      <>
                        <td style={{ padding: "8px 14px", textAlign: "right", color: "var(--accent-green)", fontWeight: 600 }} className="mono">
                          ₹{spotInfo.spot.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }} className="mono">
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "rgba(0, 229, 255, 0.1)",
                              color: "var(--accent-cyan)",
                              border: "1px solid rgba(0, 229, 255, 0.25)",
                            }}
                          >
                            {spotInfo.calculatedStrike} ({strike})
                          </span>
                        </td>
                      </>
                    )}

                    <td style={{ padding: "8px 14px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                      ₹{candle.open.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "var(--accent-green)", fontWeight: 600 }} className="mono">
                      ₹{candle.high.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "var(--accent-red)", fontWeight: 600 }} className="mono">
                      ₹{candle.low.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }} className="mono">
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: 700,
                          fontSize: "11px",
                          background: isBullish ? "rgba(0, 245, 160, 0.12)" : "rgba(255, 73, 92, 0.12)",
                          color: isBullish ? "var(--accent-green)" : "var(--accent-red)",
                          border: isBullish ? "1px solid rgba(0, 245, 160, 0.3)" : "1px solid rgba(255, 73, 92, 0.3)",
                        }}
                      >
                        ₹{candle.close.toFixed(2)} ({isBullish ? "+" : ""}{pChange.toFixed(1)}%)
                      </span>
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "var(--text-secondary)" }} className="mono">
                      ₹{range.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right" }} className="mono">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "white", fontWeight: 600 }}>
                          {candle.volume.toLocaleString("en-IN")}
                        </span>
                        <div
                          style={{
                            width: "50px",
                            height: "6px",
                            background: "rgba(255, 255, 255, 0.08)",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${volPct}%`,
                              height: "100%",
                              background: isBullish ? "var(--accent-green)" : "var(--accent-cyan)",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={spotInfo ? 10 : 8} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  No matching candle records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION FOOTER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <div>
          Showing {processedCandles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, processedCandles.length)} of {processedCandles.length} entries
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            style={{
              padding: "4px 8px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              color: currentPage === 1 ? "var(--text-muted)" : "white",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="mono">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: "4px 8px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              color: currentPage >= totalPages ? "var(--text-muted)" : "white",
              cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiredOptionsTable;
