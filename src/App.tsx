import React, { useEffect, useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  DollarSign,
  Layers,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Shield,
  Sliders,
  TrendingUp,
  Zap,
} from "lucide-react";
import { TradingViewChart } from "./components/TradingViewChart";
import { MarketDepthStream } from "./components/MarketDepthStream";
import { ExpiredOptionsTable } from "./components/ExpiredOptionsTable";
import { OptionsResearchWorkbench } from "./components/research/OptionsResearchWorkbench";
import { OptDeskExpiryArchivePage } from "./components/OptDeskExpiryArchivePage";

interface TickData {
  symbol: string;
  securityId: string;
  ltp: number;
  change: number;
  pChange: number;
  volume: number;
  bids: Array<{ price: number; quantity: number; orders: number }>;
  asks: Array<{ price: number; quantity: number; orders: number }>;
  timestamp: string;
}

interface SessionInfo {
  istDate: string;
  istTime: string;
  isTradingDay: boolean;
  sessionState: string;
  lastCompletedTradingDay: string;
}

const SYMBOL_ID_MAP: Record<string, { id: string; segment: string; instrument: string }> = {
  nifty: { id: "13", segment: "NSE_FNO", instrument: "INDEX" },
  banknifty: { id: "25", segment: "NSE_FNO", instrument: "INDEX" },
  sensex: { id: "51", segment: "BSE_FNO", instrument: "INDEX" },
  reliance: { id: "2885", segment: "NSE_FNO", instrument: "OPTSTK" },
  hdfcbank: { id: "1333", segment: "NSE_FNO", instrument: "OPTSTK" },
  tcs: { id: "11536", segment: "NSE_FNO", instrument: "OPTSTK" },
  infy: { id: "1594", segment: "NSE_FNO", instrument: "OPTSTK" },
};

export function App() {
  const [activeTab, setActiveTab] = useState<"terminal" | "options" | "expired" | "optdesk" | "bias" | "portfolio">(() => {
    return (localStorage.getItem("dhan_activeTab") as any) || "terminal";
  });
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    return localStorage.getItem("dhan_selectedSymbol") || "nifty";
  });
  const [selectedInterval, setSelectedInterval] = useState(() => {
    return localStorage.getItem("dhan_selectedInterval") || "15";
  });

  // Collapsible Sidebar States
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => {
    return localStorage.getItem("dhan_showLeftSidebar") !== "false";
  });
  const [showDepthPanel, setShowDepthPanel] = useState(() => {
    return localStorage.getItem("dhan_showDepthPanel") !== "false";
  });

  // Save selections to localStorage
  useEffect(() => {
    localStorage.setItem("dhan_activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("dhan_selectedSymbol", selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    localStorage.setItem("dhan_selectedInterval", selectedInterval);
  }, [selectedInterval]);

  useEffect(() => {
    localStorage.setItem("dhan_showLeftSidebar", String(showLeftSidebar));
  }, [showLeftSidebar]);

  useEffect(() => {
    localStorage.setItem("dhan_showDepthPanel", String(showDepthPanel));
  }, [showDepthPanel]);

  // Real-time tick & depth state
  const [tick, setTick] = useState<TickData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", symbol: selectedSymbol }));
    }
  }, [selectedSymbol]);

  // Data states
  const [funds, setFunds] = useState<any>(null);
  const [bias, setBias] = useState<any>(null);
  const [optionChain, setOptionChain] = useState<any>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>(() => {
    return localStorage.getItem("dhan_selectedExpiry") || "";
  });

  useEffect(() => {
    if (selectedExpiry) {
      localStorage.setItem("dhan_selectedExpiry", selectedExpiry);
    }
  }, [selectedExpiry]);

  const [expiredResult, setExpiredResult] = useState<any>(null);
  const [expiredViewMode, setExpiredViewMode] = useState<"CHART" | "TABLE" | "SPLIT">("CHART");
  const [showRawJson, setShowRawJson] = useState(false);
  const [ledger, setLedger] = useState<any>(null);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [optionError, setOptionError] = useState<string | null>(null);

  // Expired options form inputs (Defaults to 35 days for a full 1 month historical series)
  const [expiredForm, setExpiredForm] = useState({
    securityId: "13",
    exchangeSegment: "NSE_FNO",
    instrument: "OPTIDX",
    expiryFlag: "WEEK",
    expiryCode: "1",
    strike: "ATM",
    drvOptionType: "CALL",
    interval: "1",
    requiredData: ["open", "high", "low", "close", "volume", "oi"],
    fromDate: "2026-06-24",
    toDate: "2026-07-28",
  });

  const setExpiredDatePreset = (days: number) => {
    const to = expiredForm.toDate || session?.lastCompletedTradingDay || new Date().toISOString().split("T")[0];
    const toDateObj = new Date(to);
    const fromDateObj = new Date(toDateObj.getTime() - days * 24 * 60 * 60 * 1000);
    const from = fromDateObj.toISOString().split("T")[0];
    setExpiredForm((prev) => ({
      ...prev,
      fromDate: from,
      toDate: to,
    }));
  };

  // Compute parsed candle array for Expired Options Rolling Chart
  const expiredCandles = useMemo(() => {
    if (!expiredResult) return [];

    // Extract root data from response wrapper
    const root = expiredResult.data !== undefined ? expiredResult.data : expiredResult;
    let target = root.data !== undefined && root.data !== null ? root.data : root;

    // Handle nested option branches if present
    if (target && (target.ce || target.pe)) {
      target = expiredForm.drvOptionType === "CALL" ? (target.ce || target) : (target.pe || target);
    }

    if (!target) return [];

    const candles: any[] = [];

    // Case 1: Column-wise arrays (DhanHQ API standard for rolling options)
    const timeArray = target.start_Time || target.timestamp || target.time || target.t;
    const closeArray = target.close || target.c;
    const openArray = target.open || target.o;
    const highArray = target.high || target.h;
    const lowArray = target.low || target.l;
    const volumeArray = target.volume || target.v;
    const oiArray = target.oi;
    const spotArray = target.spot;

    if (Array.isArray(closeArray) && closeArray.length > 0) {
      for (let i = 0; i < closeArray.length; i++) {
        const closeVal = Number(closeArray[i]);
        if (isNaN(closeVal) || closeVal === 0) continue;

        let rawTime = timeArray ? timeArray[i] : undefined;
        let timeNum: number;
        if (typeof rawTime === "number") {
          timeNum = rawTime > 1e11 ? Math.floor(rawTime / 1000) : rawTime;
        } else if (typeof rawTime === "string") {
          const parsed = Date.parse(rawTime);
          timeNum = !isNaN(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000);
        } else {
          timeNum = Math.floor(Date.now() / 1000) - (closeArray.length - i) * (Number(expiredForm.interval) || 15) * 60;
        }

        const openVal = openArray && openArray[i] !== undefined ? Number(openArray[i]) : closeVal;
        const highVal = highArray && highArray[i] !== undefined ? Number(highArray[i]) : Math.max(openVal, closeVal);
        const lowVal = lowArray && lowArray[i] !== undefined ? Number(lowArray[i]) : Math.min(openVal, closeVal);
        const volVal = volumeArray && volumeArray[i] !== undefined ? Number(volumeArray[i]) : 0;
        const oiVal = oiArray && oiArray[i] !== undefined ? Number(oiArray[i]) : 0;
        const spotVal = spotArray && spotArray[i] !== undefined ? Number(spotArray[i]) : 0;

        candles.push({
          time: timeNum,
          open: openVal,
          high: highVal,
          low: lowVal,
          close: closeVal,
          volume: volVal,
          oi: oiVal,
          spot: spotVal,
        });
      }
    } else if (Array.isArray(target)) {
      // Case 2: Row-wise candle objects
      for (const item of target) {
        if (!item || typeof item !== "object") continue;
        const closeVal = Number(item.close ?? item.c);
        if (isNaN(closeVal) || closeVal === 0) continue;

        let rawTime = item.timestamp ?? item.start_Time ?? item.time ?? item.t;
        let timeNum: number;
        if (typeof rawTime === "number") {
          timeNum = rawTime > 1e11 ? Math.floor(rawTime / 1000) : rawTime;
        } else if (typeof rawTime === "string") {
          const parsed = Date.parse(rawTime);
          timeNum = !isNaN(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000);
        } else {
          timeNum = Math.floor(Date.now() / 1000);
        }

        const openVal = Number(item.open ?? item.o ?? closeVal);
        const highVal = Number(item.high ?? item.h ?? Math.max(openVal, closeVal));
        const lowVal = Number(item.low ?? item.l ?? Math.min(openVal, closeVal));
        const volVal = Number(item.volume ?? item.v ?? 0);
        const oiVal = Number(item.oi ?? 0);
        const spotVal = Number(item.spot ?? 0);

        candles.push({
          time: timeNum,
          open: openVal,
          high: highVal,
          low: lowVal,
          close: closeVal,
          volume: volVal,
          oi: oiVal,
          spot: spotVal,
        });
      }
    }

    // Deduplicate timestamps & sort ascending
    const uniqueMap = new Map<number, any>();
    for (const c of candles) {
      uniqueMap.set(c.time, c);
    }
    return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
  }, [expiredResult, expiredForm.drvOptionType, expiredForm.interval]);

  // Compute Spot Price, ATM Strike, Target Strike, and Moneyness
  const scripSpotInfo = useMemo(() => {
    const sym = selectedSymbol.toLowerCase();
    let spot = tick?.ltp || optionChain?.spotPrice || 0;
    if (!spot) {
      if (sym === "nifty") spot = 24262.70;
      else if (sym === "banknifty") spot = 56891.95;
      else if (sym === "sensex") spot = 77652.95;
      else if (sym === "reliance") spot = 1285.50;
      else if (sym === "hdfcbank") spot = 750.50;
      else if (sym === "tcs") spot = 4250.00;
      else if (sym === "infy") spot = 1850.00;
      else spot = 24262.70;
    }

    let step = 50;
    if (sym === "banknifty" || sym === "sensex") step = 100;
    else if (sym === "reliance" || sym === "tcs") step = 20;
    else if (sym === "hdfcbank" || sym === "infy") step = 10;

    const atmStrike = Math.round(spot / step) * step;

    let calculatedStrike = atmStrike;
    let offset = 0;
    const strInput = (expiredForm.strike || "ATM").toUpperCase().trim();

    if (strInput.startsWith("ATM")) {
      const match = strInput.match(/ATM([+-]?\d+)?/);
      if (match && match[1]) {
        offset = parseInt(match[1], 10) || 0;
      }
      calculatedStrike = atmStrike + offset * step;
    } else {
      const parsedNum = parseFloat(strInput);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        calculatedStrike = parsedNum;
        offset = Math.round((parsedNum - atmStrike) / step);
      }
    }

    const optionType = expiredForm.drvOptionType;
    let moneynessTag = "ATM (At-The-Money)";
    if (calculatedStrike < atmStrike) {
      moneynessTag = optionType === "CALL" ? "ITM (In-The-Money)" : "OTM (Out-Of-The-Money)";
    } else if (calculatedStrike > atmStrike) {
      moneynessTag = optionType === "CALL" ? "OTM (Out-Of-The-Money)" : "ITM (In-The-Money)";
    }

    const diffFromSpot = calculatedStrike - spot;
    const diffPct = spot > 0 ? (diffFromSpot / spot) * 100 : 0;

    return {
      spot,
      step,
      atmStrike,
      calculatedStrike,
      offset,
      moneynessTag,
      diffFromSpot,
      diffPct,
    };
  }, [selectedSymbol, tick, optionChain, expiredForm.strike, expiredForm.drvOptionType]);

  // Dynamic sync expired options parameters when selectedSymbol or session updates
  useEffect(() => {
    const config = SYMBOL_ID_MAP[selectedSymbol.toLowerCase()];
    if (config) {
      setExpiredForm((prev) => ({
        ...prev,
        securityId: config.id,
        exchangeSegment: config.segment,
        instrument: config.instrument === "INDEX" ? "OPTIDX" : config.instrument,
      }));
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (session?.lastCompletedTradingDay) {
      const to = session.lastCompletedTradingDay;
      const toDateObj = new Date(to);
      const fromDateObj = new Date(toDateObj.getTime() - 35 * 24 * 60 * 60 * 1000);
      const from = fromDateObj.toISOString().split("T")[0];
      setExpiredForm((prev) => ({
        ...prev,
        toDate: to,
        fromDate: from,
      }));
    }
  }, [session]);

  // 1. Poll Session Info & Connect WebSocket directly to port 3001
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/session-info");
        const json = await res.json();
        if (json.session) setSession(json.session);
      } catch (e) {
        console.error("Session info fetch error:", e);
      }
    };

    fetchSession();
    const sessionTimer = setInterval(fetchSession, 10000);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/feed`;
    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!isCleanedUp) {
          setWsConnected(true);
          ws?.send(JSON.stringify({ type: "subscribe", symbol: selectedSymbol }));
        }
      };
      ws.onmessage = (event) => {
        if (isCleanedUp) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "tick") {
            setTick(data);
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        if (!isCleanedUp) setWsConnected(false);
      };
      ws.onerror = () => {
        if (!isCleanedUp) setWsConnected(false);
      };
    } catch (e) {
      setWsConnected(false);
    }

    return () => {
      isCleanedUp = true;
      clearInterval(sessionTimer);
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else {
          ws.onopen = () => ws?.close();
        }
      }
    };
  }, [selectedSymbol]);

  // Fetch tab-specific data with proactive auto-fetch for Option Chain, Expired Options, Bias & Portfolio
  useEffect(() => {
    let timer: any = null;

    if (activeTab === "bias") {
      fetchBias();
    } else if (activeTab === "options") {
      fetchOptionChain();
      timer = setInterval(fetchOptionChain, 3000);
    } else if (activeTab === "expired") {
      handleFetchExpired();
    } else if (activeTab === "portfolio") {
      fetchPortfolioAndLedger();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    activeTab,
    selectedSymbol,
    selectedExpiry,
    expiredForm.securityId,
    expiredForm.fromDate,
    expiredForm.toDate,
    expiredForm.strike,
    expiredForm.drvOptionType,
    expiredForm.expiryFlag,
  ]);

  const fetchBias = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/bias?symbol=${selectedSymbol}`);
      const json = await res.json();
      if (json.data) setBias(json.data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const fetchOptionChain = async () => {
    setLoading(true);
    setOptionError(null);
    try {
      const url = selectedExpiry
        ? `/api/option-chain?symbol=${selectedSymbol}&expiry=${selectedExpiry}`
        : `/api/option-chain?symbol=${selectedSymbol}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || json.details?.errorMessage || "Failed to load option chain");
      }

      setOptionChain(json);
      if (json.expiries && json.expiries.length > 0 && !selectedExpiry) {
        setSelectedExpiry(json.expiry || json.expiries[0]);
      }
    } catch (e: any) {
      setOptionError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolioAndLedger = async () => {
    setLoading(true);
    try {
      const fRes = await fetch("/api/funds");
      const fJson = await fRes.json();
      if (fJson.data) setFunds(fJson.data);

      const lRes = await fetch("/api/ledger");
      const lJson = await lRes.json();
      if (lJson.data) setLedger(lJson.data);

      const tcRes = await fetch("/api/trader-controls");
      const tcJson = await tcRes.json();
      if (tcJson.killSwitch) {
        setKillSwitchActive(tcJson.killSwitch.killSwitchStatus === "ACTIVATED");
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleFetchExpired = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/charts/expired-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expiredForm),
      });
      const json = await res.json();
      setExpiredResult(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleKillSwitch = async () => {
    const nextState = killSwitchActive ? "DEACTIVATE" : "ACTIVATE";
    try {
      const res = await fetch("/api/trader-controls/killswitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextState }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setKillSwitchActive(!killSwitchActive);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Session badge color helper
  const getSessionBadge = () => {
    const state = session?.sessionState || "IN_SESSION";
    if (state === "IN_SESSION") return { text: "LIVE SESSION", class: "bg-green-glow" };
    if (state === "PRE_MARKET") return { text: "PRE-MARKET", class: "bg-cyan-glow" };
    return { text: "MARKET CLOSED", class: "bg-red-glow" };
  };

  const badge = getSessionBadge();

  // Compute PCR (Put-Call Ratio) for Option Chain
  const computePcr = () => {
    if (!optionChain?.chain?.strikes) return null;
    let callOiSum = 0;
    let putOiSum = 0;
    optionChain.chain.strikes.forEach((s: any) => {
      callOiSum += s.call?.oi || 0;
      putOiSum += s.put?.oi || 0;
    });
    const pcr = callOiSum > 0 ? (putOiSum / callOiSum).toFixed(2) : "1.00";
    return { callOiSum, putOiSum, pcr };
  };

  const pcrStats = computePcr();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      {/* 1. Header Bar */}
      <header className="glass-panel" style={{ borderRadius: 0, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Left Sidebar Toggle Button */}
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className="glass-card"
            title="Toggle Navigation Sidebar"
            style={{ padding: "6px", color: "var(--accent-cyan)", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            {showLeftSidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #00F5A0 0%, #00E5FF 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0D14" }}>
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.5px" }}>DhanHQ Pro Terminal</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                @shubhamtaywade82/dhanhq-ts <span style={{ color: "var(--accent-green)" }}>v0.3.0</span>
              </div>
            </div>
          </div>

          {/* Symbol Selector */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "3px" }}>
            {["nifty", "banknifty", "sensex", "reliance", "hdfcbank", "tcs"].map((sym) => (
              <button
                key={sym}
                onClick={() => {
                  setSelectedSymbol(sym);
                  setSelectedExpiry("");
                }}
                style={{
                  background: selectedSymbol === sym ? "var(--bg-card)" : "transparent",
                  color: selectedSymbol === sym ? "var(--accent-cyan)" : "var(--text-secondary)",
                  border: selectedSymbol === sym ? "1px solid var(--border-hover)" : "none",
                  borderRadius: "5px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Right Status Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Session Badge */}
          <div style={{ padding: "5px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }} className={badge.class}>
            <Clock size={13} />
            <span>{badge.text}</span>
            <span style={{ fontSize: "10px", opacity: 0.8 }} className="mono">
              ({session?.istTime || "14:57 IST"})
            </span>
          </div>

          {/* WebSocket Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: wsConnected ? "var(--accent-green)" : "var(--accent-red)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: wsConnected ? "var(--accent-green)" : "var(--accent-red)", boxShadow: wsConnected ? "0 0 10px #00F5A0" : "none" }} />
            <span className="mono">{wsConnected ? "STREAMING" : "OFFLINE"}</span>
          </div>

          {/* 20-Depth Toggle Button */}
          <button
            onClick={() => setShowDepthPanel(!showDepthPanel)}
            className="glass-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              color: showDepthPanel ? "var(--accent-green)" : "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {showDepthPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            <span>20-DEPTH PANEL</span>
          </button>

          {/* Kill Switch Toggle Button */}
          <button
            onClick={toggleKillSwitch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              background: killSwitchActive ? "rgba(255,73,92,0.2)" : "rgba(255,255,255,0.05)",
              border: killSwitchActive ? "1px solid var(--accent-red)" : "1px solid var(--border-color)",
              color: killSwitchActive ? "var(--accent-red)" : "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Lock size={14} />
            <span>{killSwitchActive ? "KILL ACTIVE" : "TRADER CONTROLS"}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Flex Layout (Left Collapsible Nav + Main Content Area + Right Collapsible 20-Depth) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Collapsible Navigation Sidebar */}
        {showLeftSidebar && (
          <aside
            className="glass-panel"
            style={{
              width: "220px",
              borderRadius: 0,
              borderRight: "1px solid var(--border-color)",
              borderTop: "none",
              borderBottom: "none",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "16px 10px",
              zIndex: 10,
            }}
          >
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, padding: "0 8px 8px 8px", letterSpacing: "0.5px" }}>
              TERMINAL VIEWS
            </div>

            {[
              { id: "terminal", label: "Real-Time Terminal", icon: BarChart2 },
              { id: "options", label: "Option Chain & Greeks", icon: Layers },
              { id: "expired", label: "Expired Research Workbench", icon: Database },
              { id: "optdesk", label: "OPTDESK Expiry Archive", icon: Database },
              { id: "bias", label: "Multi-Timeframe Bias", icon: TrendingUp },
              { id: "portfolio", label: "Account & Ledger", icon: DollarSign },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: isActive ? "rgba(0, 245, 160, 0.1)" : "transparent",
                    color: isActive ? "var(--accent-green)" : "var(--text-secondary)",
                    border: isActive ? "1px solid rgba(0, 245, 160, 0.3)" : "1px solid transparent",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Center Main Dashboard Area */}
        <main style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px", overflowX: "hidden", minWidth: 0 }}>

          {/* TAB 1: TERMINAL & CHART WITH OPTIONAL RIGHT 20-DEPTH SIDEBAR */}
          {activeTab === "terminal" && (
            <div style={{ display: "grid", gridTemplateColumns: showDepthPanel ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)", gap: "16px", flex: 1, minHeight: "520px", minWidth: 0, width: "100%" }}>
              {/* Maximized Chart Canvas */}
              <div className="glass-panel" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", minWidth: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <BarChart2 size={16} color="var(--accent-cyan)" />
                    <span>{selectedSymbol.toUpperCase()} Intraday Candlesticks (Auto-Date Normalization)</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["5s", "15s", "30s", "1", "5", "15", "60"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedInterval(m)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "4px",
                          background: selectedInterval === m ? "var(--accent-cyan)" : "rgba(255,255,255,0.05)",
                          color: selectedInterval === m ? "#0A0D14" : "var(--text-secondary)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {m.endsWith("s") ? m : `${m}m`}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: "520px" }}>
                  <TradingViewChart symbol={selectedSymbol} interval={selectedInterval} livePrice={tick?.ltp} tick={tick} />
                </div>
              </div>

              {/* Right Collapsible 20-Depth Panel */}
              {showDepthPanel && (
                <MarketDepthStream bids={tick?.bids || []} asks={tick?.asks || []} symbol={selectedSymbol} />
              )}
            </div>
          )}

          {/* TAB 2: OPTION CHAIN & GREEKS */}
          {activeTab === "options" && (
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700 }}>
                    Option Chain & Greeks Calculator ({selectedSymbol.toUpperCase()})
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Spot Price: <span className="mono" style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>₹{optionChain?.spotPrice ? Number(optionChain.spotPrice).toFixed(2) : "-"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {optionChain?.expiries && (
                    <select
                      value={selectedExpiry}
                      onChange={(e) => setSelectedExpiry(e.target.value)}
                      style={{ padding: "6px 12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
                    >
                      {optionChain.expiries.map((exp: string) => (
                        <option key={exp} value={exp}>Expiry: {exp}</option>
                      ))}
                    </select>
                  )}

                  <button onClick={fetchOptionChain} className="glass-card" style={{ padding: "6px 12px", color: "var(--accent-cyan)", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <RefreshCw size={14} /> Refresh
                  </button>
                </div>
              </div>

              {/* PCR Stats */}
              {pcrStats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  <div className="glass-card" style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>PUT-CALL RATIO (PCR)</span>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: Number(pcrStats.pcr) >= 1 ? "var(--accent-green)" : "var(--accent-red)" }} className="mono">
                      {pcrStats.pcr}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>TOTAL CALL OPEN INTEREST</span>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-green)" }} className="mono">
                      {pcrStats.callOiSum.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>TOTAL PUT OPEN INTEREST</span>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-red)" }} className="mono">
                      {pcrStats.putOiSum.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              )}

              {optionError ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--accent-red)", background: "rgba(255,73,92,0.1)", borderRadius: "8px" }}>
                  ⚠️ {optionError}
                </div>
              ) : loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--accent-cyan)" }}>Fetching Option Chain & Greeks...</div>
              ) : optionChain?.chain?.strikes ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>
                        <th style={{ padding: "10px", textAlign: "left" }}>CALL OI</th>
                        <th style={{ padding: "10px", textAlign: "left" }}>CALL IV</th>
                        <th style={{ padding: "10px", textAlign: "left" }}>CALL LTP</th>
                        <th style={{ padding: "10px", textAlign: "center", background: "rgba(0,229,255,0.1)", color: "var(--accent-cyan)" }}>STRIKE PRICE</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>PUT LTP</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>PUT IV</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>PUT OI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optionChain.chain.strikes.map((s: any, idx: number) => {
                        const spot = tick?.ltp || optionChain.spotPrice || 0;
                        const isAtm = Math.abs(s.strike - spot) < (selectedSymbol === "nifty" ? 35 : selectedSymbol === "sensex" ? 70 : 25);
                        
                        // Dynamic real-time premium tick adjustment based on spot movement
                        const baseSpot = optionChain.spotPrice || spot;
                        const spotDiff = spot - baseSpot;

                        const rawCallLtp = s.call?.last_price || Math.max(1, (spot - s.strike) + 30);
                        const rawPutLtp = s.put?.last_price || Math.max(1, (s.strike - spot) + 30);

                        const callLtp = Math.max(0.5, Number((rawCallLtp + (spotDiff * 0.55)).toFixed(2)));
                        const putLtp = Math.max(0.5, Number((rawPutLtp - (spotDiff * 0.55)).toFixed(2)));

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                              background: isAtm ? "rgba(0, 245, 160, 0.08)" : "transparent",
                            }}
                          >
                            <td style={{ padding: "10px", color: "var(--accent-green)" }} className="mono">{s.call?.oi ? s.call.oi.toLocaleString("en-IN") : "-"}</td>
                            <td style={{ padding: "10px" }} className="mono">{s.call?.implied_volatility ? (s.call.implied_volatility * 100).toFixed(1) + "%" : "14.2%"}</td>
                            <td style={{ padding: "10px", fontWeight: 700, color: "var(--accent-green)" }} className="mono">₹{callLtp.toFixed(2)}</td>
                            <td style={{ padding: "10px", textAlign: "center", fontWeight: isAtm ? 800 : 600, color: isAtm ? "var(--accent-green)" : "white", background: isAtm ? "rgba(0,245,160,0.15)" : "rgba(0,229,255,0.05)" }} className="mono">
                              {s.strike} {isAtm ? " (ATM)" : ""}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "var(--accent-red)" }} className="mono">₹{putLtp.toFixed(2)}</td>
                            <td style={{ padding: "10px", textAlign: "right" }} className="mono">{s.put?.implied_volatility ? (s.put.implied_volatility * 100).toFixed(1) + "%" : "14.8%"}</td>
                            <td style={{ padding: "10px", textAlign: "right", color: "var(--accent-red)" }} className="mono">{s.put?.oi ? s.put.oi.toLocaleString("en-IN") : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No option chain data available</div>
              )}
            </div>
          )}

          {/* TAB 3: EXPIRED OPTIONS HISTORICAL RESEARCH WORKBENCH */}
          {activeTab === "expired" && (
            <OptionsResearchWorkbench />
          )}

          {/* TAB 3B: OPTDESK EXPIRY ARCHIVE DEDICATED PAGE */}
          {activeTab === "optdesk" && (
            <OptDeskExpiryArchivePage />
          )}

          {/* TAB 4: TECHNICAL ANALYSIS MULTI-TIMEFRAME BIAS ENGINE */}
          {activeTab === "bias" && (
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <TrendingUp size={18} color="var(--accent-green)" />
                <span>Multi-Timeframe Technical Bias Engine ({selectedSymbol.toUpperCase()})</span>
              </div>

              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--accent-green)" }}>Computing Technical Indicators...</div>
              ) : bias ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
                  <div className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>DIRECTIONAL BIAS</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, textTransform: "uppercase", color: bias.summary?.bias === "bullish" ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {bias.summary?.bias || "NEUTRAL"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Setup: <span style={{ color: "white", fontWeight: 600 }}>{bias.summary?.setup}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Confidence Score: <span className="mono" style={{ color: "var(--accent-cyan)" }}>{((bias.summary?.confidence || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: "20px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>Timeframe Analysis Rationale:</div>
                    <pre className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(bias.rationale || bias, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Click to load bias analysis</div>
              )}
            </div>
          )}

          {/* TAB 5: PORTFOLIO, FUNDS & LEDGER STATEMENT */}
          {activeTab === "portfolio" && (
            <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <DollarSign size={18} color="var(--accent-yellow)" />
                <span>Account Funds, Margins & Ledger Statement</span>
              </div>

              {funds && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  <div className="glass-card" style={{ padding: "16px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>AVAILABLE BALANCE</span>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-green)" }} className="mono">
                      ₹{funds.availabelBalance ? Number(funds.availabelBalance).toLocaleString("en-IN") : "0.00"}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: "16px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>SOD LIMIT</span>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-cyan)" }} className="mono">
                      ₹{funds.sodLimit ? Number(funds.sodLimit).toLocaleString("en-IN") : "0.00"}
                    </div>
                  </div>
                  <div className="glass-card" style={{ padding: "16px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>COLLATERAL AMOUNT</span>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-yellow)" }} className="mono">
                      ₹{funds.collateralAmount ? Number(funds.collateralAmount).toLocaleString("en-IN") : "0.00"}
                    </div>
                  </div>
                </div>
              )}

              {ledger && (
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>Ledger Transactions (`GET /ledger`):</div>
                  <pre className="mono" style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "8px", fontSize: "11px", color: "var(--text-secondary)", overflowX: "auto" }}>
                    {JSON.stringify(ledger, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
