import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import { Clock, Eye, EyeOff, ChevronDown, ChevronUp, Sliders, Layers } from "lucide-react";
import {
  detectFVGs,
  detectOrderBlocks,
  detectMarketStructure,
  detectLiquidityPools,
  detectPremiumDiscount,
  FVGPattern,
  OrderBlockPattern,
  MarketStructureBreak,
  LiquidityPoolPattern,
  PremiumDiscountRange,
} from "../utils/smcEngine";
import { detectICTSessions, ICTSession } from "../utils/ictEngine";

export interface CandleTheme {
  id: string;
  name: string;
  upColor: string;
  downColor: string;
  volUpColor: string;
  volDownColor: string;
  priceLineColor: string;
}

export const CANDLE_THEMES: Record<string, CandleTheme> = {
  emerald: {
    id: "emerald",
    name: "Cyber Emerald",
    upColor: "#00F5A0",
    downColor: "#FF495C",
    volUpColor: "rgba(0, 245, 160, 0.35)",
    volDownColor: "rgba(255, 73, 92, 0.35)",
    priceLineColor: "#00F5A0",
  },
  classic: {
    id: "classic",
    name: "Classic TV",
    upColor: "#089981",
    downColor: "#F23645",
    volUpColor: "rgba(8, 153, 129, 0.35)",
    volDownColor: "rgba(242, 54, 69, 0.35)",
    priceLineColor: "#089981",
  },
  ice: {
    id: "ice",
    name: "Electric Ice",
    upColor: "#00E5FF",
    downColor: "#78909C",
    volUpColor: "rgba(0, 229, 255, 0.35)",
    volDownColor: "rgba(120, 144, 156, 0.35)",
    priceLineColor: "#00E5FF",
  },
  gold: {
    id: "gold",
    name: "Solar Gold",
    upColor: "#FFB800",
    downColor: "#A855F7",
    volUpColor: "rgba(255, 184, 0, 0.35)",
    volDownColor: "rgba(168, 85, 247, 0.35)",
    priceLineColor: "#FFB800",
  },
  neon: {
    id: "neon",
    name: "Midnight Neon",
    upColor: "#3B82F6",
    downColor: "#EC4899",
    volUpColor: "rgba(59, 130, 246, 0.35)",
    volDownColor: "rgba(236, 72, 153, 0.35)",
    priceLineColor: "#3B82F6",
  },
  bw: {
    id: "bw",
    name: "Black & White",
    upColor: "#FFFFFF",
    downColor: "#2A2E39",
    volUpColor: "rgba(255, 255, 255, 0.4)",
    volDownColor: "rgba(67, 70, 81, 0.5)",
    priceLineColor: "#FFFFFF",
  },
};

interface ChartProps {
  symbol: string;
  interval: string;
  showIndicators?: boolean;
  livePrice?: number;
  customCandles?: any[];
  tick?: any;
}

export const TradingViewChart: React.FC<ChartProps> = ({
  symbol,
  interval,
  showIndicators = true,
  livePrice,
  customCandles,
  tick,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLazyLoading, setIsLazyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("00:00");

  // Candle Theme State (persisted to localStorage)
  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("chart_candle_theme");
      if (saved && CANDLE_THEMES[saved]) return saved;
    } catch {}
    return "emerald";
  });

  // Hollow Candles Mode State (persisted to localStorage)
  const [isHollowMode, setIsHollowMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_hollow_candles") === "true";
    } catch {}
    return false;
  });

  const activeTheme = CANDLE_THEMES[selectedThemeId] || CANDLE_THEMES.emerald;
  const activeThemeRef = useRef(activeTheme);
  activeThemeRef.current = activeTheme;

  const isHollowRef = useRef(isHollowMode);
  isHollowRef.current = isHollowMode;

  // Helper to apply candle series options respecting active theme + hollow mode
  const applyCandleSeriesOptions = (theme: CandleTheme, hollow: boolean) => {
    if (!seriesRef.current) return;
    if (hollow) {
      seriesRef.current.applyOptions({
        upColor: "#0F131C", // Hollow transparent body matching background
        downColor: theme.downColor,
        borderVisible: true,
        borderUpColor: theme.upColor,
        borderDownColor: theme.downColor,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
        priceLineVisible: true,
        priceLineColor: theme.priceLineColor,
      });
    } else {
      seriesRef.current.applyOptions({
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderVisible: false,
        borderUpColor: theme.upColor,
        borderDownColor: theme.downColor,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
        priceLineVisible: true,
        priceLineColor: theme.priceLineColor,
      });
    }
  };

  // Indicator Management State (SMA 20 & EMA 9) — persisted to localStorage
  const [showIndicatorsPanel, setShowIndicatorsPanel] = useState(false);
  const [indicatorVisibility, setIndicatorVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem("chart_indicator_visibility");
      if (saved) return JSON.parse(saved) as { sma20: boolean; ema9: boolean };
    } catch {}
    return { sma20: true, ema9: true };
  });

  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const lastCandleValRef = useRef<any>(null);
  const allCandlesRef = useRef<any[]>([]);

  const isFetchingHistoricalRef = useRef(false);

  // Smooth LERP animation refs
  const targetPriceRef = useRef<number | null>(null);
  const currentVisualPriceRef = useRef<number | null>(null);
  const targetVolumeRef = useRef<number | null>(null);
  const currentVisualVolumeRef = useRef<number | null>(null);

  // Toggle Line Indicator Series Visibility dynamically — persists to localStorage
  const toggleIndicator = (key: "sma20" | "ema9") => {
    setIndicatorVisibility((prev) => {
      const nextVal = !prev[key];
      if (key === "sma20" && smaSeriesRef.current) {
        smaSeriesRef.current.applyOptions({ visible: nextVal });
      } else if (key === "ema9" && emaSeriesRef.current) {
        emaSeriesRef.current.applyOptions({ visible: nextVal });
      }
      const next = { ...prev, [key]: nextVal };
      try { localStorage.setItem("chart_indicator_visibility", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Switch & Persist Candle Theme dynamically (applies to candlesticks + volume series)
  const handleThemeChange = (themeId: string) => {
    const theme = CANDLE_THEMES[themeId];
    if (!theme) return;
    setSelectedThemeId(themeId);
    activeThemeRef.current = theme;
    try { localStorage.setItem("chart_candle_theme", themeId); } catch {}

    applyCandleSeriesOptions(theme, isHollowRef.current);

    if (volumeSeriesRef.current && allCandlesRef.current.length > 0) {
      const updatedVolume = allCandlesRef.current.map((c: any) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? theme.volUpColor : theme.volDownColor,
      }));
      volumeSeriesRef.current.setData(updatedVolume);
    }
  };

  // SMC Fair Value Gaps (FVG) State
  const [showFVG, setShowFVG] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_show_fvg") !== "false";
    } catch {}
    return true;
  });

  const toggleFVG = () => {
    setShowFVG((prev) => {
      const next = !prev;
      try { localStorage.setItem("chart_show_fvg", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    drawSMCBoxes();
  }, [showFVG]);

  // SMC Order Blocks (OB) State
  const [showOB, setShowOB] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_show_ob") !== "false";
    } catch {}
    return true;
  });

  const toggleOB = () => {
    setShowOB((prev) => {
      const next = !prev;
      try { localStorage.setItem("chart_show_ob", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    drawSMCBoxes();
  }, [showOB]);

  // SMC Market Structure (BOS & CHoCH) State
  const [showStructure, setShowStructure] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_show_structure") !== "false";
    } catch {}
    return true;
  });

  const toggleStructure = () => {
    setShowStructure((prev) => {
      const next = !prev;
      try { localStorage.setItem("chart_show_structure", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    drawSMCBoxes();
  }, [showStructure]);

  // SMC Liquidity Pools & Sweeps (BSL / SSL) State
  const [showLiquidity, setShowLiquidity] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_show_liquidity") !== "false";
    } catch {}
    return true;
  });

  const toggleLiquidity = () => {
    setShowLiquidity((prev) => {
      const next = !prev;
      try { localStorage.setItem("chart_show_liquidity", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    drawSMCBoxes();
  }, [showLiquidity]);

  // SMC Premium vs Discount Equilibrium (0.50 Level) State
  const [showEquilibrium, setShowEquilibrium] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_show_equilibrium") !== "false";
    } catch {}
    return true;
  });

  const toggleEquilibrium = () => {
    setShowEquilibrium((prev) => {
      const next = !prev;
      try { localStorage.setItem("chart_show_equilibrium", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    drawSMCBoxes();
  }, [showEquilibrium]);

  // ICT Sessions & Kill Zones (Asia, London, NY) State
  const [showICTSessions, setShowICTSessions] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chart_show_ict_sessions") !== "false";
    } catch {}
    return true;
  });

  const toggleICTSessions = () => {
    setShowICTSessions((prev) => {
      const next = !prev;
      try { localStorage.setItem("chart_show_ict_sessions", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    drawSMCBoxes();
  }, [showICTSessions]);

  const smcCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render 2D Shaded Rectangle Boxes for FVGs & OBs + Market Structure Lines (BOS/CHoCH) + Liquidity Pools (BSL/SSL) + Equilibrium (P/D) + ICT Sessions
  const drawSMCBoxes = () => {
    const canvas = smcCanvasRef.current;
    if (!canvas || !chartRef.current || !seriesRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = chartContainerRef.current?.clientWidth || canvas.width;
    const height = chartContainerRef.current?.clientHeight || canvas.height;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const timeScale = chartRef.current.timeScale();
    const series = seriesRef.current;

    const maxVisibleX = width - 70; // Hard boundary to prevent elements from bleeding into price scale axis

    // 1. Draw Shaded Valid Active FVG Boxes
    if (showFVG && allCandlesRef.current.length >= 3) {
      const activeFVGs = detectFVGs(allCandlesRef.current)
        .filter((f) => !f.mitigated)
        .slice(-4);

      activeFVGs.forEach((fvg) => {
        const yTop = series.priceToCoordinate(fvg.top);
        const yBot = series.priceToCoordinate(fvg.bottom);
        const xStart = timeScale.timeToCoordinate(fvg.startTime);
        const xEnd = timeScale.timeToCoordinate(fvg.endTime);

        if (yTop !== null && yBot !== null) {
          const isBull = fvg.type === "BULLISH";
          const startX = xStart !== null ? Math.max(0, xStart) : 0;
          const endX = xEnd !== null ? Math.min(maxVisibleX, xEnd) : maxVisibleX;
          const boxWidth = endX - startX;

          if (boxWidth <= 5 || startX >= maxVisibleX) return;

          ctx.fillStyle = isBull ? "rgba(0, 245, 160, 0.14)" : "rgba(255, 73, 92, 0.14)";
          ctx.fillRect(startX, yTop, boxWidth, yBot - yTop);

          ctx.strokeStyle = isBull ? "rgba(0, 245, 160, 0.6)" : "rgba(255, 73, 92, 0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(startX, yTop, boxWidth, yBot - yTop);

          ctx.fillStyle = isBull ? "#00F5A0" : "#FF495C";
          ctx.font = "bold 9px monospace";
          ctx.fillText(isBull ? "BULL FVG" : "BEAR FVG", startX + 4, yTop + 11);
        }
      });
    }

    // 2. Draw Shaded Valid Active OB Boxes
    if (showOB && allCandlesRef.current.length >= 5) {
      const activeOBs = detectOrderBlocks(allCandlesRef.current)
        .filter((o) => !o.mitigated)
        .slice(-3);

      activeOBs.forEach((ob) => {
        const yTop = series.priceToCoordinate(ob.top);
        const yBot = series.priceToCoordinate(ob.bottom);
        const xStart = timeScale.timeToCoordinate(ob.startTime);
        const xEnd = timeScale.timeToCoordinate(ob.endTime);

        if (yTop !== null && yBot !== null) {
          const isBull = ob.type === "BULLISH_OB";
          const startX = xStart !== null ? Math.max(0, xStart) : 0;
          const endX = xEnd !== null ? Math.min(maxVisibleX, xEnd) : maxVisibleX;
          const boxWidth = endX - startX;

          if (boxWidth <= 5 || startX >= maxVisibleX) return;

          ctx.fillStyle = isBull ? "rgba(0, 229, 255, 0.18)" : "rgba(236, 72, 153, 0.18)";
          ctx.fillRect(startX, yTop, boxWidth, yBot - yTop);

          ctx.strokeStyle = isBull ? "rgba(0, 229, 255, 0.8)" : "rgba(236, 72, 153, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(startX, yTop, boxWidth, yBot - yTop);

          ctx.fillStyle = isBull ? "#00E5FF" : "#EC4899";
          ctx.font = "bold 9px monospace";
          ctx.fillText(isBull ? "DEMAND OB" : "SUPPLY OB", startX + 4, yTop + 11);
        }
      });
    }

    // 3. Draw Market Structure Lines (Macro/Major BOS & CHoCH + Micro/Internal iBOS & iCHoCH)
    if (showStructure && allCandlesRef.current.length >= 10) {
      const structBreaks = detectMarketStructure(allCandlesRef.current).slice(-8);

      structBreaks.forEach((sb) => {
        const yLine = series.priceToCoordinate(sb.level);
        const xSwing = timeScale.timeToCoordinate(sb.swingTime);
        const xBreak = timeScale.timeToCoordinate(sb.breakTime);

        if (yLine !== null) {
          const isBull = sb.type.startsWith("BULLISH");
          const isChoch = sb.type.includes("CHOCH");
          const isMajor = sb.category === "MAJOR";

          const startX = xSwing !== null ? Math.max(0, xSwing) : 0;
          const endX = xBreak !== null ? Math.min(maxVisibleX, xBreak) : maxVisibleX;
          const lineWidth = endX - startX;

          if (lineWidth <= 5 || startX >= maxVisibleX) return;

          let strokeColor = isBull ? "#00F5A0" : "#FF495C";
          if (!isMajor) {
            strokeColor = isBull ? "#00E5FF" : "#EC4899";
          }

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = isMajor ? (isChoch ? 2.0 : 1.5) : (isChoch ? 1.2 : 1.0);

          if (isMajor) {
            ctx.setLineDash(isChoch ? [] : [6, 4]);
          } else {
            ctx.setLineDash(isChoch ? [] : [2, 3]);
          }

          ctx.beginPath();
          ctx.moveTo(startX, yLine);
          ctx.lineTo(endX, yLine);
          ctx.stroke();
          ctx.setLineDash([]);

          let labelText = "";
          if (isMajor) {
            labelText = isChoch ? (isBull ? "MAJOR CHoCH 🟢" : "MAJOR CHoCH 🔴") : (isBull ? "MAJOR BOS 🟢" : "MAJOR BOS 🔴");
          } else {
            labelText = isChoch ? (isBull ? "iCHoCH 🟢" : "iCHoCH 🔴") : (isBull ? "iBOS 🟢" : "iBOS 🔴");
          }

          const centerX = startX + lineWidth / 2;
          const labelY = isBull ? yLine - 5 : yLine + 12;

          ctx.fillStyle = strokeColor;
          ctx.font = isMajor ? "bold 10px monospace" : "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(labelText, centerX, labelY);
          ctx.textAlign = "left";
        }
      });
    }

    // 4. Draw Liquidity Pools (BSL & SSL) and Sweep Badges
    if (showLiquidity && allCandlesRef.current.length >= 10) {
      const pools = detectLiquidityPools(allCandlesRef.current).slice(-6);

      pools.forEach((pool) => {
        const yLine = series.priceToCoordinate(pool.level);
        const xStart = timeScale.timeToCoordinate(pool.startTime);
        const targetEnd = pool.swept ? (pool.sweepTime || pool.startTime) : allCandlesRef.current[allCandlesRef.current.length - 1].time;
        const xEnd = timeScale.timeToCoordinate(targetEnd);

        if (yLine !== null) {
          const isBSL = pool.type === "BSL";
          const startX = xStart !== null ? Math.max(0, xStart) : 0;
          const endX = xEnd !== null ? Math.min(maxVisibleX, xEnd) : maxVisibleX;
          const lineWidth = endX - startX;

          if (lineWidth <= 5 || startX >= maxVisibleX) return;

          const color = isBSL ? "#00E5FF" : "#EC4899";
          ctx.strokeStyle = color;
          ctx.lineWidth = pool.swept ? 1.5 : 1.0;

          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(startX, yLine);
          ctx.lineTo(endX, yLine);
          ctx.stroke();
          ctx.setLineDash([]);

          const labelText = isBSL
            ? (pool.swept ? "BSL SWEEPT ⚡" : "BSL (Equal Highs)")
            : (pool.swept ? "SSL SWEEPT ⚡" : "SSL (Equal Lows)");
          const centerX = startX + lineWidth / 2;
          const labelY = isBSL ? yLine - 4 : yLine + 11;

          ctx.fillStyle = pool.swept ? (isBSL ? "#00F5A0" : "#FF495C") : color;
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(labelText, centerX, labelY);
          ctx.textAlign = "left";

          if (pool.swept && pool.sweepTime) {
            const xSweep = timeScale.timeToCoordinate(pool.sweepTime);
            if (xSweep !== null && xSweep < maxVisibleX) {
              ctx.fillStyle = isBSL ? "rgba(0, 245, 160, 0.25)" : "rgba(255, 73, 92, 0.25)";
              ctx.fillRect(xSweep - 22, isBSL ? yLine - 22 : yLine + 5, 44, 14);

              ctx.strokeStyle = isBSL ? "#00F5A0" : "#FF495C";
              ctx.lineWidth = 1;
              ctx.strokeRect(xSweep - 22, isBSL ? yLine - 22 : yLine + 5, 44, 14);

              ctx.fillStyle = "#FFFFFF";
              ctx.font = "bold 8px monospace";
              ctx.textAlign = "center";
              ctx.fillText("SWEEPT ⚡", xSweep, isBSL ? yLine - 12 : yLine + 15);
              ctx.textAlign = "left";
            }
          }
        }
      });
    }

    // 5. Draw Premium vs. Discount Equilibrium Zones (0.50 Midline)
    if (showEquilibrium && allCandlesRef.current.length >= 20) {
      const pd = detectPremiumDiscount(allCandlesRef.current);
      if (pd) {
        const yHigh = series.priceToCoordinate(pd.swingHigh);
        const yLow = series.priceToCoordinate(pd.swingLow);
        const yEq = series.priceToCoordinate(pd.equilibrium);
        const xStart = timeScale.timeToCoordinate(pd.startTime);

        if (yHigh !== null && yLow !== null && yEq !== null) {
          const startX = xStart !== null ? Math.max(0, xStart) : 0;
          const boxWidth = Math.max(30, maxVisibleX - startX);

          if (startX < maxVisibleX) {
            // A. Premium Zone (Overvalued / Sell Zone)
            ctx.fillStyle = "rgba(255, 73, 92, 0.05)";
            ctx.fillRect(startX, yHigh, boxWidth, yEq - yHigh);

            // B. Discount Zone (Undervalued / Buy Zone)
            ctx.fillStyle = "rgba(0, 245, 160, 0.05)";
            ctx.fillRect(startX, yEq, boxWidth, yLow - yEq);

            // C. 0.50 Equilibrium Midline
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, yEq);
            ctx.lineTo(maxVisibleX, yEq);
            ctx.stroke();
            ctx.setLineDash([]);

            // Centered Midline Label
            const centerX = startX + boxWidth / 2;
            ctx.fillStyle = "#FFD700";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.fillText("0.50 EQUILIBRIUM", centerX, yEq - 4);

            // Premium & Discount Corner Watermark Tags
            ctx.fillStyle = "rgba(255, 73, 92, 0.7)";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "right";
            ctx.fillText("PREMIUM (SELL ZONE)", maxVisibleX - 10, yHigh + 14);

            ctx.fillStyle = "rgba(0, 245, 160, 0.7)";
            ctx.fillText("DISCOUNT (BUY ZONE)", maxVisibleX - 10, yLow - 6);
            ctx.textAlign = "left";
          }
        }
      }
    }

    // 6. Draw ICT Sessions & Kill Zones (Asia Range, London KZ, New York KZ)
    if (showICTSessions && allCandlesRef.current.length >= 10) {
      const sessions = detectICTSessions(allCandlesRef.current).slice(-10);

      sessions.forEach((s) => {
        const xStart = timeScale.timeToCoordinate(s.startTime);
        const xEnd = timeScale.timeToCoordinate(s.endTime);

        if (xStart !== null) {
          const startX = Math.max(0, xStart);
          const endX = xEnd !== null ? Math.min(maxVisibleX, xEnd) : maxVisibleX;
          const bandWidth = endX - startX;

          if (bandWidth <= 4 || startX >= maxVisibleX) return;

          let bgStyle = "rgba(147, 51, 234, 0.08)";
          let strokeStyle = "#9333EA";
          let badgeBg = "#9333EA";

          if (s.type === "LONDON") {
            bgStyle = "rgba(0, 229, 255, 0.09)";
            strokeStyle = "#00E5FF";
            badgeBg = "#00E5FF";
          } else if (s.type === "NEW_YORK") {
            bgStyle = "rgba(255, 170, 0, 0.09)";
            strokeStyle = "#FFAA00";
            badgeBg = "#FFAA00";
          }

          ctx.fillStyle = bgStyle;
          ctx.fillRect(startX, 0, bandWidth, height);

          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, 2);
          ctx.lineTo(endX, 2);
          ctx.stroke();

          const centerX = startX + bandWidth / 2;
          ctx.fillStyle = badgeBg;
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(s.name, centerX, 12);
          ctx.textAlign = "left";
        }
      });
    }
  };

  // Toggle Hollow Candles Mode (persisted to localStorage)
  const toggleHollowMode = () => {
    const nextHollow = !isHollowMode;
    setIsHollowMode(nextHollow);
    isHollowRef.current = nextHollow;
    try { localStorage.setItem("chart_hollow_candles", String(nextHollow)); } catch {}
    applyCandleSeriesOptions(activeThemeRef.current, nextHollow);
  };

  // 1. Candle Countdown Timer (MM:SS)
  useEffect(() => {
    const barSeconds = (parseInt(interval, 10) || 15) * 60;

    const updateCountdown = () => {
      const nowUnix = Math.floor(Date.now() / 1000);
      const currentBarStart = Math.floor(nowUnix / barSeconds) * barSeconds;
      const nextBarStart = currentBarStart + barSeconds;
      const diff = Math.max(0, nextBarStart - nowUnix);

      const mins = Math.floor(diff / 60).toString().padStart(2, "0");
      const secs = (diff % 60).toString().padStart(2, "0");
      setCountdown(`${mins}:${secs}`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [interval]);

  // 2. Initial Chart Render & Authoritative Data Sync
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart: any = null;
    let isSubscribed = true;

    isFetchingHistoricalRef.current = false;
    allCandlesRef.current = [];
    lastCandleValRef.current = null;
    targetPriceRef.current = null;
    currentVisualPriceRef.current = null;
    targetVolumeRef.current = null;
    currentVisualVolumeRef.current = null;

    const fetchAndRender = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let candlesArray: any[] = [];
        if (customCandles && customCandles.length > 0) {
          candlesArray = customCandles;
        } else {
          const res = await fetch(
            `/api/charts/intraday?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
          );
          const json = await res.json();
          if (!res.ok || !json.candles || json.candles.length === 0) {
            throw new Error(json.error || "Failed to load candle data");
          }
          candlesArray = json.candles;
        }

        if (!isSubscribed) return;

        const formattedCandles = candlesArray.map((c: any) => ({
          time: Number(c.time),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
        }));

        // Only overwrite allCandlesRef on fresh mount (not during reload)
        if (allCandlesRef.current.length === 0) {
          allCandlesRef.current = formattedCandles;
        }

        const formattedVolume = formattedCandles.map((c: any) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? activeThemeRef.current.volUpColor : activeThemeRef.current.volDownColor,
        }));

        if (!chart) {
          if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = "";
          }

          chart = createChart(chartContainerRef.current!, {
            layout: {
              background: { type: ColorType.Solid, color: "#0F131C" },
              textColor: "#8E9BAE",
            },
            width: chartContainerRef.current!.clientWidth,
            height: chartContainerRef.current!.clientHeight || 520,
            grid: {
              vertLines: { color: "rgba(255, 255, 255, 0.05)" },
              horzLines: { color: "rgba(255, 255, 255, 0.05)" },
            },
            timeScale: {
              rightOffset: 5,
              timeVisible: true,
              borderColor: "rgba(255, 255, 255, 0.1)",
            },
            localization: {
              locale: "en-IN",
              timeFormatter: (timestamp: number) => {
                const date = new Date(timestamp * 1000);
                return (
                  date.toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour12: true,
                    hour: "2-digit",
                    minute: "2-digit",
                  }) + " IST"
                );
              },
              dateFormat: "dd MMM yyyy",
            },
          });

          chartRef.current = chart;

          const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: isHollowRef.current ? "#0F131C" : activeThemeRef.current.upColor,
            downColor: activeThemeRef.current.downColor,
            borderVisible: isHollowRef.current,
            borderUpColor: activeThemeRef.current.upColor,
            borderDownColor: activeThemeRef.current.downColor,
            wickUpColor: activeThemeRef.current.upColor,
            wickDownColor: activeThemeRef.current.downColor,
            priceLineVisible: true,
            priceLineColor: activeThemeRef.current.priceLineColor,
          });

          seriesRef.current = candlestickSeries;

          // Volume Histogram on dedicated volume price scale (Bottom 25% of chart)
          const volumeSeries = chart.addSeries(HistogramSeries, {
            color: "rgba(0, 229, 255, 0.35)",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            visible: true,
          });
          volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.75, bottom: 0 },
          });
          volumeSeriesRef.current = volumeSeries;

          candlestickSeries.setData(formattedCandles);
          volumeSeries.setData(formattedVolume);

          // Draw 2D SMC Shaded Box Overlays
          drawSMCBoxes();

          if (showIndicators && formattedCandles.length > 9) {
            // 1. SMA 20
            if (formattedCandles.length > 20) {
              const smaSeries = chart.addSeries(LineSeries, {
                color: "#00E5FF",
                lineWidth: 1.5,
                title: "SMA 20",
                priceLineVisible: false,
                lastValueVisible: false,
                visible: indicatorVisibility.sma20,
              });
              smaSeriesRef.current = smaSeries;

              const smaData = [];
              for (let i = 19; i < formattedCandles.length; i++) {
                const slice = formattedCandles.slice(i - 19, i + 1);
                const avg = slice.reduce((sum: number, x: any) => sum + x.close, 0) / 20;
                smaData.push({ time: formattedCandles[i].time, value: avg });
              }
              smaSeries.setData(smaData);
            }

            // 2. EMA 9
            const emaSeries = chart.addSeries(LineSeries, {
              color: "#FFD700",
              lineWidth: 1.5,
              title: "EMA 9",
              priceLineVisible: false,
              lastValueVisible: false,
              visible: indicatorVisibility.ema9,
            });
            emaSeriesRef.current = emaSeries;

            const k = 2 / (9 + 1);
            let ema = formattedCandles[0].close;
            const emaData = [{ time: formattedCandles[0].time, value: ema }];

            for (let i = 1; i < formattedCandles.length; i++) {
              ema = formattedCandles[i].close * k + ema * (1 - k);
              emaData.push({ time: formattedCandles[i].time, value: Number(ema.toFixed(2)) });
            }
            emaSeries.setData(emaData);
          }

          chart.timeScale().fitContent();
          chart.timeScale().applyOptions({ rightOffset: 5 });

          // Scroll listener for Lazy Loading & SMC Canvas Box redraw on scroll/zoom
          chart.timeScale().subscribeVisibleLogicalRangeChange(async (newRange: any) => {
            drawSMCBoxes();
            if (!newRange || isFetchingHistoricalRef.current || (customCandles && customCandles.length > 0)) return;

            if (newRange.from < 5) {
              isFetchingHistoricalRef.current = true;
              setIsLazyLoading(true);

              // Use the earliest loaded candle as toDate, go back 90 days (DhanHQ intraday limit)
              const earliestTime = allCandlesRef.current.length > 0
                ? allCandlesRef.current[0].time
                : Math.floor(Date.now() / 1000);
              const toDateObj = new Date(earliestTime * 1000);
              const fromDateObj = new Date(earliestTime * 1000);
              fromDateObj.setDate(fromDateObj.getDate() - 90);
              const fmt = (d: Date) => d.toISOString().split("T")[0];

              try {
                const histRes = await fetch(
                  `/api/charts/historical?symbol=${encodeURIComponent(symbol)}&fromDate=${fmt(fromDateObj)}&toDate=${fmt(toDateObj)}&interval=${interval}`
                );
                const histJson = await histRes.json();

                if (histJson.candles && histJson.candles.length > 0 && isSubscribed) {
                  const histCandles = histJson.candles.map((c: any) => ({
                    time: Number(c.time),
                    open: Number(c.open),
                    high: Number(c.high),
                    low: Number(c.low),
                    close: Number(c.close),
                    volume: Number(c.volume || 0),
                  }));

                  const existingTimeSet = new Set(allCandlesRef.current.map((x) => x.time));
                  const uniqueNewHist = histCandles.filter((x: any) => !existingTimeSet.has(x.time));

                  if (uniqueNewHist.length > 0) {
                    const combined = [...uniqueNewHist, ...allCandlesRef.current].sort(
                      (a, b) => a.time - b.time
                    );
                    allCandlesRef.current = combined;

                    const combinedVolume = combined.map((c: any) => ({
                      time: c.time,
                      value: c.volume,
                      color: c.close >= c.open ? activeThemeRef.current.volUpColor : activeThemeRef.current.volDownColor,
                    }));

                    candlestickSeries.setData(combined);
                    volumeSeries.setData(combinedVolume);
                  }
                }
              } catch (err) {
                console.error("Lazy load historical error:", err);
              } finally {
                isFetchingHistoricalRef.current = false;
                setIsLazyLoading(false);
              }
            }
          });
        }

        if (formattedCandles.length > 0) {
          const last = { ...formattedCandles[formattedCandles.length - 1] };
          lastCandleValRef.current = last;
          currentVisualPriceRef.current = last.close;
          targetPriceRef.current = last.close;
          currentVisualVolumeRef.current = last.volume;
          targetVolumeRef.current = last.volume;
        }

        setIsLoading(false);
      } catch (err: any) {
        if (isSubscribed) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchAndRender();

    const resizeObserver = new ResizeObserver((entries) => {
      if (chart && entries[0] && entries[0].contentRect) {
        const { width } = entries[0].contentRect;
        if (width > 0) {
          chart.applyOptions({ width });
        }
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    // Periodic 60s Background Reconciliation to ensure all historical candles remain perfectly in sync
    const reconcileTimer = setInterval(async () => {
      if (!isSubscribed || customCandles?.length) return;
      try {
        const res = await fetch(
          `/api/charts/intraday?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
        );
        const json = await res.json();
        if (json?.candles?.length && seriesRef.current) {
          const authoritativeCandles = json.candles.map((c: any) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume || 0),
          }));

          allCandlesRef.current = authoritativeCandles;

          const formattedVolume = authoritativeCandles.map((c: any) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? activeThemeRef.current.volUpColor : activeThemeRef.current.volDownColor,
          }));

          seriesRef.current.setData(authoritativeCandles);
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.setData(formattedVolume);
          }
          drawSMCBoxes();
        }
      } catch (e) {}
    }, 60000);

    return () => {
      isSubscribed = false;
      clearInterval(reconcileTimer);
      resizeObserver.disconnect();
      if (chart) {
        chart.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, interval, showIndicators, customCandles]);

  // 3. 60 FPS LERP Animation Loop for Smooth Price Line & Volume Bar Transitions
  useEffect(() => {
    if (livePrice === undefined || livePrice === null || !seriesRef.current || !lastCandleValRef.current) return;

    targetPriceRef.current = livePrice;
    targetVolumeRef.current = (lastCandleValRef.current?.volume || 5000) + Math.floor(Math.random() * 50);

    if (currentVisualPriceRef.current === null) {
      currentVisualPriceRef.current = livePrice;
    }
    if (currentVisualVolumeRef.current === null) {
      currentVisualVolumeRef.current = targetVolumeRef.current;
    }

    const barSeconds = (parseInt(interval, 10) || 15) * 60;

    let animId: number;

    const animateLerp = () => {
      if (
        seriesRef.current &&
        lastCandleValRef.current &&
        targetPriceRef.current !== null &&
        currentVisualPriceRef.current !== null
      ) {
        const nowUnix = Math.floor(Date.now() / 1000);
        const targetBarTime = Math.floor(nowUnix / barSeconds) * barSeconds;
        const lastBarTime = lastCandleValRef.current.time || 0;

        const rawTargetLtp = targetPriceRef.current;

        // Smooth 60 FPS LERP Interpolation for price line visual gliding
        const priceDiff = rawTargetLtp - currentVisualPriceRef.current;
        if (Math.abs(priceDiff) > 0.01) {
          currentVisualPriceRef.current += priceDiff * 0.20;
        } else {
          currentVisualPriceRef.current = rawTargetLtp;
        }

        const displayPrice = Number(currentVisualPriceRef.current.toFixed(2));

        // Bar Boundary Protection: Lock closed candle & start NEW forming candle
        if (lastBarTime > 0 && targetBarTime >= lastBarTime + barSeconds) {
          const newCandle = {
            time: targetBarTime,
            open: rawTargetLtp,
            high: rawTargetLtp,
            low: rawTargetLtp,
            close: displayPrice,
            volume: 10,
          };
          currentVisualVolumeRef.current = 10;
          targetVolumeRef.current = 10;
          lastCandleValRef.current = newCandle;

          try {
            seriesRef.current.update(newCandle);
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: targetBarTime,
                value: 10,
                color: activeThemeRef.current.volUpColor,
              });
            }

            // Reconcile ALL previous candles with DhanHQ authoritative intraday endpoint 2.5s post-close
            setTimeout(async () => {
              try {
                const res = await fetch(
                  `/api/charts/intraday?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
                );
                const json = await res.json();
                if (json?.candles?.length && seriesRef.current) {
                  const authoritativeCandles = json.candles.map((c: any) => ({
                    time: Number(c.time),
                    open: Number(c.open),
                    high: Number(c.high),
                    low: Number(c.low),
                    close: Number(c.close),
                    volume: Number(c.volume || 0),
                  }));

                  allCandlesRef.current = authoritativeCandles;

                  const formattedVolume = authoritativeCandles.map((c: any) => ({
                    time: c.time,
                    value: c.volume,
                    color: c.close >= c.open ? activeThemeRef.current.volUpColor : activeThemeRef.current.volDownColor,
                  }));

                  seriesRef.current.setData(authoritativeCandles);
                  if (volumeSeriesRef.current) {
                    volumeSeriesRef.current.setData(formattedVolume);
                  }
                }
              } catch (e) {}
            }, 2500);
          } catch (e) {}
        } else {
          // Update active forming candle smoothly while evaluating high/low strictly on rawTargetLtp
          const activeCandle = { ...lastCandleValRef.current };
          activeCandle.close = displayPrice;
          activeCandle.high = Math.max(activeCandle.high ?? rawTargetLtp, rawTargetLtp);
          activeCandle.low = Math.min(activeCandle.low ?? rawTargetLtp, rawTargetLtp);

          // Volume LERP Step: smooth alpha = 0.18
          if (targetVolumeRef.current !== null && currentVisualVolumeRef.current !== null) {
            const volDiff = targetVolumeRef.current - currentVisualVolumeRef.current;
            if (Math.abs(volDiff) > 0.1) {
              currentVisualVolumeRef.current += volDiff * 0.18;
            } else {
              currentVisualVolumeRef.current = targetVolumeRef.current;
            }
            activeCandle.volume = Math.round(currentVisualVolumeRef.current);
          }

          lastCandleValRef.current = activeCandle;

          try {
            seriesRef.current.update(activeCandle);
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: activeCandle.time,
                value: activeCandle.volume,
                color: activeCandle.close >= activeCandle.open ? activeThemeRef.current.volUpColor : activeThemeRef.current.volDownColor,
              });
            }
          } catch (e) {}
        }
        drawSMCBoxes();
      }

      animId = requestAnimationFrame(animateLerp);
    };

    animId = requestAnimationFrame(animateLerp);
    return () => cancelAnimationFrame(animId);
  }, [livePrice, interval, tick]);

  const activeLtp = livePrice || tick?.ltp || (lastCandleValRef.current?.close || 24263.40);
  const activeChange = tick?.change !== undefined ? tick.change : 13.85;
  const activePChange = tick?.pChange !== undefined ? tick.pChange : 0.06;
  const activeVolume = tick?.volume || 199710932;
  const activeSymbolName = tick?.symbol || (symbol.toUpperCase() === "NIFTY" ? "NIFTY 50" : symbol.toUpperCase() === "BANKNIFTY" ? "NIFTY BANK" : symbol.toUpperCase());
  const tickTimeFormatted = tick?.timestamp
    ? new Date(tick.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST"
    : new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "520px" }}>
      {/* Top Left Overlay Container inside Chart Canvas */}
      <div style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
      }}>
        {/* ROW 1: Main Scrip Status Line */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          background: "rgba(15, 19, 28, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "6px 14px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        }}>
          {/* SYMBOL */}
          <span style={{ fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "0.3px" }}>{activeSymbolName}</span>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* LIVE PRICE (LTP) */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>LTP</span>
            <span style={{ fontWeight: 800, color: activeChange >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
              ₹{Number(activeLtp).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* DAY CHANGE */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>CHG</span>
            <span style={{ fontWeight: 700, color: activeChange >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
              {activeChange >= 0 ? "+" : ""}{Number(activeChange).toFixed(2)} ({activePChange >= 0 ? "+" : ""}{Number(activePChange).toFixed(2)}%)
            </span>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* TOTAL VOLUME */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>VOL</span>
            <span style={{ fontWeight: 700, color: "#FFFFFF" }}>
              {Number(activeVolume).toLocaleString("en-IN")}
            </span>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* LIVE TICK */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700 }}>TICK</span>
            <span style={{ fontSize: "11px", color: "var(--accent-green)", fontWeight: 700 }}>
              {tickTimeFormatted}
            </span>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* NEXT CANDLE COUNTDOWN */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent-cyan)" }}>
            <Clock size={11} />
            <span style={{ fontSize: "10px", fontWeight: 700 }}>NEXT</span>
            <span style={{ fontWeight: 800, fontSize: "11px" }}>{countdown}</span>
          </div>
        </div>

        {/* ROW 2: Indicators Bar positioned directly below Status Line */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(15, 19, 28, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "4px 12px",
          borderRadius: "6px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          width: "fit-content",
        }}>
          {/* INDICATORS DROPDOWN BUTTON */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowIndicatorsPanel(!showIndicatorsPanel)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: showIndicatorsPanel ? "rgba(0, 229, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
                color: showIndicatorsPanel ? "var(--accent-cyan)" : "var(--text-secondary)",
                border: showIndicatorsPanel ? "1px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.15)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Sliders size={11} />
              <span>INDICATORS</span>
              {showIndicatorsPanel ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {/* INDICATORS MANAGEMENT DROPDOWN DRAWER */}
            {showIndicatorsPanel && (
              <div style={{
                position: "absolute",
                top: "28px",
                left: 0,
                zIndex: 30,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "rgba(15, 19, 28, 0.95)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                minWidth: "190px",
              }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "4px" }}>
                  OVERLAY INDICATORS
                </div>

                {/* 1. SMA 20 TOGGLE */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00E5FF" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: indicatorVisibility.sma20 ? "#FFFFFF" : "var(--text-muted)" }}>SMA 20</span>
                  </div>
                  <button
                    onClick={() => toggleIndicator("sma20")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: indicatorVisibility.sma20 ? "var(--accent-cyan)" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={indicatorVisibility.sma20 ? "Hide SMA 20" : "Show SMA 20"}
                  >
                    {indicatorVisibility.sma20 ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                {/* 2. EMA 9 TOGGLE */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFD700" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: indicatorVisibility.ema9 ? "#FFFFFF" : "var(--text-muted)" }}>EMA 9</span>
                  </div>
                  <button
                    onClick={() => toggleIndicator("ema9")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: indicatorVisibility.ema9 ? "#FFD700" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={indicatorVisibility.ema9 ? "Hide EMA 9" : "Show EMA 9"}
                  >
                    {indicatorVisibility.ema9 ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "4px", marginTop: "6px" }}>
                  CANDLE & VOLUME THEME
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {Object.values(CANDLE_THEMES).map((theme) => {
                    const isSelected = theme.id === selectedThemeId;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => handleThemeChange(theme.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: isSelected ? "rgba(255, 255, 255, 0.12)" : "transparent",
                          border: isSelected ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid transparent",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#FFFFFF" : "var(--text-secondary)" }}>
                          {theme.name}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.upColor }} />
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.downColor }} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "4px", marginTop: "8px" }}>
                  SMART MONEY CONCEPTS (SMC)
                </div>

                {/* 1. Fair Value Gaps (FVG) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Layers size={12} color="#00F5A0" />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: showFVG ? "#FFFFFF" : "var(--text-muted)" }}>
                      Fair Value Gaps (FVG)
                    </span>
                  </div>
                  <button
                    onClick={toggleFVG}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: showFVG ? "var(--accent-green)" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={showFVG ? "Hide Fair Value Gaps" : "Show Fair Value Gaps"}
                  >
                    {showFVG ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                {/* 2. Order Blocks (OB) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#FF495C" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: showOB ? "#FFFFFF" : "var(--text-muted)" }}>
                      Order Blocks (OB)
                    </span>
                  </div>
                  <button
                    onClick={toggleOB}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: showOB ? "#FF495C" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={showOB ? "Hide Order Blocks" : "Show Order Blocks"}
                  >
                    {showOB ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                {/* 3. Market Structure (BOS / CHoCH) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "2px", background: "#00F5A0" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: showStructure ? "#FFFFFF" : "var(--text-muted)" }}>
                      Structure (BOS / CHoCH)
                    </span>
                  </div>
                  <button
                    onClick={toggleStructure}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: showStructure ? "#00F5A0" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={showStructure ? "Hide Market Structure" : "Show Market Structure"}
                  >
                    {showStructure ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                {/* 4. Liquidity Pools & Sweeps (BSL / SSL) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "2px", background: "#00E5FF" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: showLiquidity ? "#FFFFFF" : "var(--text-muted)" }}>
                      Liquidity (BSL / SSL)
                    </span>
                  </div>
                  <button
                    onClick={toggleLiquidity}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: showLiquidity ? "var(--accent-cyan)" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={showLiquidity ? "Hide Liquidity Pools & Sweeps" : "Show Liquidity Pools & Sweeps"}
                  >
                    {showLiquidity ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                {/* 5. ICT Sessions & Kill Zones (Asia, London, NY) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#9333EA" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: showICTSessions ? "#FFFFFF" : "var(--text-muted)" }}>
                      ICT Kill Zones (Asia/LDN/NY)
                    </span>
                  </div>
                  <button
                    onClick={toggleICTSessions}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: showICTSessions ? "#9333EA" : "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                    title={showICTSessions ? "Hide ICT Kill Zones" : "Show ICT Kill Zones"}
                  >
                    {showICTSessions ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>

                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "4px", marginTop: "8px" }}>
                  CANDLE BODY STYLE
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: isHollowMode ? "var(--accent-cyan)" : "#FFFFFF" }}>
                    Hollow Candles
                  </span>
                  <button
                    onClick={toggleHollowMode}
                    style={{
                      background: isHollowMode ? "rgba(0, 229, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
                      border: isHollowMode ? "1px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.15)",
                      color: isHollowMode ? "var(--accent-cyan)" : "var(--text-muted)",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isHollowMode ? "HOLLOW" : "FILLED"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* SMA 20 Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00E5FF" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: indicatorVisibility.sma20 ? "#00E5FF" : "var(--text-muted)" }}>SMA 20</span>
            <button
              onClick={() => toggleIndicator("sma20")}
              style={{ background: "transparent", border: "none", color: indicatorVisibility.sma20 ? "var(--accent-cyan)" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={indicatorVisibility.sma20 ? "Hide SMA 20" : "Show SMA 20"}
            >
              {indicatorVisibility.sma20 ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* EMA 9 Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FFD700" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: indicatorVisibility.ema9 ? "#FFD700" : "var(--text-muted)" }}>EMA 9</span>
            <button
              onClick={() => toggleIndicator("ema9")}
              style={{ background: "transparent", border: "none", color: indicatorVisibility.ema9 ? "#FFD700" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={indicatorVisibility.ema9 ? "Hide EMA 9" : "Show EMA 9"}
            >
              {indicatorVisibility.ema9 ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* SMC FVG Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: showFVG ? "#00F5A0" : "var(--text-muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: showFVG ? "#00F5A0" : "var(--text-muted)" }}>SMC FVG</span>
            <button
              onClick={toggleFVG}
              style={{ background: "transparent", border: "none", color: showFVG ? "var(--accent-green)" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={showFVG ? "Hide Fair Value Gaps" : "Show Fair Value Gaps"}
            >
              {showFVG ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* SMC OB Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: showOB ? "#FF495C" : "var(--text-muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: showOB ? "#FF495C" : "var(--text-muted)" }}>SMC OB</span>
            <button
              onClick={toggleOB}
              style={{ background: "transparent", border: "none", color: showOB ? "#FF495C" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={showOB ? "Hide Order Blocks" : "Show Order Blocks"}
            >
              {showOB ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* SMC Struct Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "2px", background: showStructure ? "#00F5A0" : "var(--text-muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: showStructure ? "#00F5A0" : "var(--text-muted)" }}>SMC Struct</span>
            <button
              onClick={toggleStructure}
              style={{ background: "transparent", border: "none", color: showStructure ? "#00F5A0" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={showStructure ? "Hide Market Structure" : "Show Market Structure"}
            >
              {showStructure ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* SMC Liq Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "2px", background: showLiquidity ? "#00E5FF" : "var(--text-muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: showLiquidity ? "#00E5FF" : "var(--text-muted)" }}>SMC Liq</span>
            <button
              onClick={toggleLiquidity}
              style={{ background: "transparent", border: "none", color: showLiquidity ? "var(--accent-cyan)" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={showLiquidity ? "Hide Liquidity Pools & Sweeps" : "Show Liquidity Pools & Sweeps"}
            >
              {showLiquidity ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* SMC P/D Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "2px", background: showEquilibrium ? "#FFD700" : "var(--text-muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: showEquilibrium ? "#FFD700" : "var(--text-muted)" }}>SMC P/D</span>
            <button
              onClick={toggleEquilibrium}
              style={{ background: "transparent", border: "none", color: showEquilibrium ? "#FFD700" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={showEquilibrium ? "Hide Equilibrium & P/D Zones" : "Show Equilibrium & P/D Zones"}
            >
              {showEquilibrium ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>

          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>•</span>

          {/* ICT Sessions Quick Eye Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: showICTSessions ? "#9333EA" : "var(--text-muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: showICTSessions ? "#9333EA" : "var(--text-muted)" }}>ICT Sessions</span>
            <button
              onClick={toggleICTSessions}
              style={{ background: "transparent", border: "none", color: showICTSessions ? "#9333EA" : "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              title={showICTSessions ? "Hide ICT Kill Zones" : "Show ICT Kill Zones"}
            >
              {showICTSessions ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15, 19, 28, 0.8)",
          color: "var(--accent-cyan)",
          fontFamily: "var(--font-mono)",
          fontSize: "14px"
        }}>
          Loading Real-Time Chart...
        </div>
      )}

      {/* Lazy Loading Indicator */}
      {isLazyLoading && (
        <div style={{
          position: "absolute",
          top: "40px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 15,
          background: "rgba(0, 229, 255, 0.2)",
          color: "var(--accent-cyan)",
          padding: "4px 12px",
          borderRadius: "4px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          border: "1px solid var(--accent-cyan)"
        }}>
          Loading historical candles...
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15, 19, 28, 0.9)",
          color: "var(--accent-red)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          padding: "20px",
          textAlign: "center"
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 2D Shaded SMC Overlay Canvas */}
      <canvas
        ref={smcCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* Canvas Container */}
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%", minHeight: "520px" }} />
    </div>
  );
};
