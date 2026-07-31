import React, { useState, useEffect } from "react";
import QueryHeaderBar, { QueryFormParams } from "./QueryHeaderBar";
import MarketReplayView from "./MarketReplayView";
import TimeStrikeHeatmapView from "./TimeStrikeHeatmapView";
import PremiumAnalyticsView from "./PremiumAnalyticsView";
import PositioningAnalyticsView from "./PositioningAnalyticsView";
import StrategyBacktestView from "./StrategyBacktestView";
import TradeExplorerView from "./TradeExplorerView";
import AttributionAnalyticsView from "./AttributionAnalyticsView";
import SessionAnalyticsView from "./SessionAnalyticsView";
import ExpiredOptionsTable from "../ExpiredOptionsTable";
import { Play, Table, Flame, Clock, Activity, Zap, Search, Compass, Layers, FlaskConical, Loader2 } from "lucide-react";

export const OptionsResearchWorkbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "replay" | "chain" | "heatmap" | "premium" | "positioning" | "backtest" | "trades" | "attribution" | "session"
  >("replay");

  const [queryForm, setQueryForm] = useState<QueryFormParams>({
    symbol: "NIFTY",
    securityId: "13",
    exchangeSegment: "NSE_FNO",
    instrument: "OPTIDX",
    expiryFlag: "WEEK",
    expiryCode: 1,
    strikeRange: "ATM-5_ATM+5",
    interval: "1",
    fromDate: "2026-07-28",
    toDate: "2026-07-28",
    mode: "Replay",
  });

  const [snapshot, setSnapshot] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStrikeTag, setSelectedStrikeTag] = useState("ATM");

  // Fetch full canonical snapshot across 22 contracts
  const handleLoadSession = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/charts/expired-options-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryForm),
      });
      const data = await res.json();
      if (data && data.strikes) {
        setSnapshot(data);
        // Automatically run analytics pipeline
        handleRunAnalytics(data);
      }
    } catch (err: any) {
      console.error("Failed to load session snapshot:", err);
    } finally {
      setLoading(false);
    }
  };

  // Run analytics engine
  const handleRunAnalytics = async (inputSnapshot?: any) => {
    try {
      const payload = inputSnapshot ? { snapshot: inputSnapshot } : {
        symbol: queryForm.symbol,
        securityId: queryForm.securityId,
        fromDate: queryForm.fromDate,
        toDate: queryForm.toDate,
        interval: queryForm.interval,
      };
      const res = await fetch("/api/analytics/expired-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`Analytics server error ${res.status}: ${errTxt.slice(0, 100)}`);
      }
      const resData = await res.json();
      if (resData && resData.data) {
        setAnalyticsData(resData.data);
      }
    } catch (err: any) {
      console.error("Failed to run analytics:", err);
    }
  };

  // Run backtest engine
  const handleRunBacktest = async (customConfig?: any) => {
    setLoading(true);
    try {
      const payload = {
        symbol: queryForm.symbol,
        securityId: queryForm.securityId,
        fromDate: queryForm.fromDate,
        toDate: queryForm.toDate,
        interval: queryForm.interval,
        config: customConfig || {
          underlying: queryForm.symbol,
          strikeOffset: selectedStrikeTag,
          direction: "BUY",
          entryTimeWindow: "ALL",
          stopLossPct: 25,
          targetPct: 50,
          trailingStopPct: 15,
          maxTradesPerDay: 3,
        },
      };
      const res = await fetch("/api/backtest/expired-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`Backtest server error ${res.status}: ${errTxt.slice(0, 100)}`);
      }
      const resData = await res.json();
      if (resData && resData.data) {
        setBacktestResult(resData.data);
        setActiveTab("backtest");
      }
    } catch (err: any) {
      console.error("Failed to run backtest:", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load default snapshot on mount
  useEffect(() => {
    handleLoadSession();
  }, []);

  const meta = snapshot?.metadata
    ? {
        underlyingSpotPrice: snapshot.metadata.underlyingSpotPrice || 24850,
        atmStrike: snapshot.metadata.atmStrike || 24850,
        strikeStep: snapshot.metadata.strikeStep || 50,
        strikesCount: Object.keys(snapshot.strikes || {}).length,
        contractsCount: Object.keys(snapshot.strikes || {}).length * 2,
      }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
      {/* 0. TOP HERO HEADER STRIP */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        borderRadius: "12px",
        background: "rgba(10,14,22,0.9)",
        border: "1px solid rgba(255,180,84,0.2)",
        borderLeft: "4px solid #FFB800",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ 
            width: "48px", height: "48px", 
            borderRadius: "50%", 
            background: "rgba(255,184,0,0.1)", 
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFB800"
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.5px" }}>
              EXPIRED OPTIONS RESEARCH WORKBENCH
            </h1>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
              Multi-Strike OHLCV Replay • Analytics • Backtest Engine
            </span>
          </div>
        </div>
        
        <div style={{ 
          display: "flex", alignItems: "center", 
          padding: "8px 16px", borderRadius: "8px", 
          background: "rgba(255,255,255,0.03)", 
          border: "1px solid rgba(255,255,255,0.05)" 
        }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin-slow"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Loading session...
            </div>
          ) : meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Snapshot</span>
                <span style={{ color: "#00E5FF", fontWeight: 600 }}>{meta.strikesCount} Strikes / {meta.contractsCount} Contracts</span>
              </div>
              <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.1)" }}></div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Spot / ATM</span>
                <span style={{ color: "#00F5A0", fontWeight: 600 }}>{meta.underlyingSpotPrice} / {meta.atmStrike}</span>
              </div>
            </div>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontStyle: "italic" }}>
              No active session data
            </span>
          )}
        </div>
      </div>

      {/* 1. TOP QUERY BUILDER BAR */}
      <QueryHeaderBar
        form={queryForm}
        onChange={setQueryForm}
        onLoadSession={handleLoadSession}
        onRunAnalysis={() => handleRunAnalytics()}
        onRunBacktest={() => handleRunBacktest()}
        loading={loading}
        meta={meta}
      />

      {/* 2. 8-TAB WORKBENCH NAVIGATION TOOLBAR */}
      <div
        style={{
          borderBottom: "2px solid rgba(0,229,255,0.08)",
          paddingBottom: "8px"
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: "6px 8px",
            borderRadius: "10px",
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            background: "rgba(10,14,22,0.6)",
            border: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(12px)",
          }}
        >
          {[
            { id: "replay", label: "MARKET REPLAY", icon: Play },
            { id: "chain", label: "OPTION CHAIN MATRIX", icon: Table },
            { id: "heatmap", label: "STRIKE MATRIX HEATMAP", icon: Flame },
            { id: "premium", label: "PREMIUM & STRADDLE", icon: Activity },
            { id: "positioning", label: "POSITIONING & BUILDUP", icon: Layers },
            { id: "backtest", label: "STRATEGY BACKTEST", icon: Zap },
            { id: "trades", label: "TRADE EXPLORER", icon: Search },
            { id: "attribution", label: "ATTRIBUTION ANALYTICS", icon: Activity },
            { id: "session", label: "SESSION DIGEST", icon: Compass },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background: isActive ? "linear-gradient(135deg, #00F5A0, #00E5FF)" : "transparent",
                  color: isActive ? "#0A0D14" : "rgba(255,255,255,0.4)",
                  boxShadow: isActive ? "0 0 16px rgba(0,229,255,0.3)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TAB WORKBENCH CONTENT DISPLAY */}
      {loading ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "400px", background: "rgba(10,14,22,0.6)", border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "12px", backdropFilter: "blur(12px)", gap: "16px"
        }}>
          <div style={{ color: "#00E5FF" }}>
            <Loader2 size={40} className="animate-spin-slow" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 600 }}>Loading Session Snapshot…</h3>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
              Fetching 22 contracts via DhanHQ Rolling Options API
            </p>
          </div>
        </div>
      ) : !snapshot ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "400px", background: "rgba(10,14,22,0.6)", border: "1px dashed rgba(255,184,0,0.3)",
          borderRadius: "12px", gap: "16px"
        }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,184,0,0.1)", color: "#FFB800", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: 600 }}>No session loaded</h3>
            <p style={{ margin: "8px 0 16px", color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
              Select symbol, date range and click LOAD SESSION
            </p>
            <button
              onClick={handleLoadSession}
              style={{
                background: "rgba(255,184,0,0.15)",
                color: "#FFB800",
                border: "1px solid rgba(255,184,0,0.3)",
                padding: "8px 24px",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              LOAD SESSION
            </button>
          </div>
        </div>
      ) : null}

      {/* Tab content (only when snapshot loaded and not loading) */}
      {!loading && snapshot && (
        <>
          {activeTab === "replay" && (
            <MarketReplayView
              snapshot={snapshot}
              selectedStrikeTag={selectedStrikeTag}
              onSelectStrikeTag={setSelectedStrikeTag}
            />
          )}

          {activeTab === "chain" && (
            <ExpiredOptionsTable
              candles={snapshot?.strikes?.[selectedStrikeTag]?.ce?.close ? snapshot.strikes[selectedStrikeTag].ce.close.map((close: number, idx: number) => ({
                time: snapshot.strikes[selectedStrikeTag].ce.timestamp[idx],
                open: snapshot.strikes[selectedStrikeTag].ce.open[idx],
                high: snapshot.strikes[selectedStrikeTag].ce.high[idx],
                low: snapshot.strikes[selectedStrikeTag].ce.low[idx],
                close,
                volume: snapshot.strikes[selectedStrikeTag].ce.volume[idx],
                oi: snapshot.strikes[selectedStrikeTag].ce.oi?.[idx] || 0,
                spot: snapshot.strikes[selectedStrikeTag].ce.spot?.[idx] || 0,
              })) : []}
              symbol={queryForm.symbol}
              strike={selectedStrikeTag}
              optionType="CALL"
              spotInfo={{
                spot: snapshot?.metadata?.underlyingSpotPrice || 24850,
                step: snapshot?.metadata?.strikeStep || 50,
                atmStrike: snapshot?.metadata?.atmStrike || 24850,
                calculatedStrike: (snapshot?.metadata?.atmStrike || 24850),
                offset: 0,
                moneynessTag: "ATM",
                diffFromSpot: 0,
                diffPct: 0,
              }}
              allStrikesData={snapshot?.strikes}
            />
          )}

          {activeTab === "heatmap" && <TimeStrikeHeatmapView snapshot={snapshot} analyticsData={analyticsData} />}
          {activeTab === "premium" && <PremiumAnalyticsView snapshot={snapshot} analyticsData={analyticsData} />}
          {activeTab === "positioning" && <PositioningAnalyticsView snapshot={snapshot} analyticsData={analyticsData} />}

          {activeTab === "backtest" && (
            <StrategyBacktestView
              snapshot={snapshot}
              backtestResult={backtestResult}
              onRunBacktestWithConfig={(cfg) => handleRunBacktest(cfg)}
            />
          )}

          {activeTab === "trades" && (
            <TradeExplorerView
              backtestResult={backtestResult}
              onReplayTrade={(tr) => {
                setSelectedStrikeTag(tr.strikeOffset);
                setActiveTab("replay");
              }}
            />
          )}

          {activeTab === "attribution" && <AttributionAnalyticsView backtestResult={backtestResult} />}
          {activeTab === "session" && <SessionAnalyticsView snapshot={snapshot} analyticsData={analyticsData} />}
        </>
      )}
    </div>
  );
};

export default OptionsResearchWorkbench;
