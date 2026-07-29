import React from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart2, ShieldAlert } from "lucide-react";

interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

interface MarketDepthProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  symbol: string;
}

export const MarketDepthStream: React.FC<MarketDepthProps> = ({ bids = [], asks = [], symbol }) => {
  // Calculate Totals & Max Quantities for Depth Bar percentage
  const totalBidQty = bids.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalAskQty = asks.reduce((sum, a) => sum + (a.quantity || 0), 0);
  const totalQty = totalBidQty + totalAskQty || 1;

  const bidQtyPct = Math.round((totalBidQty / totalQty) * 100);
  const askQtyPct = 100 - bidQtyPct;

  const maxBidQty = Math.max(...bids.map((b) => b.quantity), 1);
  const maxAskQty = Math.max(...asks.map((a) => a.quantity), 1);

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = bestAsk > 0 && bestBid > 0 ? Number((bestAsk - bestBid).toFixed(2)) : 0;

  return (
    <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
      {/* 1. Header & Live Indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity size={18} color="var(--accent-cyan)" />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.3px" }}>
              20-Level Order Book Microstructure
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Real-Time L2 Depth & Liquidity Clusters ({symbol.toUpperCase()})
            </div>
          </div>
        </div>
        <span className="mono" style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "12px", background: "rgba(0,245,160,0.12)", color: "var(--accent-green)", fontWeight: 700 }}>
          LIVE FEED
        </span>
      </div>

      {/* 2. Order Book Imbalance & Spread Bar */}
      <div className="glass-card" style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 600 }}>
          <span style={{ color: "var(--accent-green)" }} className="mono">
            BUYERS {bidQtyPct}% ({totalBidQty.toLocaleString("en-IN")} QTY)
          </span>
          <span style={{ color: "var(--text-muted)" }} className="mono">
            SPREAD: ₹{spread.toFixed(2)}
          </span>
          <span style={{ color: "var(--accent-red)" }} className="mono">
            SELLERS {askQtyPct}% ({totalAskQty.toLocaleString("en-IN")} QTY)
          </span>
        </div>

        {/* Visual Dual Imbalance Bar */}
        <div style={{ height: "6px", width: "100%", background: "var(--bg-primary)", borderRadius: "3px", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${bidQtyPct}%`, height: "100%", background: "linear-gradient(90deg, #00F5A0 0%, #00E5FF 100%)", transition: "width 0.3s ease" }} />
          <div style={{ width: `${askQtyPct}%`, height: "100%", background: "linear-gradient(90deg, #FF495C 0%, #FF9800 100%)", transition: "width 0.3s ease" }} />
        </div>
      </div>

      {/* 3. Dual Column Depth Table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", flex: 1, fontSize: "11px" }}>
        {/* Bids Side */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", padding: "6px 8px", color: "var(--text-muted)", fontSize: "10px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.2)" }}>
            <span>ORD</span>
            <span style={{ textAlign: "right" }}>BID QTY</span>
            <span style={{ textAlign: "right" }}>BID PRICE</span>
          </div>

          {bids.length > 0 ? (
            bids.slice(0, 10).map((b, idx) => {
              const barWidthPct = Math.round((b.quantity / maxBidQty) * 100);
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 1fr",
                    padding: "6px 8px",
                    position: "relative",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  {/* Depth Bar Background */}
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: `${barWidthPct}%`,
                      background: "rgba(0, 245, 160, 0.14)",
                      transition: "width 0.2s ease",
                      pointerEvents: "none",
                    }}
                  />

                  <span style={{ color: "var(--text-muted)", zIndex: 1 }} className="mono">
                    {b.orders}
                  </span>
                  <span style={{ textAlign: "right", zIndex: 1, fontWeight: 500 }} className="mono">
                    {b.quantity.toLocaleString("en-IN")}
                  </span>
                  <span style={{ textAlign: "right", zIndex: 1, color: "var(--accent-green)", fontWeight: 700 }} className="mono">
                    {b.price.toFixed(2)}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>Waiting for live bids...</div>
          )}
        </div>

        {/* Asks Side */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", padding: "6px 8px", color: "var(--text-muted)", fontSize: "10px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.2)" }}>
            <span>ASK PRICE</span>
            <span style={{ textAlign: "right" }}>ASK QTY</span>
            <span style={{ textAlign: "right" }}>ORD</span>
          </div>

          {asks.length > 0 ? (
            asks.slice(0, 10).map((a, idx) => {
              const barWidthPct = Math.round((a.quantity / maxAskQty) * 100);
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 40px",
                    padding: "6px 8px",
                    position: "relative",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  {/* Depth Bar Background */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${barWidthPct}%`,
                      background: "rgba(255, 73, 92, 0.14)",
                      transition: "width 0.2s ease",
                      pointerEvents: "none",
                    }}
                  />

                  <span style={{ color: "var(--accent-red)", zIndex: 1, fontWeight: 700 }} className="mono">
                    {a.price.toFixed(2)}
                  </span>
                  <span style={{ textAlign: "right", zIndex: 1, fontWeight: 500 }} className="mono">
                    {a.quantity.toLocaleString("en-IN")}
                  </span>
                  <span style={{ textAlign: "right", zIndex: 1, color: "var(--text-muted)" }} className="mono">
                    {a.orders}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>Waiting for live asks...</div>
          )}
        </div>
      </div>
    </div>
  );
};
export default MarketDepthStream;
