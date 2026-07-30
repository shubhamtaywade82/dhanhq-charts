import React from "react";
import { Play, Activity, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface TradeExplorerViewProps {
  backtestResult: any;
  onReplayTrade: (trade: any) => void;
}

export const TradeExplorerView: React.FC<TradeExplorerViewProps> = ({
  backtestResult,
  onReplayTrade,
}) => {
  const trades: any[] = backtestResult?.trades || [
    {
      tradeId: 1,
      symbol: "NIFTY",
      strikeOffset: "ATM",
      strikePrice: 24850,
      optionType: "CE",
      entryTime: 1782362700,
      entryPrice: 42.05,
      exitTime: 1782364500,
      exitPrice: 65.50,
      pnl: 1172.50,
      returnPct: 55.7,
      mae: -8.4,
      mfe: +62.1,
      exitReason: "TARGET REACHED",
    },
    {
      tradeId: 2,
      symbol: "NIFTY",
      strikeOffset: "ATM",
      strikePrice: 24850,
      optionType: "PE",
      entryTime: 1782367200,
      entryPrice: 58.10,
      exitTime: 1782369000,
      exitPrice: 46.40,
      pnl: -585.00,
      returnPct: -20.1,
      mae: -22.5,
      mfe: +4.2,
      exitReason: "STOP LOSS",
    },
  ];

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "-";
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="glass-card" style={{ padding: "16px 20px", borderRadius: "10px", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent-cyan)" }}>
          🔍 BACKTEST TRADE EXPLORER & HISTORICAL TRADE REPLAY
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Total Trades Executed: <span style={{ color: "white", fontWeight: 700 }}>{trades.length}</span>
        </div>
      </div>

      <div style={{ overflowX: "auto", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#090C12", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "11px" }}>
              <th style={{ padding: "10px 12px" }}>TRADE #</th>
              <th style={{ padding: "10px 12px" }}>CONTRACT</th>
              <th style={{ padding: "10px 12px" }}>ENTRY TIME</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>ENTRY (₹)</th>
              <th style={{ padding: "10px 12px" }}>EXIT TIME</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>EXIT (₹)</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>RETURN %</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>P&L (₹)</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>MAE %</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>MFE %</th>
              <th style={{ padding: "10px 12px" }}>EXIT REASON</th>
              <th style={{ padding: "10px 12px", textAlign: "center" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((tr) => {
              const isWin = tr.pnl >= 0;
              return (
                <tr key={tr.tradeId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="table-row-hover">
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "white" }} className="mono">
                    #{tr.tradeId}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ padding: "3px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: tr.optionType === "CE" ? "rgba(0, 245, 160, 0.15)" : "rgba(255, 73, 92, 0.15)", color: tr.optionType === "CE" ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {tr.symbol} {tr.strikePrice} {tr.optionType}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }} className="mono">
                    {formatDate(tr.entryTime)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "white", fontWeight: 600 }} className="mono">
                    ₹{tr.entryPrice.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }} className="mono">
                    {formatDate(tr.exitTime)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "white", fontWeight: 600 }} className="mono">
                    ₹{tr.exitPrice.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: isWin ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 800 }} className="mono">
                    {isWin ? "+" : ""}{tr.returnPct}%
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: isWin ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 800 }} className="mono">
                    {isWin ? "+" : ""}₹{tr.pnl.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-red)" }} className="mono">
                    {tr.mae}%
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--accent-green)" }} className="mono">
                    +{tr.mfe}%
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                      {tr.exitReason}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <button
                      onClick={() => onReplayTrade(tr)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        background: "rgba(0, 229, 255, 0.12)",
                        border: "1px solid var(--accent-cyan)",
                        color: "var(--accent-cyan)",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      <Play size={11} /> REPLAY
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeExplorerView;
