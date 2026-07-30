import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import { Clock } from "lucide-react";

interface ChartProps {
  symbol: string;
  interval: string;
  showIndicators?: boolean;
  livePrice?: number;
  customCandles?: any[];
}

export const TradingViewChart: React.FC<ChartProps> = ({
  symbol,
  interval,
  showIndicators = true,
  livePrice,
  customCandles,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLazyLoading, setIsLazyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("00:00");

  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const lastCandleRef = useRef<any>(null);
  const allCandlesRef = useRef<any[]>([]);

  const isFetchingHistoricalRef = useRef(false);

  // Smooth LERP animation refs
  const targetPriceRef = useRef<number | null>(null);
  const currentVisualPriceRef = useRef<number | null>(null);
  const targetVolumeRef = useRef<number | null>(null);
  const currentVisualVolumeRef = useRef<number | null>(null);

  // 1. Candle Countdown Timer (MM:SS)
  useEffect(() => {
    const isSecondInterval = interval.endsWith("s");
    const barSeconds = isSecondInterval
      ? (parseInt(interval, 10) || 15)
      : (parseInt(interval, 10) || 15) * 60;

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
    lastCandleRef.current = null;
    targetPriceRef.current = null;
    currentVisualPriceRef.current = null;
    targetVolumeRef.current = null;
    currentVisualVolumeRef.current = null;

    const fetchAndRender = async (isSilentUpdate = false) => {
      try {
        if (!isSilentUpdate) {
          setIsLoading(true);
          setError(null);
        }

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

        allCandlesRef.current = formattedCandles;

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
            height: chartContainerRef.current!.clientHeight || 480,
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

          const volumeSeries = chart.addSeries(HistogramSeries, {
            color: "rgba(0, 229, 255, 0.3)",
            priceFormat: { type: "volume" },
            priceScaleId: "",
          });
          volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });
          volumeSeriesRef.current = volumeSeries;

          candlestickSeries.setData(formattedCandles);
          volumeSeries.setData(formattedVolume);

          if (showIndicators && formattedCandles.length > 20) {
            const smaSeries = chart.addSeries(LineSeries, {
              color: "#00E5FF",
              lineWidth: 1.5,
              title: "SMA 20",
            });

            const smaData = [];
            for (let i = 19; i < formattedCandles.length; i++) {
              const slice = formattedCandles.slice(i - 19, i + 1);
              const avg = slice.reduce((sum: number, x: any) => sum + x.close, 0) / 20;
              smaData.push({ time: formattedCandles[i].time, value: avg });
            }
            smaSeries.setData(smaData);
          }

          chart.timeScale().fitContent();

          // Scroll listener for Lazy Loading
          chart.timeScale().subscribeVisibleLogicalRangeChange(async (newRange: any) => {
            if (!newRange || isFetchingHistoricalRef.current || (customCandles && customCandles.length > 0)) return;

            if (newRange.from < 5) {
              isFetchingHistoricalRef.current = true;
              setIsLazyLoading(true);

              try {
                const histRes = await fetch(
                  `/api/charts/historical?symbol=${encodeURIComponent(symbol)}&fromDate=2024-01-01`
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
        } else {
          // Silent data re-sync from DhanHQ API
          if (seriesRef.current) seriesRef.current.setData(formattedCandles);
          if (volumeSeriesRef.current) volumeSeriesRef.current.setData(formattedVolume);
        }

        if (formattedCandles.length > 0) {
          const last = { ...formattedCandles[formattedCandles.length - 1] };
          lastCandleRef.current = last;
          currentVisualPriceRef.current = last.close;
          targetPriceRef.current = last.close;
          currentVisualVolumeRef.current = last.volume;
          targetVolumeRef.current = last.volume;
        }

        if (!isSilentUpdate) setIsLoading(false);
      } catch (err: any) {
        if (isSubscribed && !isSilentUpdate) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchAndRender();

    // Auto-sync intraday candles with DhanHQ API every 5 seconds to keep closed & forming OHLC exact
    const pollTimer = setInterval(() => {
      fetchAndRender(true);
    }, 5000);

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
      clearInterval(pollTimer);
      resizeObserver.disconnect();
      if (chart) {
        chart.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, interval, showIndicators, customCandles]);

  // 3. 60 FPS LERP Animation Loop for Smooth Price Line & Volume Bar Transitions
  useEffect(() => {
    if (livePrice === undefined || livePrice === null || !seriesRef.current || !lastCandleRef.current) return;

    targetPriceRef.current = livePrice;
    targetVolumeRef.current = (targetVolumeRef.current || lastCandleRef.current?.volume || 100) + Math.floor(Math.random() * 5);

    if (currentVisualPriceRef.current === null) {
      currentVisualPriceRef.current = livePrice;
    }
    if (currentVisualVolumeRef.current === null) {
      currentVisualVolumeRef.current = targetVolumeRef.current;
    }

    const isSecondInterval = interval.endsWith("s");
    const barSeconds = isSecondInterval
      ? (parseInt(interval, 10) || 15)
      : (parseInt(interval, 10) || 15) * 60;

    let animId: number;

    const animateLerp = () => {
      if (
        seriesRef.current &&
        lastCandleRef.current &&
        targetPriceRef.current !== null &&
        currentVisualPriceRef.current !== null
      ) {
        const nowUnix = Math.floor(Date.now() / 1000);
        const targetBarTime = Math.floor(nowUnix / barSeconds) * barSeconds;
        const lastBarTime = lastCandleRef.current.time || 0;

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
          lastCandleRef.current = newCandle;

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
          const activeCandle = { ...lastCandleRef.current };
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

          lastCandleRef.current = activeCandle;

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
  }, [livePrice, interval]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "480px" }}>
      {/* Live Candle Countdown Badge */}
      <div style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(15, 19, 28, 0.85)",
        backdropFilter: "blur(6px)",
        padding: "4px 10px",
        borderRadius: "6px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: "var(--accent-cyan)"
      }}>
        <Clock size={12} />
        <span>NEXT CANDLE IN: {countdown}</span>
      </div>

      {/* Live Price Tag Overlay */}
      {livePrice && (
        <div style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(15, 19, 28, 0.9)",
          backdropFilter: "blur(6px)",
          padding: "5px 12px",
          borderRadius: "6px",
          border: "1px solid var(--accent-green)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          fontWeight: 700,
          color: "var(--accent-green)"
        }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-green)", boxShadow: "0 0 8px var(--accent-green)" }} />
          <span>LIVE LTP: ₹{Number(livePrice).toFixed(2)}</span>
        </div>
      )}

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
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%", minHeight: "480px" }} />
    </div>
  );
};
