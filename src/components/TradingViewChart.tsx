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
}

export const TradingViewChart: React.FC<ChartProps> = ({
  symbol,
  interval,
  showIndicators = true,
  livePrice,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLazyLoading, setIsLazyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("00:00");

  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const lastCandleRef = useRef<any>(null);
  const allCandlesRef = useRef<any[]>([]);

  const isFetchingHistoricalRef = useRef(false);
  const hasLoadedHistoricalRef = useRef(false);

  // Smooth lerp animation refs for price and volume
  const targetPriceRef = useRef<number | null>(null);
  const currentVisualPriceRef = useRef<number | null>(null);
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

  // 2. Initial Chart Render & Data Fetch
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart: any = null;
    let isSubscribed = true;

    // Reset refs on symbol/interval change
    isFetchingHistoricalRef.current = false;
    allCandlesRef.current = [];
    targetPriceRef.current = null;
    currentVisualPriceRef.current = null;
    currentVisualVolumeRef.current = null;

    const fetchAndRender = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(
          `/api/charts/intraday?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
        );
        const json = await res.json();

        if (!isSubscribed) return;

        if (!res.ok || !json.candles || json.candles.length === 0) {
          throw new Error(json.error || "Failed to load candle data");
        }

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

        const formattedCandles = json.candles.map((c: any) => ({
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

        candlestickSeries.setData(formattedCandles);
        volumeSeries.setData(formattedVolume);

        if (formattedCandles.length > 0) {
          const last = { ...formattedCandles[formattedCandles.length - 1] };
          lastCandleRef.current = last;
          currentVisualPriceRef.current = last.close;
          currentVisualVolumeRef.current = last.volume;
        }

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

        // Subscribe to Scroll Events for Backward Lazy Loading
        chart.timeScale().subscribeVisibleLogicalRangeChange(async (newRange: any) => {
          if (!newRange || isFetchingHistoricalRef.current) return;

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
      }
    };
  }, [symbol, interval, showIndicators]);

  // 3. Smooth Price AND Volume Lerp Animation Loop (60fps requestAnimationFrame)
  useEffect(() => {
    if (!livePrice) return;

    const isSecondInterval = interval.endsWith("s");
    const barSeconds = isSecondInterval
      ? (parseInt(interval, 10) || 15)
      : (parseInt(interval, 10) || 15) * 60;

    const nowUnix = Math.floor(Date.now() / 1000);
    const targetBarTime = Math.floor(nowUnix / barSeconds) * barSeconds;

    // Check if timeframe bar boundary passed -> RECONCILE & FORM NEW CANDLE
    if (
      seriesRef.current &&
      lastCandleRef.current &&
      lastCandleRef.current.time &&
      targetBarTime > lastCandleRef.current.time
    ) {
      const displayPrice = currentVisualPriceRef.current ?? livePrice;

      // Reconcile previous candle
      seriesRef.current.update(lastCandleRef.current);

      // Form NEW candle
      const newCandle = {
        time: targetBarTime,
        open: displayPrice,
        high: displayPrice,
        low: displayPrice,
        close: displayPrice,
        volume: 0,
      };
      lastCandleRef.current = newCandle;
      currentVisualVolumeRef.current = 0;
      allCandlesRef.current.push(newCandle);

      seriesRef.current.update(newCandle);
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: targetBarTime,
          value: 0,
          color: "rgba(0, 245, 160, 0.35)",
        });
      }
    }

    targetPriceRef.current = livePrice;
    if (currentVisualPriceRef.current === null) {
      currentVisualPriceRef.current = livePrice;
    }

    let animId: number;
    const animate = () => {
      if (
        seriesRef.current &&
        lastCandleRef.current &&
        targetPriceRef.current !== null &&
        currentVisualPriceRef.current !== null
      ) {
        // Price lerp step
        const priceDiff = targetPriceRef.current - currentVisualPriceRef.current;
        if (Math.abs(priceDiff) < 0.005) {
          currentVisualPriceRef.current = targetPriceRef.current;
          
          const displayPrice = Number(currentVisualPriceRef.current.toFixed(2));
          const currentCandle = { ...lastCandleRef.current };
          currentCandle.close = displayPrice;
          currentCandle.high = Math.max(currentCandle.high, displayPrice);
          currentCandle.low = Math.min(currentCandle.low, displayPrice);
          
          lastCandleRef.current = currentCandle;
          seriesRef.current.update(currentCandle);
          return;
        }

        currentVisualPriceRef.current += priceDiff * 0.18;

        const displayPrice = Number(currentVisualPriceRef.current.toFixed(2));
        const currentCandle = { ...lastCandleRef.current };
        currentCandle.close = displayPrice;
        currentCandle.high = Math.max(currentCandle.high, displayPrice);
        currentCandle.low = Math.min(currentCandle.low, displayPrice);
        currentCandle.volume = currentCandle.volume || 0;

        // Smooth volume lerp step
        if (currentVisualVolumeRef.current === null) {
          currentVisualVolumeRef.current = currentCandle.volume;
        } else {
          const volDiff = currentCandle.volume - currentVisualVolumeRef.current;
          currentVisualVolumeRef.current += volDiff * 0.18;
        }

        lastCandleRef.current = currentCandle;
        seriesRef.current.update(currentCandle);

        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: currentCandle.time,
            value: Math.round(currentVisualVolumeRef.current ?? 0),
            color: currentCandle.close >= currentCandle.open ? "rgba(0, 245, 160, 0.35)" : "rgba(255, 73, 92, 0.35)",
          });
        }

        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [livePrice, interval]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "480px" }}>
      {/* Live Candle Countdown Badge */}
      <div style={{
        position: "absolute",
        top: 12,
        right: 16,
        padding: "6px 12px",
        borderRadius: "8px",
        background: "rgba(18, 22, 34, 0.85)",
        border: "1px solid var(--border-color)",
        backdropFilter: "blur(8px)",
        color: "var(--accent-yellow)",
        fontSize: "12px",
        fontWeight: 700,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }} className="mono">
        <Clock size={14} />
        <span>BAR CLOSES IN: {countdown}</span>
      </div>

      {isLazyLoading && (
        <div style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "6px 14px",
          borderRadius: "20px",
          background: "rgba(0, 229, 255, 0.15)",
          border: "1px solid var(--accent-cyan)",
          backdropFilter: "blur(8px)",
          color: "var(--accent-cyan)",
          fontSize: "11px",
          fontWeight: 700,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }} className="mono">
          ⚡ Lazy Loading Historical Daily Data...
        </div>
      )}

      {isLoading && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10, 13, 20, 0.8)",
          zIndex: 10,
          color: "#00E5FF",
          fontFamily: "var(--font-mono)",
          fontSize: "14px"
        }}>
          ⚡ Loading Real-Time Candles for {symbol}...
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10, 13, 20, 0.9)",
          zIndex: 10,
          color: "#FF495C",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          padding: "20px",
          textAlign: "center"
        }}>
          ⚠️ {error}
        </div>
      )}

      <div ref={chartContainerRef} style={{ width: "100%", height: "100%", minHeight: "480px" }} />
    </div>
  );
};

export default TradingViewChart;
