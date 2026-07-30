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
import { Play, Table, Flame, Clock, Activity, Zap, Search, Compass, Layers } from "lucide-react";

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
        className="glass-panel"
        style={{
          padding: "6px 8px",
          borderRadius: "10px",
          display: "flex",
          gap: "4px",
          overflowX: "auto",
          background: "#090C12",
          border: "1px solid var(--border-color)",
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "11px",
                fontWeight: 700,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: isActive ? "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)" : "transparent",
                color: isActive ? "#0A0D14" : "var(--text-muted)",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. TAB WORKBENCH CONTENT DISPLAY */}
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

      {activeTab === "heatmap" && (
        <TimeStrikeHeatmapView snapshot={snapshot} analyticsData={analyticsData} />
      )}

      {activeTab === "premium" && (
        <PremiumAnalyticsView snapshot={snapshot} analyticsData={analyticsData} />
      )}

      {activeTab === "positioning" && (
        <PositioningAnalyticsView snapshot={snapshot} analyticsData={analyticsData} />
      )}

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

      {activeTab === "attribution" && (
        <AttributionAnalyticsView backtestResult={backtestResult} />
      )}

      {activeTab === "session" && (
        <SessionAnalyticsView snapshot={snapshot} analyticsData={analyticsData} />
      )}
    </div>
  );
};

export default OptionsResearchWorkbench;
