import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import { Clock, Eye, EyeOff, ChevronDown, ChevronUp, Sliders } from "lucide-react";

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
          color: c.close >= c.open ? "rgba(0, 245, 160, 0.35)" : "rgba(255, 73, 92, 0.35)",
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
            upColor: "#00F5A0",
            downColor: "#FF495C",
            borderVisible: false,
            wickUpColor: "#00F5A0",
            wickDownColor: "#FF495C",
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

          // Scroll listener for Lazy Loading
          chart.timeScale().subscribeVisibleLogicalRangeChange(async (newRange: any) => {
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
                      color: c.close >= c.open ? "rgba(0, 245, 160, 0.35)" : "rgba(255, 73, 92, 0.35)",
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

    return () => {
      isSubscribed = false;
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
                color: "rgba(0, 245, 160, 0.35)",
              });
            }
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
                color: activeCandle.close >= activeCandle.open ? "rgba(0, 245, 160, 0.35)" : "rgba(255, 73, 92, 0.35)",
              });
            }
          } catch (e) {}
        }
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

      {/* Canvas Container */}
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%", minHeight: "520px" }} />
    </div>
  );
};
