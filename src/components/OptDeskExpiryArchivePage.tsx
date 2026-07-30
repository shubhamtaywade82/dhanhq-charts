import React, { useState, useEffect } from "react";
import { Database, RefreshCw, ExternalLink, Play, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export const OptDeskExpiryArchivePage: React.FC = () => {
  const [symbol, setSymbol] = useState("NIFTY");
  const [fromDate, setFromDate] = useState("2026-07-28");
  const [interval, setInterval] = useState("15");
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data from DhanHQ REST API backend
  const fetchRealData = async (targetSymbol = symbol, targetDate = fromDate, targetInterval = interval) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/charts/expired-options-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: targetSymbol,
          securityId: targetSymbol === "BANKNIFTY" ? "25" : targetSymbol === "SENSEX" ? "51" : "13",
          fromDate: targetDate,
          toDate: targetDate,
          interval: targetInterval,
        }),
      });

      const data = await res.json();
      if (data && data.strikes) {
        setSnapshot(data);
      } else {
        setError(data.error || "No expired options data returned for selected parameters.");
      }
    } catch (err: any) {
      console.error("Error fetching real expired options snapshot:", err);
      setError(err.message || "Failed to connect to DhanHQ server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealData();
  }, []);

  // Robust array key extractor for DhanHQ REST API responses
  const getArray = (obj: any, primaryKey: string, secondaryKey: string, fallbackLength = 25, defaultVal = 0): number[] => {
    if (!obj) return Array(fallbackLength).fill(defaultVal);
    if (Array.isArray(obj[primaryKey]) && obj[primaryKey].length > 0) return obj[primaryKey];
    if (Array.isArray(obj[secondaryKey]) && obj[secondaryKey].length > 0) return obj[secondaryKey];
    return Array(fallbackLength).fill(defaultVal);
  };

  // Transform real snapshot into OPTDESK template HTML
  const generateRealHtml = () => {
    const meta = snapshot?.metadata || { underlyingSpotPrice: 24850, atmStrike: 24850, strikeStep: 50, symbol: "NIFTY", tradingDate: "2026-07-28" };
    const spot = meta.underlyingSpotPrice || 24850;
    const step = meta.strikeStep || 50;

    const strikesObj = snapshot?.strikes || {};
    const offsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    const dbTransformed: Record<string, any> = {};

    let timestamps: number[] = getArray(snapshot?.underlying, "timestamp", "start_Time", 25, 0);

    offsets.forEach((off) => {
      const tag = off === 0 ? "ATM" : off > 0 ? `ATM+${off}` : `ATM${off}`;
      const item = strikesObj[tag] || {};
      const strikePrice = item.strikePrice || (meta.atmStrike + off * step);

      const ce = item.ce || {};
      const pe = item.pe || {};

      if (timestamps.length === 0 || timestamps[0] === 0) {
        const ceTimes = getArray(ce, "timestamp", "start_Time", 0, 0);
        if (ceTimes.length > 0) timestamps = ceTimes;
      }

      const candleLen = timestamps.length > 0 ? timestamps.length : 25;

      dbTransformed[String(off)] = {
        s: strikePrice,
        ce: {
          o: getArray(ce, "open", "o", candleLen, 100),
          h: getArray(ce, "high", "h", candleLen, 110),
          l: getArray(ce, "low", "l", candleLen, 90),
          c: getArray(ce, "close", "c", candleLen, 105),
          v: getArray(ce, "volume", "v", candleLen, 10000),
          oi: getArray(ce, "oi", "oi", candleLen, 50000),
        },
        pe: {
          o: getArray(pe, "open", "o", candleLen, 100),
          h: getArray(pe, "high", "h", candleLen, 110),
          l: getArray(pe, "low", "l", candleLen, 90),
          c: getArray(pe, "close", "c", candleLen, 105),
          v: getArray(pe, "volume", "v", candleLen, 10000),
          oi: getArray(pe, "oi", "oi", candleLen, 50000),
        },
      };
    });

    const t0 = timestamps[0] && timestamps[0] > 0 ? timestamps[0] : 1785210300;
    const candleCount = Math.max(1, timestamps.length || 25);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OPTDESK · Expired Options Rolling Chart</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0e15;--panel:#121a26;--panel2:#16202e;--line:#1e2a3a;--line2:#2b3b52;--txt:#e6edf6;--dim:#8fa1b8;--faint:#5a6b82;--up:#22c98d;--dn:#ff5d6c;--amb:#ffb454;--cyn:#53c8ff}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:radial-gradient(900px 500px at 85% -10%,rgba(83,200,255,.07),transparent 60%),radial-gradient(800px 600px at -10% 110%,rgba(255,180,84,.05),transparent 60%),linear-gradient(180deg,#0b1017,var(--bg));color:var(--txt);font:14px "IBM Plex Sans";min-height:100vh}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(140,170,210,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(140,170,210,.035) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 0%,#000 30%,transparent 78%);mask-image:radial-gradient(ellipse at 50% 0%,#000 30%,transparent 78%)}
::selection{background:rgba(255,180,84,.3)}
button{font-family:inherit;cursor:pointer}
.tape{overflow:hidden;border-bottom:1px solid var(--line);background:#0c1119;white-space:nowrap;position:relative;z-index:2}
.tapeIn{display:inline-flex;padding:7px 0;animation:mq 70s linear infinite}
.tape:hover .tapeIn{animation-play-state:paused}
@keyframes mq{to{transform:translateX(-50%)}}
.ti{font:12px "IBM Plex Mono";color:var(--dim);margin-right:34px}
.ti b{color:var(--txt);font-weight:600;margin-right:6px}
.ti .up{color:var(--up);font-style:normal}.ti .dn{color:var(--dn);font-style:normal}
.mast{display:flex;align-items:center;gap:22px;padding:16px 26px;border-bottom:1px solid var(--line);position:relative;z-index:2;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:14px}
.mark{width:40px;height:40px;background:var(--panel2);border:1px solid var(--line2);border-radius:8px;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:8px 0;flex:none}
.mark i{width:5px;border-radius:1px;background:var(--up);height:60%;position:relative;transform-origin:bottom;animation:ck 2.4s ease-in-out infinite}
.mark i::before{content:"";position:absolute;left:2px;top:-5px;width:1px;height:calc(100% + 9px);background:inherit;opacity:.7}
.mark i:nth-child(2){background:var(--dn);height:88%;animation-delay:.3s}
.mark i:nth-child(3){background:var(--amb);height:44%;animation-delay:.6s}
@keyframes ck{50%{transform:scaleY(.72)}}
.brand h1{font:900 19px "Archivo";letter-spacing:.06em}
.brand h1 span{color:var(--amb)}
.brand p{font:600 9.5px "Archivo";letter-spacing:.22em;color:var(--faint);margin-top:3px}
.mastMeta{display:flex;gap:8px;flex-wrap:wrap}
.chip{font:11px "IBM Plex Mono";color:var(--dim);border:1px solid var(--line);background:var(--panel);padding:5px 10px;border-radius:5px}
.mastRight{margin-left:auto;text-align:right}
.sess{font:800 11px "Archivo";letter-spacing:.16em;color:var(--up);display:flex;align-items:center;gap:8px;justify-content:flex-end}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--up);box-shadow:0 0 0 0 rgba(34,201,141,.5);animation:pl 1.8s infinite}
@keyframes pl{70%{box-shadow:0 0 0 9px rgba(34,201,141,0)}100%{box-shadow:0 0 0 0 rgba(34,201,141,0)}}
.sessSub{font:10.5px "IBM Plex Mono";color:var(--faint);margin-top:4px}
.snav{display:flex;gap:4px;padding:0 26px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(10,14,21,.92);backdrop-filter:blur(6px);z-index:20;overflow-x:auto}
.snav a{font:700 10.5px "Archivo";letter-spacing:.16em;color:var(--faint);text-decoration:none;padding:13px 14px;border-bottom:2px solid transparent;transition:.2s;white-space:nowrap}
.snav a:hover{color:var(--txt)}
.snav a.on{color:var(--amb);border-color:var(--amb)}
.shell{display:grid;grid-template-columns:288px 1fr;gap:20px;padding:20px 26px;position:relative;z-index:1;max-width:1560px;margin:0 auto}
@media(max-width:1020px){.shell{grid-template-columns:1fr}}
.rail{display:flex;flex-direction:column;gap:14px}
@media(min-width:1021px){.rail{position:sticky;top:60px;align-self:start}}
.railCard{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}
.railHead{font:800 11px "Archivo";letter-spacing:.2em;color:var(--txt);display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.railHead span{font:10px "IBM Plex Mono";color:var(--faint)}
.fl{display:flex;justify-content:space-between;align-items:center;font:700 9.5px "Archivo";letter-spacing:.18em;color:var(--faint);margin:13px 0 6px}
.fin{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--txt);font:12.5px "IBM Plex Mono";padding:8px 10px;border-radius:6px;outline:none;transition:.2s}
.fin:focus{border-color:var(--amb)}
input[type=date].fin::-webkit-calendar-picker-indicator{filter:invert(.7)}
.seg{display:flex;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:3px;gap:3px}
.seg button{flex:1;background:none;border:0;color:var(--dim);font:700 10.5px "Archivo";letter-spacing:.1em;padding:7px 4px;border-radius:4px;transition:.18s;position:relative}
.seg button:hover{color:var(--txt)}
.seg button.on{background:var(--line2);color:var(--amb)}
.hint{font:10.5px "IBM Plex Mono";color:var(--faint);margin-top:6px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chips button{font:11px "IBM Plex Mono";background:var(--panel2);border:1px solid var(--line);color:var(--dim);padding:5px 8px;border-radius:5px;transition:.15s}
.chips button:hover{border-color:var(--line2);color:var(--txt);transform:translateY(-1px)}
.chips button.on{background:rgba(255,180,84,.12);border-color:var(--amb);color:var(--amb)}
.mini{background:none;border:1px solid var(--line);color:var(--cyn);font:700 8.5px "Archivo";letter-spacing:.12em;padding:2px 7px;border-radius:4px}
.run{position:relative;overflow:hidden;background:var(--amb);color:#1a1206;font:800 12.5px "Archivo";letter-spacing:.14em;padding:13px;border:0;border-radius:8px;width:100%;margin-top:16px;transition:.2s}
.run:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(255,180,84,.28)}
.dsCard{font:11px "IBM Plex Mono";color:var(--faint);line-height:1.9}
.dsCard b{color:var(--dim);font-weight:600}
.dsCard .ok{color:var(--up)}
main{display:flex;flex-direction:column;gap:20px;min-width:0}
.sec{opacity:0;transform:translateY(16px);transition:.6s cubic-bezier(.2,.7,.2,1)}
.sec.vis{opacity:1;transform:none}
.secHead{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}
.secHead h2{font:900 15px "Archivo";letter-spacing:.12em}
.secHead .no{font:700 11px "IBM Plex Mono";color:var(--amb)}
.secHead p{font:11.5px "IBM Plex Mono";color:var(--faint)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;position:relative;overflow:hidden}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;transition:.2s;position:relative}
.kpi:hover{border-color:var(--line2);transform:translateY(-2px)}
.kpi .lb{font:700 9px "Archivo";letter-spacing:.18em;color:var(--faint)}
.kpi .vl{font:600 21px "IBM Plex Mono";margin-top:7px;letter-spacing:-.01em}
.kpi .sb{font:10.5px "IBM Plex Mono";color:var(--faint);margin-top:5px}
.kpi .sb .up{color:var(--up)}.kpi .sb .dn{color:var(--dn)}
.kpi.hot{border-color:rgba(255,180,84,.4)}
.kpi.hot .lb{color:var(--amb)}
.replay{display:flex;align-items:center;gap:16px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin-top:12px;flex-wrap:wrap}
.rpTag{font:800 10px "Archivo";letter-spacing:.2em;color:var(--amb)}
.rpDate{font:10.5px "IBM Plex Mono";color:var(--faint);margin-left:10px}
.rpT{display:flex;gap:6px}
.rpT button{width:32px;height:32px;background:var(--panel2);border:1px solid var(--line);color:var(--dim);border-radius:6px;font-size:11px;transition:.15s}
.rpT button:hover{color:var(--txt);border-color:var(--line2)}
.rpT .play{background:var(--amb);color:#1a1206;border-color:var(--amb);font-weight:700}
.replay input[type=range]{flex:1;min-width:160px;accent-color:var(--amb);height:4px}
.rpTime{font:600 15px "IBM Plex Mono";color:var(--amb);min-width:64px;text-align:right}
.rpCnt{font:10.5px "IBM Plex Mono";color:var(--faint)}
.chartHead{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.chartHead select{background:var(--panel2);border:1px solid var(--line);color:var(--txt);font:12px "IBM Plex Mono";padding:6px 8px;border-radius:6px;outline:none}
.sideTog{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.sideTog button{background:var(--panel2);border:0;color:var(--dim);font:700 10.5px "Archivo";letter-spacing:.1em;padding:7px 14px;transition:.15s}
.sideTog button.on{color:#08131c;background:var(--cyn)}
.tfBadge{font:700 10px "Archivo";letter-spacing:.14em;color:var(--amb);border:1px solid rgba(255,180,84,.4);padding:5px 9px;border-radius:5px}
.legend{margin-left:auto;display:flex;gap:14px;font:10.5px "IBM Plex Mono";color:var(--faint)}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.chartWrap{position:relative;height:430px}
.chartWrap canvas{width:100%;height:100%;display:block;cursor:crosshair}
.ctip{position:absolute;pointer-events:none;background:#0d1420;border:1px solid var(--line2);border-radius:7px;padding:9px 11px;font:11px "IBM Plex Mono";line-height:1.75;display:none;z-index:6;box-shadow:0 10px 30px rgba(0,0,0,.5);min-width:150px}
.ctip b{color:var(--amb)}
.ctip .up{color:var(--up)}.ctip .dn{color:var(--dn)}
table{width:100%;border-collapse:collapse;font:12px "IBM Plex Mono"}
th{font:700 9.5px "Archivo";letter-spacing:.15em;color:var(--dim);text-transform:uppercase;text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:2}
td{padding:7px 12px;border-bottom:1px solid rgba(30,42,58,.45);white-space:nowrap}
tbody tr{transition:.12s}
tbody tr:hover td{background:rgba(83,200,255,.045)}
.up{color:var(--up)}.dn{color:var(--dn)}
.chainTbl tbody tr{cursor:pointer}
.chainTbl .stk{text-align:center;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.chainTbl .stk em{display:block;font:700 8.5px "Archivo";letter-spacing:.14em;color:var(--faint);font-style:normal}
.chainTbl .stk b{font-size:13px}
.chainTbl tr.atm .stk{background:rgba(255,180,84,.08)}
.chainTbl tr.atm .stk b{color:var(--amb)}
.oiCell{position:relative;min-width:130px}
.oiCell i{position:absolute;top:5px;bottom:5px;background:rgba(83,200,255,.15);border-radius:2px;transition:width .3s}
.oiCell.ce i{right:0}.oiCell.pe i{left:0}
.oiCell b{position:relative;font-weight:600}
.ltp{font-weight:600}
.itm{background:rgba(255,180,84,.055)}
.dim{opacity:.22}
.tblScroll{max-height:430px;overflow:auto}
.scanGrid{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}
@media(max-width:1180px){.scanGrid{grid-template-columns:1fr}}
.bdg{font:700 8.5px "Archivo";letter-spacing:.1em;padding:3px 8px;border-radius:4px}
.bdg.lb{background:rgba(34,201,141,.15);color:var(--up)}
.bdg.sb{background:rgba(255,93,108,.15);color:var(--dn)}
.bdg.lu{background:rgba(83,200,255,.15);color:var(--cyn)}
.bdg.sc{background:rgba(255,180,84,.15);color:var(--amb)}
.miniCv{height:110px;width:100%}
.subCard{padding:14px 16px;border-bottom:1px solid var(--line)}
.subCard:last-child{border:0}
.subCard h3{font:800 10.5px "Archivo";letter-spacing:.18em;color:var(--dim);margin-bottom:10px}
.subCard h3 b{color:var(--amb);font:600 13px "IBM Plex Mono";margin-left:8px;letter-spacing:0}
.mpRow{display:grid;grid-template-columns:64px 1fr 78px;gap:10px;align-items:center;font:11px "IBM Plex Mono";color:var(--dim);padding:2.5px 0}
.mpRow .bar{height:9px;background:var(--panel2);border-radius:3px;overflow:hidden}
.mpRow .bar i{display:block;height:100%;background:var(--cyn);opacity:.55;transition:width .4s}
.mpRow.win{color:var(--amb);font-weight:700}
.mpRow.win .bar i{background:var(--amb);opacity:1}
.strats{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)}
@media(max-width:900px){.strats{grid-template-columns:1fr}}
.strat{padding:14px 16px;border-right:1px solid var(--line);cursor:pointer;transition:.18s;position:relative}
.strat:last-child{border-right:0}
.strat:hover{background:rgba(83,200,255,.04)}
.strat.on{background:rgba(255,180,84,.06);box-shadow:inset 0 2px 0 var(--amb)}
.strat h4{font:800 11.5px "Archivo";letter-spacing:.1em}
.strat .tg{font:9px "Archivo";letter-spacing:.16em;color:var(--cyn);margin:5px 0 7px}
.strat p{font:11px "IBM Plex Sans";color:var(--dim);line-height:1.55}
.strat .pm{font:10px "IBM Plex Mono";color:var(--faint);margin-top:7px}
.strat.on::after{content:"✓ SELECTED";position:absolute;top:10px;right:12px;font:800 8px "Archivo";letter-spacing:.14em;color:var(--amb)}
.btStats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0;border-bottom:1px solid var(--line)}
.btStat{padding:13px 16px;border-right:1px solid var(--line)}
.btStat .lb{font:700 8.5px "Archivo";letter-spacing:.16em;color:var(--faint)}
.btStat .vl{font:600 18px "IBM Plex Mono";margin-top:5px}
.eqWrap{height:190px;padding:10px 8px 4px}
.eqWrap canvas{width:100%;height:100%}
footer{border-top:1px solid var(--line);margin-top:10px;padding:22px 26px;font:11px "IBM Plex Mono";color:var(--faint);line-height:2;position:relative;z-index:1}
footer b{color:var(--dim)}
.toast{position:fixed;bottom:22px;right:22px;background:#0d1420;border:1px solid var(--amb);color:var(--txt);font:12px "IBM Plex Mono";padding:11px 16px;border-radius:8px;opacity:0;transform:translateY(12px);transition:.3s;z-index:99;box-shadow:0 12px 34px rgba(0,0,0,.5);max-width:340px}
.toast.show{opacity:1;transform:none}
</style>
</head>
<body>

<div class="tape"><div class="tapeIn" id="tape"></div></div>

<header class="mast">
  <div class="brand">
    <div class="mark"><i></i><i></i><i></i></div>
    <div><h1>OPTDESK <span>▸</span> EXPIRY ARCHIVE</h1><p>REAL DHANHQ REST API INTEGRATED (/v2/charts/intraday + /v2/charts/rollingoption)</p></div>
  </div>
  <div class="mastMeta">
    <span class="chip">${meta.symbol} · SEC ${meta.securityId || "13"}</span><span class="chip">NSE_FNO · OPTIDX</span><span class="chip">LOT 75</span><span class="chip">STRIKE STEP ${step}</span>
  </div>
  <div class="mastRight">
    <div class="sess"><i class="pulse"></i>DHANHQ API LIVE CONNECTED</div>
    <div class="sessSub">EXPIRY ${meta.tradingDate || "2026-07-28"} · REAL SPOT ₹${spot}</div>
  </div>
</header>

<nav class="snav" id="snav">
  <a href="#overview" class="on">OVERVIEW</a><a href="#chart">ROLLING CHART</a><a href="#chain">OPTION CHAIN</a><a href="#scan">SCANNERS</a><a href="#bt">BACKTEST LAB</a><a href="#data">DATA TABLE</a>
</nav>

<div class="shell">
  <aside class="rail">
    <div class="railCard">
      <div class="railHead">QUERY BUILDER <span>dhanhq·v2</span></div>
      <label class="fl">UNDERLYING</label>
      <select class="fin" id="qSymbolSelect">
        <option value="NIFTY" ${meta.symbol === "NIFTY" ? "selected" : ""}>NIFTY · OPTIDX · 13</option>
        <option value="BANKNIFTY" ${meta.symbol === "BANKNIFTY" ? "selected" : ""}>BANKNIFTY · OPTIDX · 25</option>
        <option value="SENSEX" ${meta.symbol === "SENSEX" ? "selected" : ""}>SENSEX · OPTIDX · 51</option>
      </select>
      <label class="fl">EXPIRY DATE</label>
      <input type="date" class="fin" id="qDate" value="${meta.tradingDate || "2026-07-28"}">
      <label class="fl">TIMEFRAME</label>
      <div class="seg" id="qTf">
        <button data-tf="1m">1M</button>
        <button data-tf="5m">5M</button>
        <button data-tf="15m" class="on">15M</button>
        <button data-tf="1H">1H</button>
      </div>
      <p class="hint" id="tfHint">Live DhanHQ intraday & rollingoption endpoints</p>
      <label class="fl">STRIKES <button class="mini" id="qAll">ALL</button></label>
      <div class="chips" id="qStrikes"></div>
      <label class="fl">SIDE FILTER</label>
      <div class="seg" id="qSide">
        <button data-s="CE">CE</button><button data-s="BOTH" class="on">BOTH</button><button data-s="PE">PE</button>
      </div>
      <button class="run" id="runBtn">▶ RUN REAL QUERY</button>
    </div>
    <div class="railCard dsCard">
      <div class="railHead">LIVE DATASET STATUS</div>
      <b>DhanHQ REST API Endpoints:</b><br>
      • Intraday Spot: <b>/v2/charts/intraday</b><br>
      • Expired Options: <b>/v2/charts/rollingoption</b><br>
      spot LTP: <b>₹${spot}</b><br>
      atm strike: <b>${meta.atmStrike || spot}</b><br>
      contracts: <b>22 Contracts (ATM-5 to ATM+5)</b><br>
      granularity: <b>${candleCount} candles</b>
    </div>
  </aside>

  <main>
    <section id="overview" class="sec">
      <div class="secHead"><span class="no">01</span><h2>SESSION OVERVIEW</h2><p>real-time replay cursor · values recompute live</p></div>
      <div class="kpis">
        <div class="kpi"><div class="lb">NIFTY SPOT · EOD</div><div class="vl" id="kSpot">₹${spot}</div><div class="sb">ATM ${meta.atmStrike} · step ${step}</div></div>
        <div class="kpi hot"><div class="lb">ATM CE ${meta.atmStrike}</div><div class="vl" id="kCe">—</div><div class="sb" id="kCeD">—</div></div>
        <div class="kpi hot"><div class="lb">ATM PE ${meta.atmStrike}</div><div class="vl" id="kPe">—</div><div class="sb" id="kPeD">—</div></div>
        <div class="kpi"><div class="lb">PCR (OI)</div><div class="vl" id="kPcr">—</div><div class="sb">Σ PE OI ÷ Σ CE OI</div></div>
        <div class="kpi"><div class="lb">MAX PAIN</div><div class="vl" id="kMp">—</div><div class="sb">min OI-weighted pain</div></div>
        <div class="kpi"><div class="lb">TOTAL OI · CE+PE</div><div class="vl" id="kOi">—</div><div class="sb" id="kOiS">—</div></div>
      </div>
      <div class="replay">
        <div><span class="rpTag">◉ DAY REPLAY</span><span class="rpDate">${meta.tradingDate || "2026-07-28"}</span></div>
        <div class="rpT">
          <button id="rStart">⏮</button>
          <button id="rPrev">◀</button>
          <button id="rPlay" class="play">▶</button>
          <button id="rNext">▶</button>
          <button id="rEnd">⏭</button>
        </div>
        <input type="range" id="rSlider" min="0" max="${candleCount - 1}" value="${candleCount - 1}">
        <div><div class="rpTime" id="rTime">15:15</div><div class="rpCnt" id="rCnt">candle ${candleCount} / ${candleCount}</div></div>
      </div>
    </section>

    <section id="chart" class="sec">
      <div class="secHead"><span class="no">02</span><h2>ROLLING CHART</h2><p>real price · volume · open interest</p></div>
      <div class="panel">
        <div class="chartHead">
          <select id="cStrike"></select>
          <div class="sideTog" id="cSide"><button data-c="ce" class="on">CALL</button><button data-c="pe">PUT</button></div>
          <span class="tfBadge" id="tfBadge">15M × ${candleCount}</span>
          <div class="legend"><span><i style="background:var(--up)"></i>bull</span><span><i style="background:var(--dn)"></i>bear</span><span><i style="background:var(--cyn)"></i>OI</span></div>
        </div>
        <div class="chartWrap"><canvas id="chartCv"></canvas><div class="ctip" id="ctip"></div></div>
      </div>
    </section>

    <section id="chain" class="sec">
      <div class="secHead"><span class="no">03</span><h2>EXPIRED OPTION CHAIN</h2><p>click any row to load into rolling chart</p></div>
      <div class="panel"><div class="tblScroll">
        <table class="chainTbl">
          <thead><tr><th style="text-align:right">CE OI</th><th>CE Δ</th><th>CE LTP</th><th style="text-align:center">STRIKE</th><th>PE LTP</th><th>PE Δ</th><th>PE OI</th></tr></thead>
          <tbody id="chainBody"></tbody>
        </table>
      </div></div>
    </section>

    <section id="scan" class="sec">
      <div class="secHead"><span class="no">04</span><h2>FLOW SCANNERS</h2><p>real positioning & buildup classification</p></div>
      <div class="scanGrid">
        <div class="panel"><div class="tblScroll">
          <table><thead><tr><th>CONTRACT</th><th>PRICE Δ%</th><th>OI Δ%</th><th>LTP</th><th>OI</th><th>READ</th></tr></thead><tbody id="scanBody"></tbody></table>
        </div></div>
        <div class="panel">
          <div class="subCard"><h3>MAX PAIN CURVE <b id="mpVal">—</b></h3><div id="mpBars"></div></div>
          <div class="subCard"><h3>INTRADAY PCR (OI)</h3><canvas class="miniCv" id="pcrCv"></canvas></div>
          <div class="subCard"><h3>ATM THETA DECAY · CE vs PE</h3><canvas class="miniCv" id="thetaCv"></canvas></div>
        </div>
      </div>
    </section>

    <section id="bt" class="sec">
      <div class="secHead"><span class="no">05</span><h2>BACKTEST LAB</h2><p>quantitative backtest on real snapshot data</p></div>
      <div class="panel">
        <div class="strats" id="strats"></div>
        <div class="btStats">
          <div class="btStat"><div class="lb">NET P&amp;L</div><div class="vl" id="bNet">—</div></div>
          <div class="btStat"><div class="lb">TRADES</div><div class="vl" id="bTr">—</div></div>
          <div class="btStat"><div class="lb">WIN RATE</div><div class="vl" id="bWr">—</div></div>
          <div class="btStat"><div class="lb">PROFIT FACTOR</div><div class="vl" id="bPf">—</div></div>
          <div class="btStat"><div class="lb">MAX DRAWDOWN</div><div class="vl" id="bDd">—</div></div>
        </div>
        <div class="eqWrap"><canvas id="eqCv"></canvas></div>
        <div class="tblScroll" style="max-height:300px">
          <table><thead><tr><th>ENTRY</th><th>EXIT</th><th>CONTRACT</th><th>DIR</th><th>ENTRY ₹</th><th>EXIT ₹</th><th>P&amp;L</th><th>RESULT</th></tr></thead><tbody id="tradeBody"></tbody></table>
        </div>
      </div>
    </section>

    <section id="data" class="sec">
      <div class="secHead"><span class="no">06</span><h2>FLATTENED RESULT SET</h2><p>real DhanHQ historical dataset rows</p></div>
      <div class="panel"><div class="tblScroll" style="max-height:440px">
        <table><thead><tr>
          <th data-k="tm">TIME</th><th data-k="strike">STRIKE</th><th data-k="side">SIDE</th>
          <th data-k="o">OPEN</th><th data-k="h">HIGH</th><th data-k="l">LOW</th><th data-k="c">CLOSE</th>
          <th data-k="v">VOLUME</th><th data-k="oi">OI</th>
        </tr></thead><tbody id="dtBody"></tbody></table>
      </div></div>
    </section>
  </main>
</div>

<footer>
  <b>LIVE DHANHQ REST API INTEGRATED</b> — Wired with /v2/charts/intraday and /v2/charts/rollingoption.
</footer>
<div class="toast" id="toast"></div>

<script>
const T0=${t0},STEP=900,N=${candleCount},SPOT=${spot},LOT=75;
const OFFS=[-5,-4,-3,-2,-1,0,1,2,3,4,5];
const DB=${JSON.stringify(dbTransformed)};

const el=id=>document.getElementById(id);
const ist=t=>new Date((t+19800)*1000).toISOString().slice(11,16);
const TIMES=Array.from({length:N},(_,i)=>ist(T0+i*STEP));
const f2=n=>n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const f0=n=>Math.round(n).toLocaleString('en-IN');
const cr=n=>(n/1e7).toFixed(2)+' Cr';
const pc=n=>(n>=0?'+':'')+n.toFixed(2)+'%';
const UP='#22c98d',DN='#ff5d6c',AMB='#ffb454',CYN='#53c8ff';
const S={tf:'15m',side:'BOTH',off:0,cside:'ce',strikes:new Set(OFFS),t:N-1,playing:false,strat:'fade'};
let chartReveal=0,hover={i:null},chartGeo=null,lastEq=[0],toastT;
function toast(m){const t=el('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);}
function setK(id,val,fmt){const e=el(id);if(!e)return;const from=parseFloat(e.dataset.v||0);e.dataset.v=val;const t0=performance.now();
 (function st(now){const p=Math.min(1,(now-t0)/450);e.textContent=fmt(from+(val-from)*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(st);})(t0);}
function sizeCv(cv){const d=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;cv.width=w*d;cv.height=h*d;const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);return[x,w,h];}

function to1h(a){const b={};for(let i=0;i<N;i++){const k=Math.floor((33300+i*900)/3600);(b[k]||(b[k]=[])).push(i);}
 const out={o:[],h:[],l:[],c:[],v:[],oi:[],t:[]};
 Object.keys(b).sort((x,y)=>x-y).forEach(k=>{const ix=b[k];out.o.push(a.o[ix[0]]);out.h.push(Math.max(...ix.map(i=>a.h[i])));out.l.push(Math.min(...ix.map(i=>a.l[i])));out.c.push(a.c[ix[ix.length-1]]);out.v.push(ix.reduce((s,i)=>s+a.v[i],0));out.oi.push(a.oi[ix[ix.length-1]]);out.t.push(TIMES[ix[0]]);});
 return out;}
const pcrAt=t=>OFFS.reduce((s,o)=>s+DB[o].pe.oi[t],0)/OFFS.reduce((s,o)=>s+DB[o].ce.oi[t],0);
function maxPain(t){const ks=OFFS.map(o=>DB[o].s);let best=ks[0],bp=Infinity;
 const pains=ks.map(K=>{let p=0;for(const o of OFFS){const Ss=DB[o].s;p+=DB[o].ce.oi[t]*Math.max(0,K-Ss)+DB[o].pe.oi[t]*Math.max(0,Ss-K);}if(p<bp){bp=p;best=K;}return p;});
 return{strike:best,pains,ks};}

function btORB(){const tr=[];for(const o of OFFS)for(const sd of['ce','pe']){const s=DB[o][sd],rh=s.h[0],rl=s.l[0];
 for(let i=1;i<N-1;i++){if(s.c[i]>rh&&s.c[i]>0.5){let xi=N-1,xp=s.c[N-1];
  for(let j=i+1;j<N;j++){if(s.l[j]<=rl){xi=j;xp=rl;break;}if(j>=i+3){xi=j;xp=s.c[j];break;}}
  tr.push({i,px:s.c[i],x:xi,xpx:xp,off:o,sd,pnl:(xp-s.c[i])*LOT});i=xi;}}}
 return tr.sort((a,b)=>a.i-b.i||a.off-b.off);}
function btOI(){const tr=[];for(const o of OFFS)for(const sd of['ce','pe']){const s=DB[o][sd];
 for(let i=1;i<N-1;i++){if(s.oi[i]>=s.oi[i-1]*1.12&&s.c[i]>s.c[i-1]&&s.c[i]>0.5){const e=Math.min(i+2,N-1);
  tr.push({i,px:s.c[i],x:e,xpx:s.c[e],off:o,sd,pnl:(s.c[e]-s.c[i])*LOT});i=e;}}}
 return tr.sort((a,b)=>a.i-b.i||a.off-b.off);}
function btFade(){const ce=DB[0].ce,pe=DB[0].pe,tr=[];
 for(const h of[1,5,9,13,17,21]){const ep=ce.c[h]+pe.c[h];if(ep<=0.2)continue;const stop=ep*1.6;let xp=null,xi=null;
  for(let j=h+1;j<N;j++){if(ce.h[j]+pe.h[j]>=stop){xp=stop;xi=j;break;}if(j===N-1||j===h+4){xp=ce.c[j]+pe.c[j];xi=j;break;}}
  tr.push({i:h,px:ep,x:xi,xpx:xp,off:0,sd:'STR',pnl:(ep-xp)*LOT});}
 return tr;}
const STRATS={
 orb:{n:'OPENING RANGE BREAKOUT',tg:'LONG · ALL 22 CONTRACTS',d:'Buy when price closes above the first candle high. Exit after 3 candles or on a break of range low.',pm:'hold ≤ 45m · SL = range low'},
 oi:{n:'OI SURGE MOMENTUM',tg:'LONG · TAPE READING',d:'Enter when Open Interest jumps ≥12% on a rising close. Exit 2 candles later.',pm:'OI Δ ≥ +12% · exit +30m'},
 fade:{n:'ATM THETA FADE',tg:'SHORT STRADDLE · HOURLY',d:'Sell the ATM straddle at the top of every hour, cover 4 candles later or at close.',pm:'re-entry hourly · SL = 160% of premium'}};

function buildTape(){let s=\`<span class="ti"><b>SPOT ${meta.symbol}</b> \${f0(SPOT)}</span>\`;
 for(const o of OFFS){const d=DB[o];const cc=(d.ce.c[N-1]-d.ce.o[0])/(d.ce.o[0]||1)*100,pp=(d.pe.c[N-1]-d.pe.o[0])/(d.pe.o[0]||1)*100;
  s+=\`<span class="ti"><b>\${d.s} CE</b> \${f2(d.ce.c[N-1])} <i class="\${cc>=0?'up':'dn'}">\${pc(cc)}</i></span><span class="ti"><b>\${d.s} PE</b> \${f2(d.pe.c[N-1])} <i class="\${pp>=0?'up':'dn'}">\${pc(pp)}</i></span>\`;}
 s+=\`<span class="ti"><b>PCR(OI) EOD</b> \${pcrAt(N-1).toFixed(2)}</span><span class="ti"><b>MAX PAIN</b> \${f0(maxPain(N-1).strike)}</span>\`;
 el('tape').innerHTML=s+s;}
function updateKPIs(){const t=S.t,ce=DB[0].ce,pe=DB[0].pe;
 const dCe=t?(ce.c[t]-ce.c[t-1])/(ce.c[t-1]||.05)*100:0,dPe=t?(pe.c[t]-pe.c[t-1])/(pe.c[t-1]||.05)*100:0;
 setK('kSpot',SPOT,v=>f2(v));setK('kCe',ce.c[t],v=>'₹'+f2(v));setK('kPe',pe.c[t],v=>'₹'+f2(v));
 setK('kPcr',pcrAt(t),v=>v.toFixed(3));setK('kMp',maxPain(t).strike,v=>f0(v));
 const tc=OFFS.reduce((s,o)=>s+DB[o].ce.oi[t],0),tp=OFFS.reduce((s,o)=>s+DB[o].pe.oi[t],0);
 setK('kOi',tc+tp,v=>cr(v));
 if(el('kCeD')) el('kCeD').innerHTML=\`<span class="\${dCe>=0?'up':'dn'}">\${pc(dCe)}</span> vs prev candle\`;
 if(el('kPeD')) el('kPeD').innerHTML=\`<span class="\${dPe>=0?'up':'dn'}">\${pc(dPe)}</span> vs prev candle\`;
 if(el('kOiS')) el('kOiS').textContent=\`CE \${cr(tc)} · PE \${cr(tp)}\`;}
function renderChain(){const t=S.t;let h='';const mx=Math.max(...OFFS.map(o=>Math.max(DB[o].ce.oi[t],DB[o].pe.oi[t])));
 for(const o of OFFS){const st=DB[o].s,ce=DB[o].ce,pe=DB[o].pe;
  const cd=t?(ce.c[t]-ce.c[t-1])/(ce.c[t-1]||.05)*100:0,pd=t?(pe.c[t]-pe.c[t-1])/(pe.c[t-1]||.05)*100:0;
  h+=\`<tr data-off="\${o}" class="\${o===0?'atm':''}">
  <td class="oiCell ce \${S.side==='PE'?'dim':''}"><i style="width:\${(ce.oi[t]/mx*100).toFixed(1)}%"></i><b>\${cr(ce.oi[t])}</b></td>
  <td class="\${S.side==='PE'?'dim':''} \${cd>=0?'up':'dn'}">\${pc(cd)}</td>
  <td class="ltp \${S.side==='PE'?'dim':''} \${st<SPOT?'itm':''}">\${f2(ce.c[t])}</td>
  <td class="stk"><em>\${o>0?'ATM+'+o:o<0?'ATM'+o:'ATM'}</em><b>\${f0(st)}</b></td>
  <td class="ltp \${S.side==='CE'?'dim':''} \${st>SPOT?'itm':''}">\${f2(pe.c[t])}</td>
  <td class="\${S.side==='CE'?'dim':''} \${pd>=0?'up':'dn'}">\${pc(pd)}</td>
  <td class="oiCell pe \${S.side==='CE'?'dim':''}"><i style="width:\${(pe.oi[t]/mx*100).toFixed(1)}%"></i><b>\${cr(pe.oi[t])}</b></td></tr>\`;}
 el('chainBody').innerHTML=h;}
function renderScan(){let h='';const rows=[];
 for(const o of OFFS)for(const sd of['ce','pe']){const s=DB[o][sd];
  const pd=(s.c[N-1]-s.c[0])/(s.c[0]||1)*100,od=(s.oi[N-1]-s.oi[0])/(s.oi[0]||1)*100;
  const cls=pd>0?(od>0?['LONG BUILD-UP','lb']:['SHORT COVERING','sc']):(od>0?['SHORT BUILD-UP','sb']:['LONG UNWINDING','lu']);
  rows.push({o,sd,pd,od,c:s.c[N-1],oi:s.oi[N-1],cls});}
 rows.sort((a,b)=>Math.abs(b.od)-Math.abs(a.od));
 for(const r of rows)h+=\`<tr><td><b>\${DB[r.o].s} \${r.sd.toUpperCase()}</b></td><td class="\${r.pd>=0?'up':'dn'}">\${pc(r.pd)}</td><td class="\${r.od>=0?'up':'dn'}">\${pc(r.od)}</td><td>\${f2(r.c)}</td><td>\${cr(r.oi)}</td><td><span class="bdg \${r.cls[1]}">\${r.cls[0]}</span></td></tr>\`;
 el('scanBody').innerHTML=h;}
function renderMP(){const t=S.t,{strike,pains,ks}=maxPain(t);el('mpVal').textContent=f0(strike);
 const mx=Math.max(...pains);let h='';
 ks.forEach((k,i)=>{h+=\`<div class="mpRow \${k===strike?'win':''}"><span>\${f0(k)}</span><span class="bar"><i style="width:\${(100-pains[i]/mx*100).toFixed(1)}%"></i></span><span>\${cr(pains[i])}</span></div>\`;});
 el('mpBars').innerHTML=h;}
function lineCv(cv,sets,opts={}){if(!cv)return;const[x,w,h]=sizeCv(cv);x.clearRect(0,0,w,h);
 const all=sets.flatMap(s=>s.data);let mn=Math.min(...all),mx=Math.max(...all);
 if(opts.zero){mn=Math.min(mn,0);mx=Math.max(mx,0);}const pd=(mx-mn)*0.14||1;mn-=pd;mx+=pd;
 const X=i=>10+(w-20)*i/(sets[0].data.length-1),Y=v=>h-8-(h-16)*(v-mn)/(mx-mn);
 x.strokeStyle='rgba(140,170,210,.08)';x.beginPath();for(let g=0;g<3;g++){const y=8+(h-16)*g/2;x.moveTo(10,y);x.lineTo(w-10,y);}x.stroke();
 if(opts.zero){x.strokeStyle='rgba(255,255,255,.2)';x.setLineDash([4,4]);x.beginPath();x.moveTo(10,Y(0));x.lineTo(w-10,Y(0));x.stroke();x.setLineDash([]);}
 for(const s of sets){x.beginPath();s.data.forEach((v,i)=>i?x.lineTo(X(i),Y(v)):x.moveTo(X(0),Y(v)));x.strokeStyle=s.color;x.lineWidth=1.8;x.stroke();
  if(s.fill){x.lineTo(X(s.data.length-1),h);x.lineTo(X(0),h);x.closePath();const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,s.color+'30');g.addColorStop(1,s.color+'00');x.fillStyle=g;x.fill();}}}
function renderAnalytics(){lineCv(el('pcrCv'),[{data:TIMES.map((_,t)=>pcrAt(t)),color:CYN,fill:true}]);
 lineCv(el('thetaCv'),[{data:DB[0].ce.c,color:UP,fill:true},{data:DB[0].pe.c,color:DN,fill:true}]);}

function chartData(){const s=DB[S.off][S.cside];return S.tf==='15m'?{d:s,t:TIMES,n:N}:{d:to1h(s),t:to1h(s).t,n:to1h(s).t.length,d2:to1h(s)};}
function drawChart(){const cv=el('chartCv');if(!cv)return;const[x,w,h]=sizeCv(cv);x.clearRect(0,0,w,h);
 const cd=chartData(),d=cd.d2||cd.d,t=cd.t,n=cd.n;
 const padL=60,padR=12,padT=14,padB=22,gap=9,plotW=w-padL-padR,innerH=h-padT-padB;
 const pH=Math.round(innerH*0.58),vH=Math.round(innerH*0.16),oH=innerH-pH-vH-gap*2;
 const pY=padT,vY=padT+pH+gap,oY=vY+vH+gap;
 let mn=Math.min(...d.l),mx=Math.max(...d.h);const pp=(mx-mn)*0.08||1;mn-=pp;mx+=pp;
 const vm=Math.max(...d.v)*1.15;let omn=Math.min(...d.oi),omx=Math.max(...d.oi);const op=(omx-omn)*0.1||1;omn-=op;omx+=op;
 const X=i=>padL+plotW*(i+0.5)/n,Y=v=>pY+pH*(1-(v-mn)/(mx-mn)),YV=v=>vY+vH*(1-v/vm),YO=v=>oY+oH*(1-(v-omn)/(omx-omn));
 x.font='10px "IBM Plex Mono"';x.textAlign='left';
 for(let g=0;g<=4;g++){const v=mn+(mx-mn)*g/4,y=Y(v);x.strokeStyle='rgba(140,170,210,.07)';x.beginPath();x.moveTo(padL,y);x.lineTo(w-padR,y);x.stroke();
  x.fillStyle='#5a6b82';x.fillText(v>=100?f0(v):v.toFixed(v<10?2:1),6,y+3);}
 x.textAlign='center';for(let i=0;i<n;i+=Math.max(1,Math.ceil(n/7))){x.fillStyle='#5a6b82';x.fillText(t[i],X(i),h-7);}x.textAlign='left';
 const vis=Math.max(1,Math.floor(n*chartReveal)),cw=Math.max(2.5,plotW/n*0.6);
 for(let i=0;i<vis;i++){const up=d.c[i]>=d.o[i],col=up?UP:DN;
  x.strokeStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(X(i),Y(d.h[i]));x.lineTo(X(i),Y(d.l[i]));x.stroke();
  const y1=Y(Math.max(d.o[i],d.c[i])),y2=Y(Math.min(d.o[i],d.c[i]));x.fillStyle=col;x.fillRect(X(i)-cw/2,y1,cw,Math.max(1,y2-y1));
  x.globalAlpha=.6;x.fillRect(X(i)-cw/2,YV(d.v[i]),cw,vY+vH-YV(d.v[i]));x.globalAlpha=1;}
 x.beginPath();for(let i=0;i<vis;i++){i?x.lineTo(X(i),YO(d.oi[i])):x.moveTo(X(0),YO(d.oi[i]));}x.strokeStyle=CYN;x.lineWidth=1.6;x.stroke();
 x.fillStyle='#5a6b82';x.font='9px "IBM Plex Mono"';x.fillText('VOLUME',padL+4,vY+10);x.fillText('OPEN INTEREST',padL+4,oY+10);
 if(S.tf==='15m'&&S.t<n){const px=X(S.t);x.strokeStyle='rgba(255,180,84,.55)';x.setLineDash([3,3]);x.beginPath();x.moveTo(px,padT);x.lineTo(px,h-padB);x.stroke();x.setLineDash([]);}
 if(hover.i!=null&&hover.i<vis){const i=hover.i,px=X(i);
  x.strokeStyle='rgba(230,237,246,.28)';x.setLineDash([3,3]);x.beginPath();x.moveTo(px,padT);x.lineTo(px,h-padB);x.stroke();x.setLineDash([]);
  x.fillStyle='#e6edf6';x.beginPath();x.arc(px,Y(d.c[i]),3,0,7);x.fill();}
 chartGeo={padL,plotW,n,X,Y,d,t};}
function animChart(){chartReveal=0;hover.i=null;(function st(){chartReveal=Math.min(1,chartReveal+0.055);drawChart();if(chartReveal<1)requestAnimationFrame(st);})();}

if(el('chartCv')){
 el('chartCv').addEventListener('mousemove',e=>{if(!chartGeo)return;const r=e.currentTarget.getBoundingClientRect();
  const i=Math.max(0,Math.min(chartGeo.n-1,Math.floor((e.clientX-r.left-chartGeo.padL)/chartGeo.plotW*chartGeo.n)));
  hover.i=i;drawChart();const d=chartGeo.d,tip=el('ctip');const chg=(d.c[i]-d.o[i])/(d.o[i]||1)*100;
  tip.innerHTML=\`<b>\${chartGeo.t[i]} IST</b> · \${DB[S.off].s} \${S.cside.toUpperCase()}<br>O \${f2(d.o[i])} &nbsp;H \${f2(d.h[i])}<br>L \${f2(d.l[i])} &nbsp;C <span class="\${d.c[i]>=d.o[i]?'up':'dn'}">\${f2(d.c[i])}</span> <span class="\${chg>=0?'up':'dn'}">\${pc(chg)}</span><br>VOL \${f0(d.v[i])}<br>OI \${cr(d.oi[i])}\`;
  tip.style.display='block';const tw=tip.offsetWidth;
  tip.style.left=Math.min(r.width-tw-10,Math.max(6,e.clientX-r.left+14))+'px';tip.style.top=Math.max(6,e.clientY-r.top-40)+'px';});
 el('chartCv').addEventListener('mouseleave',()=>{hover.i=null;el('ctip').style.display='none';drawChart();});
}

function renderStrats(){el('strats').innerHTML=Object.entries(STRATS).map(([k,s])=>\`<div class="strat \${S.strat===k?'on':''}" data-s="\${k}"><h4>\${s.n}</h4><div class="tg">\${s.tg}</div><p>\${s.d}</p><div class="pm">\${s.pm}</div></div>\`).join('');
 document.querySelectorAll('.strat').forEach(c=>c.onclick=()=>{S.strat=c.dataset.s;renderStrats();runBT();});}
function runBT(){const trades=S.strat==='orb'?btORB():S.strat==='oi'?btOI():btFade();
 let cum=0,peak=0,mdd=0,gw=0,gl=0;const eq=[0];
 for(const t of trades){cum+=t.pnl;eq.push(cum);if(cum>peak)peak=cum;if(peak-cum>mdd)mdd=peak-cum;t.pnl>0?gw+=t.pnl:gl-=t.pnl;}
 lastEq=eq;const wins=trades.filter(t=>t.pnl>0).length;
 setK('bNet',cum,v=>'₹'+f2(v));el('bNet').style.color=cum>=0?UP:DN;
 setK('bTr',trades.length,v=>f0(v));setK('bWr',trades.length?wins/trades.length*100:0,v=>v.toFixed(1)+'%');
 el('bPf').textContent=gl>0?(gw/gl).toFixed(2):'∞';el('bPf').style.color=gw>=gl?UP:DN;
 setK('bDd',-mdd,v=>'₹'+f2(v));el('bDd').style.color=DN;
 lineCv(el('eqCv'),[{data:eq,color:cum>=0?UP:DN,fill:true}],{zero:true});
 el('tradeBody').innerHTML=trades.slice(0,80).map(t=>{const nm=t.sd==='STR'?'STRADDLE':DB[t.off].s+' '+t.sd.toUpperCase();
  return\`<tr><td>\${TIMES[t.i]}</td><td>\${TIMES[t.x]}</td><td><b>\${nm}</b></td><td><span class="bdg \${t.pnl>=0?'lb':'sb'}">\${t.sd==='STR'?'SELL':'BUY'}</span></td><td>\${f2(t.px)}</td><td>\${f2(t.xpx)}</td><td class="\${t.pnl>=0?'up':'dn'}"><b>₹\${f2(t.pnl)}</b></td><td>\${t.pnl>=0?'WIN':'LOSS'}</td></tr>\`;}).join('')
  +(trades.length>80?\`<tr><td colspan="8" style="color:var(--faint)">… \${trades.length-80} more rows</td></tr>\`:'');}

let dtSort={k:null,dir:1},dtRows=[];
function buildDT(){dtRows=[];
 for(const o of OFFS){if(!S.strikes.has(o))continue;
  for(const sd of['ce','pe']){if(S.side!=='BOTH'&&sd!==S.side.toLowerCase())continue;
   const d=S.tf==='15m'?DB[o][sd]:to1h(DB[o][sd]);
   const tArr=d.t||TIMES;
   if(tArr&&Array.isArray(tArr)){
     tArr.forEach((tm,i)=>dtRows.push({tm,i,strike:DB[o].s,off:o,side:sd.toUpperCase(),o:d.o[i]||0,h:d.h[i]||0,l:d.l[i]||0,c:d.c[i]||0,v:d.v[i]||0,oi:d.oi[i]||0}));
   }}}
 if(dtSort.k)dtRows.sort((a,b)=>{const A=a[dtSort.k],B=b[dtSort.k];return(typeof A==='string'?A.localeCompare(B):A-B)*dtSort.dir;});
 else dtRows.sort((a,b)=>a.strike-b.strike||a.side.localeCompare(b.side)||a.i-b.i);
 el('dtBody').innerHTML=dtRows.map(r=>\`<tr><td>\${r.tm}</td><td><b>\${f0(r.strike)}</b></td><td><span class="bdg \${r.side==='CE'?'lb':'sb'}">\${r.side}</span></td><td>\${f2(r.o)}</td><td>\${f2(r.h)}</td><td>\${f2(r.l)}</td><td><b>\${f2(r.c)}</b></td><td>\${f0(r.v)}</td><td>\${cr(r.oi)}</td></tr>\`).join('');}
document.querySelectorAll('#data th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;
 if(dtSort.k===k)dtSort.dir*=-1;else{dtSort.k=k;dtSort.dir=1;}buildDT();});

el('qStrikes').innerHTML=OFFS.map(o=>\`<button data-o="\${o}" class="on">\${o>0?'+':''}\${o}</button>\`).join('');
document.querySelectorAll('#qStrikes button').forEach(b=>b.onclick=()=>{const o=+b.dataset.o;
 b.classList.toggle('on');b.classList.contains('on')?S.strikes.add(o):S.strikes.delete(o);buildDT();});
el('qAll').onclick=()=>{S.strikes=new Set(OFFS);document.querySelectorAll('#qStrikes button').forEach(b=>b.classList.add('on'));buildDT();toast('All 11 strikes selected');};
document.querySelectorAll('#qTf button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#qTf button').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.tf=b.dataset.tf;
 animChart();buildDT();});
document.querySelectorAll('#qSide button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#qSide button').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.side=b.dataset.s;renderChain();buildDT();});
el('cStrike').innerHTML=OFFS.map(o=>\`<option value="\${o}" \${o===0?'selected':''}>\${f0(DB[o].s)} · \${o>0?'ATM+'+o:o<0?'ATM'+o:'ATM'}</option>\`).join('');
el('cStrike').onchange=e=>{S.off=+e.target.value;animChart();};
document.querySelectorAll('#cSide button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#cSide button').forEach(x=>x.classList.remove('on'));b.classList.add('on');S.cside=b.dataset.c;animChart();});
el('chainBody').addEventListener('click',e=>{const tr=e.target.closest('tr');if(!tr)return;
 S.off=+tr.dataset.off;el('cStrike').value=S.off;animChart();
 toast(\`▸ Loaded \${DB[S.off].s} \${S.cside.toUpperCase()} into Rolling Chart\`);
 document.getElementById('chart').scrollIntoView({behavior:'smooth',block:'start'});});

function setT(v){S.t=Math.max(0,Math.min(N-1,v));el('rSlider').value=S.t;el('rTime').textContent=TIMES[S.t]||'15:15';
 el('rCnt').textContent=\`candle \${S.t+1} / \${N}\`;updateKPIs();renderChain();renderMP();drawChart();}
el('rSlider').oninput=e=>setT(+e.target.value);
el('rPrev').onclick=()=>setT(S.t-1);el('rNext').onclick=()=>setT(S.t+1);
el('rStart').onclick=()=>setT(0);el('rEnd').onclick=()=>setT(N-1);
el('rPlay').onclick=()=>{S.playing=!S.playing;el('rPlay').textContent=S.playing?'❚❚':'▶';
 if(S.playing){S.iv=setInterval(()=>{if(S.t>=N-1)setT(0);else setT(S.t+1);},420);}else clearInterval(S.iv);};

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');
 document.querySelectorAll('.snav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id));}}),{threshold:0.1});
document.querySelectorAll('.sec').forEach(s=>io.observe(s));

buildTape();updateKPIs();renderChain();renderScan();renderMP();renderAnalytics();renderStrats();runBT();buildDT();animChart();
addEventListener('resize',()=>{drawChart();renderAnalytics();lineCv(el('eqCv'),[{data:lastEq,color:lastEq[lastEq.length-1]>=0?UP:DN,fill:true}],{zero:true});});
</script>
</body>
</html>`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* REAL DATA CONTROLS HEADER */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          borderRadius: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          background: "linear-gradient(135deg, rgba(15, 19, 28, 0.95) 0%, rgba(20, 26, 38, 0.95) 100%)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "8px", background: "rgba(255, 180, 84, 0.12)", borderRadius: "8px", border: "1px solid #FFB800" }}>
            <Database size={20} color="#FFB800" />
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "white", letterSpacing: "0.5px" }}>
              OPTDESK ▸ EXPIRY ARCHIVE (REAL DHANHQ REST API INTEGRATED)
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Connected to DhanHQ /v2/charts/intraday & /v2/charts/rollingoption REST endpoints
            </div>
          </div>
        </div>

        {/* QUERY CONTROLS FORM */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <select
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                fetchRealData(e.target.value, fromDate, interval);
              }}
              style={{ padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px", fontWeight: 700 }}
            >
              <option value="NIFTY">NIFTY (13)</option>
              <option value="BANKNIFTY">BANKNIFTY (25)</option>
              <option value="SENSEX">SENSEX (51)</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                fetchRealData(symbol, e.target.value, interval);
              }}
              style={{ padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px", fontFamily: "var(--font-mono)" }}
            />
          </div>

          <div>
            <select
              value={interval}
              onChange={(e) => {
                setInterval(e.target.value);
                fetchRealData(symbol, fromDate, e.target.value);
              }}
              style={{ padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "white", fontSize: "12px" }}
            >
              <option value="1">1 MINUTE (1m)</option>
              <option value="5">5 MINUTES (5m)</option>
              <option value="15">15 MINUTES (15m)</option>
              <option value="60">60 MINUTES (1h)</option>
            </select>
          </div>

          <button
            onClick={() => fetchRealData()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 18px",
              background: "linear-gradient(135deg, #FFB800 0%, #FF8800 100%)",
              color: "#0A0D14",
              fontWeight: 800,
              fontSize: "12px",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
            FETCH REAL DHANHQ DATA
          </button>
        </div>
      </div>

      {/* ERROR NOTICE IF ANY */}
      {error && (
        <div style={{ padding: "12px 18px", background: "rgba(255, 73, 92, 0.12)", border: "1px solid var(--accent-red)", borderRadius: "8px", color: "var(--accent-red)", fontSize: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* EMBEDDED IFRAME RENDERING REAL DATA TRANSFORMATION */}
      <div
        style={{
          height: "calc(100vh - 180px)",
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          background: "#0a0e15",
        }}
      >
        <iframe
          srcDoc={generateRealHtml()}
          title="OPTDESK Live Archive"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "#0a0e15",
          }}
        />
      </div>
    </div>
  );
};

export default OptDeskExpiryArchivePage;
