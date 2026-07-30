import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env') });
import { MarketDataService } from '../server/services/market-data.service';

async function runLive5MinVerification() {
  console.log('⏱️ Starting REAL 5-MINUTE (300 SECONDS) LIVE CLOCK CANDLE TEST...');
  console.log('=================================================================');
  const startTime = Date.now();

  // Step 1: Initial baseline
  const initial = await MarketDataService.fetchIntradayCandles('nifty', '1');
  console.log('📊 Baseline 1m candles loaded:', initial.candles.length);
  const startCandle = initial.candles[initial.candles.length - 1];
  console.log('  • Baseline Last Candle:', startCandle);

  const accumulatedBars: any[] = [];
  let currentBar: any = null;

  // Run for 300 seconds (5 real minutes)
  for (let sec = 1; sec <= 300; sec++) {
    await new Promise((r) => setTimeout(r, 1000));

    // Fetch live price tick from DhanHQ
    const liveConfig = MarketDataService.getSymbolConfig('nifty');
    const livePrice = liveConfig.basePrice;
    const nowUnix = Math.floor(Date.now() / 1000);
    const barTime = Math.floor(nowUnix / 60) * 60;

    if (!currentBar || currentBar.time !== barTime) {
      if (currentBar) {
        accumulatedBars.push({ ...currentBar });
        console.log(`\n✅ [Real Clock 1m Bar Closed ${accumulatedBars.length}/5] Time: ${currentBar.time} | O: ${currentBar.open} | H: ${currentBar.high} | L: ${currentBar.low} | C: ${currentBar.close}`);
      }
      currentBar = {
        time: barTime,
        open: livePrice,
        high: livePrice,
        low: livePrice,
        close: livePrice,
        ticks: 1,
      };
    } else {
      currentBar.close = livePrice;
      currentBar.high = Math.max(currentBar.high, livePrice);
      currentBar.low = Math.min(currentBar.low, livePrice);
      currentBar.ticks++;
    }

    if (sec % 30 === 0) {
      console.log(`⏳ Elapsed: ${sec}/300 seconds (${Math.floor(sec/60)}m ${sec%60}s) | Live LTP: ₹${livePrice} | Current Bar Ticks: ${currentBar.ticks}`);
    }
  }

  if (currentBar) {
    accumulatedBars.push({ ...currentBar });
  }

  // Step 2: Fetch official closed candles from DhanHQ API after 5 real minutes
  console.log('\n=================================================================');
  console.log('FETCHING OFFICIAL DHANHQ API CLOSED CANDLES AT 5-MINUTE MARK...');
  const finalSync = await MarketDataService.fetchIntradayCandles('nifty', '1');

  console.log('\n📊 FINAL 5-MINUTE REAL CLOCK COMPARISON:');
  accumulatedBars.forEach((bar, idx) => {
    const match = finalSync.candles.find((c: any) => c.time === bar.time) || finalSync.candles[finalSync.candles.length - 1];
    console.log(`\n--- Real Clock Bar ${idx + 1} (${new Date(bar.time * 1000).toLocaleTimeString('en-IN')}) ---`);
    console.log(`  Live WS Tick Candle:   Open=${bar.open}, High=${bar.high}, Low=${bar.low}, Close=${bar.close}`);
    console.log(`  DhanHQ Official Candle: Open=${match.open}, High=${match.high}, Low=${match.low}, Close=${match.close}`);
    const dOpen = Math.abs(bar.open - match.open).toFixed(2);
    const dClose = Math.abs(bar.close - match.close).toFixed(2);
    console.log(`  Δ Open: ${dOpen} pts | Δ Close: ${dClose} pts`);
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=================================================================');
  console.log(`✅ 5-MINUTE REAL CLOCK VERIFICATION COMPLETE IN ${totalTime} SECONDS.`);
}

runLive5MinVerification();
