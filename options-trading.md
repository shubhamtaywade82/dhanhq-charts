# 📊 Index Options BUYING Strategies That Work — With DhanHQ V2 API Implementation

## 🔑 Reality Check First

> Only ~25% of option traders make money on average . About 30% of all options expire worthless, 60% are closed before expiration, and only 10% are exercised . **Options buying is inherently disadvantaged by theta (time decay)**, so strategy selection, timing, and risk management are everything.

Below are the strategies that have **demonstrated edge** for index option **buyers** on Nifty/BankNifty, along with how to automate them using DhanHQ V2 APIs.

---

## ✅ STRATEGIES THAT WORK FOR OPTION BUYING

### 1. 🚀 Opening Range Breakout (ORB) — Option Buying
**Best for:** Bank Nifty & Nifty on high-volatility days

| Parameter | Detail |
|---|---|
| **Setup** | Mark High/Low of first 15-min candle |
| **Entry** | Buy **ATM Call** if price breaks above range; Buy **ATM Put** if below |
| **Strike** | ATM or slightly ITM (delta 0.50–0.60) |
| **Stop-Loss** | 30–40% of premium paid |
| **Target** | 1:2 or 1:3 risk-reward |
| **Why it works** | Institutions establish direction early; volatility expansion favors buyers  |

**Win Rate:** ~55–60% with disciplined exits (backtested)

---

### 2. 📈 VWAP Trend Following — Option Buying
**Best for:** Trending intraday markets

| Parameter | Detail |
|---|---|
| **Rule** | Price above VWAP → Buy Calls on pullbacks to VWAP |
| | Price below VWAP → Buy Puts on pullbacks to VWAP |
| **Filter** | Trade ONLY when VWAP is clearly sloping (flat VWAP = no trade) |
| **Strike** | ATM or 1-strike ITM |
| **Exit** | When price crosses back over VWAP |

---

### 3. 📊 Bull Call Spread / Bear Put Spread (Defined Risk Buying)
**Best for:** Directional view with limited risk

```
BULL CALL SPREAD:
  → Buy ATM Call (e.g., Nifty 24800 CE)
  → Sell OTM Call (e.g., Nifty 25000 CE)
  → Same expiry
  → Max Loss = Net Premium Paid
  → Max Profit = Spread Width - Net Premium
```

**Advantages over naked buying:**
- Lower cost (reduced theta burn)
- Reduced time decay impact
- Defined risk and reward

**Ideal for:** Breakouts, RBI policy days, Budget day, news events

---

### 4. ⚡ Long Straddle / Long Strangle — Volatility Plays
**Best for:** Before major events (RBI policy, CPI, Budget, Elections)

```
LONG STRADDLE:
  → Buy ATM Call + Buy ATM Put (same strike, same expiry)
  → Profit if index moves > combined premium in EITHER direction

LONG STRANGLE:
  → Buy OTM Call + Buy OTM Put (different strikes)
  → Cheaper than straddle, needs bigger move
```

**When it works:** India VIX is low (< 13) and a catalyst is imminent

---

### 5. 📅 Calendar Spread (Time Spread) — Buying Strategy
**Best for:** Low volatility → expected volatility expansion

```
  → Sell near-expiry option (e.g., this week)
  → Buy same strike NEXT-expiry option
  → Profit from faster theta decay of the short-dated option
```

**Used by experienced traders before events like RBI policy or CPI data**

---

### 6. 🎯 Expiry Day Directional Scalping
**Best for:** Bank Nifty expiry (Wednesday)

| Parameter | Detail |
|---|---|
| **Strike** | ATM options only |
| **Holding time** | 5–15 minutes max |
| **Target** | Quick 5–15 point moves |
| **Risk** | Size SMALL — one bad trade can wipe 5 good ones  |

---

## 🏗️ DHANHQ V2 API ARCHITECTURE FOR AUTOMATION

### API Components You'll Use

| Component | Purpose | Type |
|---|---|---|
| **Option Chain API** | Real-time OI, Greeks, IV, Volume, Bid/Ask  | REST |
| **Live Market Feed** | Real-time LTP, OHLCV via WebSocket  | WebSocket |
| **Order API** | Place/modify/cancel orders  | REST |
| **Super Order API** | Entry + Target + Stop-loss in one order  | REST |
| **Historical Data** | Backtesting strategies  | REST |
| **Trigger Orders** | Condition-based automated entries  | REST |

### DhanHQ V2 API — Key Features for Options

The DhanHQ Option Chain API provides **on a single request**: Delta, Theta, Vega, Gamma, Open Interest, Volume, LTP, Best Bid/Ask, and Implied Volatility for all strikes .

WebSocket keeps a **persistent connection** open, allowing the server to push real-time data to your systems .

The **Super Order API** lets you place a combination of orders — entry leg, target leg, and stop-loss leg — in a single API call .

You can also place **trigger orders** that execute when a certain condition is met, allowing you to automate strategies and react quickly .

---

## 💻 PYTHON IMPLEMENTATION FRAMEWORK

```python
# pip install dhanhq==2.3.0rc1
from dhanhq import dhanhq
import websocket
import json
import threading
import time
from datetime import datetime, timedelta

# ═══════════════════════════════════════════
# 1. INITIALIZATION
# ═══════════════════════════════════════════
client_id    = "YOUR_CLIENT_ID"
access_token = "YOUR_ACCESS_TOKEN"

dhan = dhanhq(client_id, access_token)

# Index Security IDs (DhanHQ)
NIFTY_IDX      = "13"       # Nifty 50 Index
BANKNIFTY_IDX  = "25"       # Bank Nifty Index
NIFTY_FNO      = "IDX_I"    # Exchange segment
BANKNIFTY_FNO  = "IDX_I"

# ═══════════════════════════════════════════
# 2. FETCH OPTION CHAIN (REST API)
# ═══════════════════════════════════════════
def get_option_chain(underlying_sec_id="13", expiry_date="2026-07-30"):
    """
    Fetch full option chain with Greeks for strategy decisions.
    Returns: OI, IV, Delta, Theta, Vega, Gamma, LTP, Bid/Ask
    """
    payload = {
        "UnderlyingScrip": int(underlying_sec_id),
        "UnderlyingSeg": "IDX_I",
        "Expiry": expiry_date
    }
    response = dhan.get_option_chain(payload)
    return response

def analyze_option_chain(chain_data):
    """
    Extract ATM strike, PCR, max OI levels for decision making.
    """
    calls = chain_data.get("data", {}).get("oc", {})

    max_call_oi_strike = None
    max_put_oi_strike  = None
    max_call_oi = 0
    max_put_oi  = 0
    total_call_oi = 0
    total_put_oi  = 0

    for strike, data in calls.items():
        # Call side
        call_oi = data.get("ce", {}).get("oi", 0)
        total_call_oi += call_oi
        if call_oi > max_call_oi:
            max_call_oi = call_oi
            max_call_oi_strike = strike

        # Put side
        put_oi = data.get("pe", {}).get("oi", 0)
        total_put_oi += put_oi
        if put_oi > max_put_oi:
            max_put_oi = put_oi
            max_put_oi_strike = strike

    # Put-Call Ratio
    pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0

    return {
        "pcr": round(pcr, 2),
        "max_call_oi_strike": max_call_oi_strike,  # Resistance
        "max_put_oi_strike": max_put_oi_strike,     # Support
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi
    }

# ═══════════════════════════════════════════
# 3. WEBSOCKET — REAL-TIME MARKET FEED
# ═══════════════════════════════════════════
class OptionsWebSocket:
    """
    DhanHQ WebSocket for real-time LTP, OHLCV streaming.
    Used for ORB, VWAP, and scalping strategies.
    """
    def __init__(self, client_id, access_token):
        self.client_id    = client_id
        self.access_token = access_token
        self.ws_url       = "wss://api-feed.dhan.co"
        self.ws           = None
        self.ltp_data     = {}
        self.ohlc_candles = {}  # For ORB calculation

    def on_message(self, ws, message):
        """Process incoming tick data"""
        data = json.loads(message)
        security_id = data.get("securityId")
        ltp         = data.get("LTP")

        if security_id and ltp:
            self.ltp_data[security_id] = {
                "ltp": ltp,
                "timestamp": datetime.now()
            }
            # Strategy hooks
            self.check_orb_signal(security_id, ltp)
            self.check_vwap_signal(security_id, ltp)

    def on_open(self, ws):
        """Subscribe to instruments on connection"""
        # Subscribe to Nifty + ATM options
        subscription = {
            "RequestCode": 1,
            "InstrumentCount": 2,
            "InstrumentList": [
                {"ExchangeSegment": 3, "SecurityId": 13},   # Nifty
                {"ExchangeSegment": 3, "SecurityId": 25},   # BankNifty
            ]
        }
        ws.send(json.dumps(subscription))

    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.ws_url,
            header={
                "access-token": self.access_token,
                "client-id": self.client_id
            },
            on_message=self.on_message,
            on_open=self.on_open,
            on_error=lambda ws, e: print(f"WS Error: {e}"),
            on_close=lambda ws, c, m: print("WS Closed")
        )
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()

    # ── ORB Strategy Logic ──
    orb_high = None
    orb_low  = None
    orb_set  = False
    orb_traded = False

    def check_orb_signal(self, sec_id, ltp):
        """Opening Range Breakout: 15-min range"""
        now = datetime.now()
        market_open = now.replace(hour=9, minute=15, second=0)
        orb_end     = now.replace(hour=9, minute=30, second=0)

        if now < orb_end and not self.orb_set:
            if self.orb_high is None or ltp > self.orb_high:
                self.orb_high = ltp
            if self.orb_low is None or ltp < self.orb_low:
                self.orb_low = ltp

        if now >= orb_end and not self.orb_set:
            self.orb_set = True
            print(f"ORB Set → High: {self.orb_high}, Low: {self.orb_low}")

        if self.orb_set and not self.orb_traded:
            if ltp > self.orb_high:
                print(f"🟢 ORB BREAKOUT CALL → LTP {ltp} > High {self.orb_high}")
                self.execute_option_buy("CALL", sec_id)
                self.orb_traded = True
            elif ltp < self.orb_low:
                print(f"🔴 ORB BREAKDOWN PUT → LTP {ltp} < Low {self.orb_low}")
                self.execute_option_buy("PUT", sec_id)
                self.orb_traded = True

    def check_vwap_signal(self, sec_id, ltp):
        """VWAP trend-following placeholder"""
        # Calculate VWAP from accumulated volume-weighted prices
        # Buy CE if LTP > VWAP and VWAP sloping up
        # Buy PE if LTP < VWAP and VWAP sloping down
        pass

    def execute_option_buy(self, direction, underlying_sec_id):
        """Place option buy order via DhanHQ REST API"""
        # Fetch ATM strike from option chain
        chain = get_option_chain(str(underlying_sec_id))
        analysis = analyze_option_chain(chain)

        # Determine ATM strike
        spot = self.ltp_data.get(underlying_sec_id, {}).get("ltp", 0)
        atm_strike = round(spot / 50) * 50  # Nifty lot = 50

        # Place SUPER ORDER (Entry + SL + Target)
        order_payload = {
            "dhanClientId": self.client_id,
            "transactionType": "BUY",
            "exchangeSegment": "IDX_I",
            "productType": "INTRADAY",
            "orderType": "MARKET",
            "securityId": "OPTION_SECURITY_ID",  # Resolve from chain
            "quantity": 75,   # Nifty lot size (2026)
            "disclosedQuantity": 0,
            "price": 0,
            "triggerPrice": 0,
            "validity": "DAY",
            # Super Order legs
            "targetPrice": 0,     # Set based on strategy
            "stopLossPrice": 0,   # 30-40% of premium
        }

        # response = dhan.place_super_order(order_payload)
        print(f"📤 Order Placed: {direction} @ Strike {atm_strike}")

# ═══════════════════════════════════════════
# 4. STRATEGY: BULL CALL SPREAD
# ═══════════════════════════════════════════
def bull_call_spread(spot_price, expiry_date):
    """
    Buy ATM Call + Sell OTM Call (200 pts apart for Nifty)
    Reduces theta burn vs naked call buying.
    """
    atm_strike = round(spot_price / 50) * 50
    otm_strike = atm_strike + 200  # 200-pt wide spread

    # Leg 1: Buy ATM CE
    leg1 = {
        "transactionType": "BUY",
        "securityId": f"NIFTY_{atm_strike}_CE",
        "quantity": 75,
        "orderType": "MARKET",
        "productType": "INTRADAY"
    }

    # Leg 2: Sell OTM CE
    leg2 = {
        "transactionType": "SELL",
        "securityId": f"NIFTY_{otm_strike}_CE",
        "quantity": 75,
        "orderType": "MARKET",
        "productType": "INTRADAY"
    }

    # Place both legs
    # dhan.place_order(leg1)
    # dhan.place_order(leg2)

    max_loss   = "Net Premium Paid"
    max_profit = f"{otm_strike - atm_strike} - Net Premium"
    print(f"Bull Call Spread: Buy {atm_strike}CE / Sell {otm_strike}CE")
    print(f"Max Loss: {max_loss} | Max Profit: {max_profit}")

# ═══════════════════════════════════════════
# 5. RISK MANAGEMENT ENGINE
# ═══════════════════════════════════════════
class RiskManager:
    MAX_RISK_PER_TRADE = 0.02   # 2% of capital
    MAX_DAILY_LOSS     = 0.05   # 5% daily drawdown limit
    MAX_OPEN_TRADES    = 3

    def __init__(self, capital):
        self.capital       = capital
        self.daily_pnl     = 0
        self.open_trades   = 0

    def can_trade(self):
        if self.daily_pnl <= -(self.capital * self.MAX_DAILY_LOSS):
            print("🛑 Daily loss limit hit. No more trades.")
            return False
        if self.open_trades >= self.MAX_OPEN_TRADES:
            print("🛑 Max open trades reached.")
            return False
        return True

    def position_size(self, premium_per_unit, lot_size=75):
        """Calculate lots based on 2% risk rule"""
        risk_amount = self.capital * self.MAX_RISK_PER_TRADE
        risk_per_lot = premium_per_unit * lot_size * 0.40  # 40% SL
        lots = max(1, int(risk_amount / risk_per_lot))
        return lots

# ═══════════════════════════════════════════
# 6. MAIN EXECUTION LOOP
# ═══════════════════════════════════════════
if __name__ == "__main__":
    capital = 500000  # ₹5 Lakh
    rm = RiskManager(capital)

    # Start WebSocket for real-time data
    ws_client = OptionsWebSocket(client_id, access_token)
    ws_client.connect()

    # Fetch option chain periodically (every 30s)
    while True:
        if rm.can_trade():
            chain = get_option_chain()
            analysis = analyze_option_chain(chain)
            print(f"PCR: {analysis['pcr']} | "
                  f"Resistance: {analysis['max_call_oi_strike']} | "
                  f"Support: {analysis['max_put_oi_strike']}")
        time.sleep(30)
```

---

## 📋 STRATEGY SELECTION CHEAT SHEET

| Market Condition | Best Buying Strategy | India VIX | Time |
|---|---|---|---|
| **Trending / Breakout** | ORB + ATM Call/Put Buy  | > 14 | 9:15–10:30 AM |
| **Strong Trend** | VWAP Pullback + CE/PE  | Any | 10:00 AM–2:00 PM |
| **Moderate Bullish/Bearish** | Bull Call / Bear Put Spread  | Any | Positional |
| **Event Ahead** | Long Straddle / Strangle  | < 13 (cheap) | 1–2 days before |
| **Low Vol → Expansion** | Calendar Spread  | < 12 | Positional |
| **Expiry Scalping** | ATM quick scalps  | Any | 1:00–3:00 PM expiry day |

---

## ⚠️ CRITICAL RULES FOR OPTION BUYERS

1. **Never buy weekly OTM options without momentum** — theta will destroy you
2. **Risk max 1–2% of capital per trade**
3. **Always use Super Order API** for auto SL + Target
4. **Check India VIX before every trade** — low VIX = cheap premiums = better buying
5. **Avoid midday (11:30–1:00)** — low volume, choppy, theta burns
6. **Bank Nifty for intraday buying** (higher volatility); **Nifty for spreads/positional**
7. **Pre-defined SL beats mental SL** — exit without emotion
8. **No trade is also a trade** — most losses happen from boredom trades

---

## 📦 DhanHQ V2 API Quick Reference

| What | Endpoint / Method | Docs |
|---|---|---|
| Option Chain + Greeks | `dhan.get_option_chain()` |  |
| WebSocket Live Feed | `wss://api-feed.dhan.co` |  |
| Place Order | `dhan.place_order()` |  |
| Super Order (SL+Target) | `dhan.place_super_order()` |  |
| Trigger/Conditional Orders | Condition-based entry |  |
| Historical Data (Backtest) | `dhan.historical_data()` |  |
| Python SDK | `pip install dhanhq` (v2.3.0-rc1) |  |

> **Pro Tip:** DhanHQ now provides **expired option data with IV and Greeks**, enabling you to build a historical option chain simulator for backtesting strategies before going live .

---

**Bottom line:** For index option **buying**, the strategies with the most consistent edge are **ORB breakouts**, **VWAP trend-following**, and **defined-risk spreads** (Bull Call / Bear Put). Automate them with DhanHQ's WebSocket for real-time signals + Super Order API for risk-managed execution, and enforce the 2% risk rule religiously.


Below is a practical **Index Options Strategy Library** for **Nifty / BankNifty / Sensex / FinNifty** style index options, covering:

- **LONG-only strategies** → usually **option buying**
- **SHORT-only strategies** → usually **option selling/writing**
- **BOTH BUY + SELL strategies** → spreads, combos, hedged structures
- How they map to **DhanHQ V2 REST + WebSocket APIs**
- What generally “works” more reliably in real trading, and what is mostly noise

Important: “Works” means **positive expectancy after brokerage, STT, slippage, impact cost, and drawdown control**. No strategy works every day.

---

# 1. Core Truth: Long vs Short Options

| Type | Main Edge | Main Risk | Best Market Condition |
|---|---|---|---|
| **Long Options / Buying** | Unlimited profit potential, low capital, benefits from momentum/volatility expansion | Theta decay, IV crush, wrong timing | Strong moves, breakouts, events, low IV before expansion |
| **Short Options / Selling** | Theta income, higher probability, benefits from time decay and IV crush | Large/unlimited loss if unhedged, margin requirement, gap risk | Range-bound, high IV, mean reversion, expiry decay |
| **Buy + Sell Combos** | Defined risk, lower cost, balanced Greeks | Complexity, leg execution risk | Specific view on direction + volatility + time |

For index options, especially Indian weekly index options:

- **Option buying works only when momentum/volatility is strong.**
- **Option selling works more often, but tail risk must be hedged.**
- **Spreads/defined-risk structures are usually the best starting point.**

---

# 2. LONG-Only Strategies — Option Buying

These are strategies where you are **buying CE/PE**.

---

## 2.1 Long Call

### View
Bullish.

### Setup
Buy CE when you expect index to rise.

### Best When
- Strong uptrend
- Breakout above resistance
- Rising OI on calls
- India VIX rising or stable
- Momentum indicators aligned

### Avoid When
- Market sideways
- High IV before event
- Late in the day with no momentum
- Cheap OTM “hero-zero” trades

### Strike Selection
Use:

- **ATM** or **slightly ITM** for directional intraday
- Delta around **0.50 to 0.70**
- Avoid deep OTM unless strong event/momentum setup

### Risk
Max loss = premium paid.

### Reward
Unlimited theoretically.

### Practical Rating
Works only with good timing.
Without momentum, theta kills long calls.

---

## 2.2 Long Put

### View
Bearish.

### Setup
Buy PE when you expect index to fall.

### Best When
- Breakdown below support
- Falling market with rising put OI
- Negative news flow
- Global weakness
- High intraday momentum downward

### Strike Selection
Use ATM or slightly ITM puts.

### Risk
Max loss = premium paid.

### Reward
Large if index falls sharply.

### Practical Rating
Often better than long calls in crashes because downside moves are faster.
Falls can be sharp and volatility-friendly for put buyers.

---

## 2.3 Opening Range Breakout — ORB Option Buying

### View
Directional momentum.

### Setup
- Mark first 5-minute, 15-minute, or 30-minute high/low.
- If index breaks above opening range, buy ATM CE.
- If index breaks below opening range, buy ATM PE.

### Common Timeframes
- 5-min ORB: aggressive
- 15-min ORB: balanced
- 30-min ORB: conservative

### Best When
- First candle has clean range
- Volume supports breakout
- No major reversal news
- India VIX supports movement

### Stop-Loss
- Below breakout candle low for CE
- Above breakdown candle high for PE
- Or premium-based SL: 25% to 40%

### Target
- 1:2 or 1:3 risk-reward
- Trail after momentum extension

### Practical Rating
One of the better intraday option-buying strategies because it trades only when momentum appears.

---

## 2.4 VWAP Pullback Option Buying

### View
Trend continuation.

### Setup
- If price is above VWAP and VWAP is rising, buy CE on pullback to VWAP.
- If price is below VWAP and VWAP is falling, buy PE on pullback to VWAP.

### Best When
- Trending day
- VWAP sloping clearly
- Pullback volume lower than impulse volume

### Avoid When
- Flat VWAP
- Choppy sideways market
- Repeated VWAP crosses

### Practical Rating
Good for trending intraday markets.
Bad in sideways markets.

---

## 2.5 Momentum Breakout with Volume/OI Confirmation

### View
Directional.

### Setup
Buy options when:

- Price breaks key level
- Volume increases
- Call OI increases for bullish breakout
- Put OI increases for bearish breakdown
- Futures premium/discount confirms direction

### Common Levels
- Previous day high/low
- Pre-market high/low
- Round numbers
- Max OI strikes
- Pivot levels
- CPR levels
- High-volume nodes

### Practical Rating
Works when breakout is real.
Many breakouts fail, so confirmation is important.

---

## 2.6 Bull Call Spread

### View
Moderately bullish.

### Structure
- Buy ATM/lower CE
- Sell higher CE

Example:

```text
Nifty spot: 24,800
Buy 24,800 CE
Sell 25,000 CE
```

### Max Loss
Net premium paid.

### Max Profit
Spread width minus net premium.

### Why It Works Better Than Naked Call Buying
- Lower cost
- Lower theta damage
- Defined risk
- Easier position sizing

### Best When
- You expect upside but not explosive upside
- IV is high, making naked calls expensive
- You want defined risk

### Practical Rating
One of the best long strategies for consistent traders.

---

## 2.7 Bear Put Spread

### View
Moderately bearish.

### Structure
- Buy ATM/higher PE
- Sell lower PE

Example:

```text
Nifty spot: 24,800
Buy 24,800 PE
Sell 24,600 PE
```

### Max Loss
Net premium paid.

### Max Profit
Spread width minus net premium.

### Best When
- Expect downside move
- Want reduced theta burn
- Want defined risk

### Practical Rating
Good alternative to naked put buying.

---

## 2.8 Long Straddle

### View
Big move expected, direction unknown.

### Structure
Buy ATM CE + Buy ATM PE.

Example:

```text
Buy 24,800 CE
Buy 24,800 PE
```

### Profit When
Index moves more than total premium paid in either direction.

### Best When
- Before major event
- RBI policy
- Budget
- Election result
- CPI data
- Global event
- Low IV expected to expand

### Risk
Theta decay and IV crush.

### Practical Rating
Works mainly when bought before volatility expansion.
Very dangerous after event when IV crush happens.

---

## 2.9 Long Strangle

### View
Big move expected, direction unknown.

### Structure
Buy OTM CE + Buy OTM PE.

Example:

```text
Buy 25,000 CE
Buy 24,600 PE
```

### Advantage
Cheaper than straddle.

### Disadvantage
Needs bigger move.

### Best When
- Low premium environment
- Expected large move
- Event catalyst

### Practical Rating
Good for event plays, but lower probability than straddle.

---

## 2.10 Calendar Spread — Long Calendar

### View
Neutral to slightly directional, expecting volatility rise or slow movement.

### Structure
- Sell near-expiry option
- Buy far-expiry same strike

Example:

```text
Sell current week 24,800 CE
Buy next week 24,800 CE
```

### Edge
Near-expiry option decays faster than far-expiry option.

### Best When
- Low IV
- Expect volatility to rise
- Market expected to stay near strike initially

### Risk
Large directional move away from strike.

### Practical Rating
Useful but more advanced. Needs good IV understanding.

---

## 2.11 Diagonal Spread

### View
Directional + time/volatility management.

### Structure
Different strikes and different expiries.

Example bullish diagonal:

```text
Buy next month 24,800 CE
Sell current week 25,000 CE
```

### Advantage
Lower cost than pure long call.

### Risk
Complex Greeks, leg management.

### Practical Rating
Good for advanced traders.
Not ideal for beginners.

---

## 2.12 Poor Man’s Covered Call — PMCC

### View
Bullish over time.

### Structure
- Buy deep ITM far-expiry call
- Sell near-expiry OTM call

Example:

```text
Buy next month 24,500 CE
Sell current week 25,000 CE
```

### Edge
Creates income against long call.

### Best When
- Moderately bullish
- Want leveraged covered-call-like structure
- Far call has enough time value

### Risk
Downside if market falls; capped upside.

### Practical Rating
Useful in index options if liquidity is good.

---

## 2.13 Call Backspread / Put Backspread

### View
Strong directional move expected.

### Call Backspread
- Sell 1 ATM/lower CE
- Buy 2 or more higher OTM CE

### Put Backspread
- Sell 1 ATM/higher PE
- Buy 2 or more lower OTM PE

### Edge
Can be done for low cost or credit.
Big profit if large move happens.

### Risk
Loss if market stays near short strike.

### Practical Rating
Good for volatility expansion, but requires careful strike selection.

---

## 2.14 Gamma Scalping

### View
Long volatility, market-neutral delta management.

### Structure
- Long straddle or strangle
- Delta hedge with futures
- Re-hedge as market moves

### Edge
Profit if realized volatility > implied volatility.

### Risk
Theta burn, transaction costs, futures margin.

### Practical Rating
Professional strategy.
Not ideal for retail intraday unless very disciplined.

---

## 2.15 Expiry-Day ATM Scalping

### View
Short-term momentum.

### Setup
- Trade only ATM options
- Hold seconds to minutes
- Capture gamma spikes
- Use strict stop-loss

### Best When
- Expiry day
- Sudden momentum
- Short covering
- Panic moves
- Large OI unwinding

### Risk
Very high.
One bad trade can erase many good trades.

### Practical Rating
Works for experienced scalpers only.

---

# 3. SHORT-Only Strategies — Option Selling

These are strategies where you are **selling/writing CE/PE**.

For index options, short strategies usually have higher win probability but require margin and risk control.

---

## 3.1 Short Call

### View
Bearish or neutral.

### Setup
Sell CE when you expect index not to rise above strike.

### Risk
Unlimited if unhedged.

### Best When
- Resistance strong
- Call OI acting as ceiling
- Negative trend
- High IV

### Practical Rating
Dangerous unhedged.
Better as bear call spread.

---

## 3.2 Short Put

### View
Bullish or neutral.

### Setup
Sell PE when you expect index not to fall below strike.

### Risk
Large if market crashes.

### Best When
- Strong support
- Put OI support
- Positive trend
- High IV

### Practical Rating
Better as bull put spread.

---

## 3.3 Short Straddle

### View
Range-bound / volatility compression.

### Structure
Sell ATM CE + Sell ATM PE.

Example:

```text
Sell 24,800 CE
Sell 24,800 PE
```

### Edge
Theta income.

### Risk
Unlimited on both sides if unhedged.

### Common Web Versions
- 9:15 straddle
- 9:20 straddle
- 9:30 straddle
- 12:30 straddle
- Expiry-day straddle

### Practical Rating
Popular and can work, but tail risk is severe.
Better to convert into iron butterfly by buying wings.

---

## 3.4 Short Strangle

### View
Range-bound.

### Structure
Sell OTM CE + Sell OTM PE.

Example:

```text
Sell 25,100 CE
Sell 24,500 PE
```

### Edge
Higher probability than ATM straddle.

### Risk
Unlimited if market trends strongly.

### Practical Rating
Works in sideways markets.
Must hedge or use strict risk management.

---

## 3.5 Bear Call Spread

### View
Bearish or neutral.

### Structure
- Sell lower CE
- Buy higher CE

Example:

```text
Sell 24,900 CE
Buy 25,100 CE
```

### Max Loss
Defined.

### Max Profit
Net credit received.

### Best When
- Resistance above
- Negative bias
- High IV
- Want defined risk

### Practical Rating
One of the best short strategies for directional bearish/neutral view.

---

## 3.6 Bull Put Spread

### View
Bullish or neutral.

### Structure
- Sell higher PE
- Buy lower PE

Example:

```text
Sell 24,700 PE
Buy 24,500 PE
```

### Max Loss
Defined.

### Max Profit
Net credit received.

### Best When
- Support below
- Positive bias
- High IV

### Practical Rating
One of the best short strategies for directional bullish/neutral view.

---

## 3.7 Iron Condor

### View
Range-bound.

### Structure
Combine bull put spread + bear call spread.

Example:

```text
Sell 24,600 PE
Buy 24,400 PE

Sell 25,000 CE
Buy 25,200 CE
```

### Max Loss
Defined.

### Max Profit
Net credit.

### Best When
- Market expected to stay inside range
- High IV
- No major event nearby
- Theta decay favorable

### Avoid When
- Breakout expected
- Event day
- Low IV
- Strong trend day

### Practical Rating
One of the most reliable defined-risk income strategies.

---

## 3.8 Iron Butterfly

### View
Strongly range-bound around ATM.

### Structure
Sell ATM straddle + buy wings.

Example:

```text
Sell 24,800 CE
Sell 24,800 PE

Buy 25,000 CE
Buy 24,600 PE
```

### Max Loss
Defined.

### Max Profit
Usually higher than iron condor if market stays near ATM.

### Risk
Loss if market moves strongly away.

### Practical Rating
Good for high IV, range-bound expectations.
More sensitive than iron condor.

---

## 3.9 Ratio Spread

### View
Mild directional with income.

### Call Ratio Spread
- Buy 1 lower CE
- Sell 2 higher CE

### Put Ratio Spread
- Buy 1 higher PE
- Sell 2 lower PE

### Edge
Can be done for credit.

### Risk
Unlimited/large beyond short strikes.

### Practical Rating
Advanced.
Only use if you understand tail risk.

---

## 3.10 Jade Lizard

### View
Neutral to bullish.

### Structure
- Short put
- Bear call spread

Example:

```text
Sell 24,600 PE

Sell 25,000 CE
Buy 25,200 CE
```

### Edge
If total credit received is greater than call spread width, upside risk can be eliminated.

### Risk
Downside risk from short put.

### Practical Rating
Useful neutral-bullish structure.
Requires correct credit calculation.

---

## 3.11 Broken Wing Butterfly

### View
Directional with skewed risk/reward.

### Structure
A butterfly with one wing skipped or widened.

Example bullish broken wing butterfly:

```text
Buy 24,700 CE
Sell 2x 24,900 CE
Buy 25,300 CE
```

### Edge
Can be structured for zero cost or credit.
Large payout if market reaches short strike.

### Risk
Can have large tail risk depending on structure.

### Practical Rating
Advanced but powerful.

---

## 3.12 Short-Term Theta Decay Strategies

These include:

- Weekly short strangles
- Expiry-day short straddles
- Afternoon decay trades
- 3:00 PM scalp/sell strategies

### Edge
Time decay accelerates near expiry.

### Risk
Gamma spikes can destroy short sellers.

### Practical Rating
Works often, but one bad expiry move can wipe out many small profits if unhedged.

---

# 4. BOTH BUY + SELL Strategies — Combined Structures

These are usually the most professional because they balance:

- Direction
- Volatility
- Theta
- Defined risk
- Margin efficiency

---

## 4.1 Vertical Spreads

Vertical spreads are the foundation of practical options trading.

### Bullish Verticals
- Bull call spread → debit
- Bull put spread → credit

### Bearish Verticals
- Bear call spread → credit
- Bear put spread → debit

### Why They Work
- Defined risk
- Lower margin
- Lower cost
- Easier automation
- Less damage from theta

### Practical Rating
Excellent for systematic trading.

---

## 4.2 Iron Condor

Already covered above.

### Type
Both buy and sell.

### Best Market
Range-bound.

### Practical Rating
One of the best defined-risk income strategies.

---

## 4.3 Iron Butterfly

Already covered above.

### Type
Both buy and sell.

### Best Market
Strong range-bound around ATM.

### Practical Rating
Good but more gamma-sensitive.

---

## 4.4 Calendar Spread

Already covered above.

### Type
Buy far, sell near.

### Best Market
Low volatility, expected expansion or slow movement.

### Practical Rating
Good for volatility traders.

---

## 4.5 Diagonal Spread

Already covered above.

### Type
Different strikes and expiries.

### Practical Rating
Advanced but useful.

---

## 4.6 Risk Reversal

### Bullish Risk Reversal
- Buy call
- Sell put

### Bearish Risk Reversal
- Buy put
- Sell call

### Synthetic View
Bullish risk reversal behaves somewhat like synthetic long futures.
Bearish risk reversal behaves somewhat like synthetic short futures.

### Risk
Large directional risk.

### Practical Rating
Useful for strong directional views, but margin and risk must be managed.

---

## 4.7 Collar

Usually used with underlying/futures.

### Structure
- Long underlying/futures
- Buy protective put
- Sell call to finance put

### Index Version
Can be done with index futures + index options.

### Practical Rating
Good for hedging existing portfolio or futures position.

---

## 4.8 Strap

### View
Bullish volatility.

### Structure
Buy extra calls relative to puts.

Example:

```text
Buy 2x ATM CE
Buy 1x ATM PE
```

### Edge
Profits from big move, especially upside.

### Risk
Theta decay.

### Practical Rating
Good when expecting volatile bullish move.

---

## 4.9 Strip

### View
Bearish volatility.

### Structure
Buy extra puts relative to calls.

Example:

```text
Buy 1x ATM CE
Buy 2x ATM PE
```

### Edge
Profits from big move, especially downside.

### Risk
Theta decay.

### Practical Rating
Good when expecting volatile bearish move.

---

## 4.10 Ratio Backspread

Already covered above.

### Type
Buy more OTM options than sold near options.

### Practical Rating
Good for low-cost directional volatility bets.

---

## 4.11 Ratio Frontspread

### Type
Sell more near options than bought far options.

### Risk
Can have large tail risk.

### Practical Rating
Advanced. Not beginner-friendly.

---

## 4.12 Box Spread

### Type
Arbitrage-like structure.

### Practical Rating
Usually not practical for retail due to costs, margin, liquidity, and execution risk.

---

# 5. Strategy Selection Matrix

Use this as a practical decision engine.

| Market View | Volatility View | Best Strategies |
|---|---|---|
| Strong bullish | Low/rising IV | Long call, bull call spread, call backspread, risk reversal |
| Strong bearish | Low/rising IV | Long put, bear put spread, put backspread, strip |
| Mild bullish | High IV | Bull put spread, jade lizard, short put spread |
| Mild bearish | High IV | Bear call spread, short call spread |
| Range-bound | High IV | Iron condor, iron butterfly, short strangle hedged |
| Range-bound | Low IV | Calendar spread, diagonal, avoid naked short |
| Big move expected | Low IV | Long straddle, long strangle, backspread |
| Event day | High IV | Avoid naked long; prefer spreads or defined-risk structures |
| Expiry momentum | Rising gamma | ATM scalping, small directional spreads |
| Uncertain | High IV | Iron condor, iron butterfly, hedged straddle |

---

# 6. What Actually Works More Often?

Based on common market behavior and systematic trading logic:

---

## A. Most Reliable for Consistency

### 1. Defined-Risk Credit Spreads
Examples:

- Bull put spread
- Bear call spread

Why:

- Theta helps
- Defined risk
- Easier automation
- Good for high IV environments

---

### 2. Iron Condors
Why:

- Benefit from range-bound markets
- Defined risk
- Good for systematic execution
- Works well when IV is elevated

---

### 3. Bull Call / Bear Put Debit Spreads
Why:

- Better than naked option buying
- Lower theta damage
- Defined risk
- Good for directional views

---

## B. Good But Requires Timing

### 4. ORB / Momentum Option Buying
Works when:

- Market trends strongly
- Breakout is real
- Volume/OI confirms

Fails when:

- Choppy sideways market
- Fake breakouts
- Low volatility

---

### 5. Event Volatility Trades
Works when:

- IV is low before event
- Expected move is underpriced
- You exit before/after catalyst correctly

Fails when:

- IV already high
- IV crush after event
- Market does not move enough

---

## C. High Probability but Dangerous

### 6. Short Straddles / Short Strangles
Works often because:

- Options often expire with decay
- Markets spend time range-bound

Danger:

- One trend day can erase months of profits
- Must hedge or use strict risk limits

---

## D. Advanced but Powerful

### 7. Gamma Scalping
Works if:

- Realized volatility > implied volatility
- Transaction costs controlled
- Delta hedging disciplined

---

### 8. Calendar/Diagonal Spreads
Works if:

- You understand IV term structure
- You manage legs properly

---

# 7. Popular Web Strategies and Honest Assessment

---

## 7.1 9:20 Short Straddle

### Idea
Sell ATM CE and PE at 9:20 AM with stop-loss.

### Why Popular
Theta decay and morning premium.

### Reality
Can work, but:

- Slippage is real
- Stop-loss hunting happens
- Trend days hurt badly
- Requires hedging or strict risk control

### Better Version
Convert to iron butterfly:

```text
Sell ATM CE
Sell ATM PE
Buy OTM CE wing
Buy OTM PE wing
```

---

## 7.2 Max Pain Strategy

### Idea
Market tends to move toward strike with maximum option writer pain minimization.

### Reality
Useful as context, not standalone.

Best used with:

- OI change
- Price action
- Trend
- VWAP
- Volume

---

## 7.3 PCR Strategy

### Idea
Put-Call Ratio indicates bullish/bearish extremes.

### Reality
PCR is better as a contrarian indicator at extremes.

Examples:

- Very high PCR → possible overbought/contrarian bearish
- Very low PCR → possible oversold/contrarian bullish

Not reliable alone.

---

## 7.4 OI Breakout Strategy

### Idea
Use call/put OI buildup to predict direction.

### Reality
Useful but needs confirmation.

Good combinations:

- Price breakout + call writing weakening → bullish
- Price breakdown + put writing weakening → bearish
- Price at resistance + heavy call OI → bearish unless breakout
- Price at support + heavy put OI → bullish unless breakdown

---

## 7.5 IV Crush Event Strategy

### Idea
Sell options before event to capture IV crush.

### Reality
Works, but event risk is huge.

Better:

- Use iron condor
- Use credit spreads
- Avoid naked short
- Reduce position size

---

## 7.6 Hero-Zero Expiry Buying

### Idea
Buy cheap OTM options on expiry for huge multiples.

### Reality
Mostly gambling.
Occasional big wins create survivorship bias.

Not a robust strategy.

---

# 8. Recommended Strategy Stack for Index Options

If you want a practical system, use a **core + satellite** approach.

---

## Core Portfolio — Defined Risk Income

Use 60%–70% of risk capital allocation.

Strategies:

- Iron condor
- Bull put spread
- Bear call spread
- Iron butterfly

Conditions:

- Trade when IV is reasonably high
- Avoid event days unless hedged
- Use wide strikes
- Target high probability but defined risk

---

## Satellite Portfolio — Directional/Momentum

Use 20%–30% of risk capital allocation.

Strategies:

- Bull call spread
- Bear put spread
- ORB option buying
- VWAP momentum trades

Conditions:

- Trade only with clear trend
- Use ATM/ITM options
- Strict stop-loss
- No averaging losers

---

## Event/Volatility Portfolio

Use 5%–10% of risk capital allocation.

Strategies:

- Long straddle
- Long strangle
- Backspreads
- Calendar spreads

Conditions:

- Enter when IV is low
- Avoid buying after IV already spiked
- Define exit before event or after move

---

# 9. DhanHQ V2 API Mapping

You can automate these using DhanHQ V2.

---

## 9.1 Data Layer

### REST APIs

| Purpose | DhanHQ V2 Use |
|---|---|
| Option chain | Fetch strikes, CE/PE LTP, OI, IV, Greeks |
| Historical data | Backtest spot/futures/options |
| Order placement | Send buy/sell orders |
| Super order | Entry + target + stop-loss |
| Margins | Check required margin |
| Positions | Track open trades |
| Order status | Confirm execution |

### WebSocket

| Purpose | Use |
|---|---|
| Real-time LTP | Signal generation |
| Real-time OHLCV | ORB/VWAP/momentum |
| Fast updates | Scalping and risk control |
| Position monitoring | Auto exit/hedge |

---

## 9.2 Strategy Layer

Your engine should have:

1. **Market regime detector**
   - Trending
   - Range-bound
   - High volatility
   - Low volatility
   - Event day

2. **Signal generator**
   - ORB breakout
   - VWAP cross
   - OI change
   - PCR extreme
   - IV rank
   - Momentum

3. **Strategy selector**
   - Choose long/short/combined strategy

4. **Risk engine**
   - Position size
   - Max loss
   - Daily loss limit
   - Margin check
   - Kill switch

5. **Execution engine**
   - Leg execution
   - Limit orders
   - Failed-leg handling
   - Reconciliation

---

# 10. Python Architecture Using DhanHQ V2

Below is a practical skeleton.

---

## 10.1 Install SDK

```bash
pip install dhanhq==2.3.0rc1
```

---

## 10.2 Basic Client

```python
from dhanhq import dhanhq

client_id = "YOUR_CLIENT_ID"
access_token = "YOUR_ACCESS_TOKEN"

dhan = dhanhq(client_id, access_token)
```

---

## 10.3 Fetch Option Chain

```python
def get_option_chain(underlying_scrip=13, expiry="2026-07-30"):
    """
    Example for Nifty index.
    underlying_scrip and segment may vary by broker master.
    """
    payload = {
        "UnderlyingScrip": underlying_scrip,
        "UnderlyingSeg": "IDX_I",
        "Expiry": expiry
    }

    response = dhan.get_option_chain(payload)
    return response
```

---

## 10.4 Extract ATM, PCR, OI Levels

```python
def analyze_option_chain(chain):
    data = chain.get("data", {}).get("oc", {})

    total_call_oi = 0
    total_put_oi = 0

    max_call_oi_strike = None
    max_put_oi_strike = None

    max_call_oi = 0
    max_put_oi = 0

    for strike, option in data.items():
        ce = option.get("ce", {})
        pe = option.get("pe", {})

        call_oi = ce.get("oi", 0)
        put_oi = pe.get("oi", 0)

        total_call_oi += call_oi
        total_put_oi += put_oi

        if call_oi > max_call_oi:
            max_call_oi = call_oi
            max_call_oi_strike = strike

        if put_oi > max_put_oi:
            max_put_oi = put_oi
            max_put_oi_strike = strike

    pcr = total_put_oi / total_call_oi if total_call_oi else 0

    return {
        "pcr": round(pcr, 2),
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi,
        "resistance_strike": max_call_oi_strike,
        "support_strike": max_put_oi_strike
    }
```

---

## 10.5 Find ATM Strike

```python
def get_atm_strike(spot, lot_size=50):
    return round(spot / lot_size) * lot_size
```

For Nifty, lot size is commonly 50 points for strikes.
For trading quantity, use current exchange lot size, which may change.

---

## 10.6 Simple Strategy Selector

```python
def choose_strategy(iv_rank, trend_score, pcr, event_day=False):
    """
    trend_score:
        > +1  = bullish
        < -1  = bearish
        near 0 = sideways

    iv_rank:
        0 to 100
    """

    if event_day:
        if iv_rank < 30:
            return "LONG_STRADDLE"
        else:
            return "IRON_CONDOR_SMALL_SIZE"

    if abs(trend_score) < 0.5:
        if iv_rank > 65:
            return "IRON_CONDOR"
        else:
            return "NO_TRADE_OR_CALENDAR"

    if trend_score > 1:
        if iv_rank > 60:
            return "BULL_PUT_CREDIT_SPREAD"
        else:
            return "BULL_CALL_DEBIT_SPREAD"

    if trend_score < -1:
        if iv_rank > 60:
            return "BEAR_CALL_CREDIT_SPREAD"
        else:
            return "BEAR_PUT_DEBIT_SPREAD"

    return "NO_TRADE"
```

---

## 10.7 Calculate Trend Score Example

```python
import pandas as pd

def trend_score_from_df(df):
    """
    df must have columns: close, vwap
    Simple trend scoring.
    """

    close = df["close"].iloc[-1]
    vwap = df["vwap"].iloc[-1]
    ema20 = df["close"].ewm(span=20).mean().iloc[-1]
    ema50 = df["close"].ewm(span=50).mean().iloc[-1]

    score = 0

    if close > vwap:
        score += 1
    else:
        score -= 1

    if ema20 > ema50:
        score += 1
    else:
        score -= 1

    if close > ema20:
        score += 1
    else:
        score -= 1

    return score
```

---

## 10.8 Risk Manager

```python
class RiskManager:
    def __init__(self, capital):
        self.capital = capital
        self.daily_pnl = 0
        self.open_trades = 0

    def can_trade(self):
        if self.daily_pnl <= -0.03 * self.capital:
            print("Daily loss limit hit.")
            return False

        if self.open_trades >= 3:
            print("Max open trades reached.")
            return False

        return True

    def position_size_lots(self, risk_per_trade_pct, premium, lot_qty, stop_loss_pct):
        risk_amount = self.capital * risk_per_trade_pct
        risk_per_lot = premium * lot_qty * stop_loss_pct
        lots = int(risk_amount / risk_per_lot)
        return max(lots, 0)
```

Example:

```python
rm = RiskManager(capital=500000)

if rm.can_trade():
    lots = rm.position_size_lots(
        risk_per_trade_pct=0.01,
        premium=120,
        lot_qty=75,
        stop_loss_pct=0.35
    )
    print("Lots:", lots)
```

---

## 10.9 Place Simple Option Buy Order

```python
def buy_option(dhan, security_id, qty, price=None):
    payload = {
        "transactionType": "BUY",
        "exchangeSegment": "IDX_I",
        "productType": "INTRADAY",
        "orderType": "LIMIT" if price else "MARKET",
        "securityId": security_id,
        "quantity": qty,
        "price": price if price else 0,
        "validity": "DAY"
    }

    response = dhan.place_order(payload)
    return response
```

---

## 10.10 Place Option Sell Order

```python
def sell_option(dhan, security_id, qty, price=None):
    payload = {
        "transactionType": "SELL",
        "exchangeSegment": "IDX_I",
        "productType": "INTRADAY",
        "orderType": "LIMIT" if price else "MARKET",
        "securityId": security_id,
        "quantity": qty,
        "price": price if price else 0,
        "validity": "DAY"
    }

    response = dhan.place_order(payload)
    return response
```

---

## 10.11 Bull Call Spread Execution

```python
def bull_call_spread(dhan, buy_ce_sec_id, sell_ce_sec_id, qty, buy_price, sell_price):
    leg1 = buy_option(dhan, buy_ce_sec_id, qty, buy_price)
    leg2 = sell_option(dhan, sell_ce_sec_id, qty, sell_price)

    return {
        "buy_leg": leg1,
        "sell_leg": leg2
    }
```

Important:

- Prefer limit orders.
- Check both legs executed.
- If one leg fails, flatten the other.
- Do not leave partial execution unhedged.

---

## 10.12 Iron Condor Execution

```python
def iron_condor(
    dhan,
    qty,
    sell_put_sec_id,
    buy_put_sec_id,
    sell_call_sec_id,
    buy_call_sec_id,
    sell_put_price,
    buy_put_price,
    sell_call_price,
    buy_call_price
):
    responses = {}

    responses["sell_put"] = sell_option(dhan, sell_put_sec_id, qty, sell_put_price)
    responses["buy_put"] = buy_option(dhan, buy_put_sec_id, qty, buy_put_price)
    responses["sell_call"] = sell_option(dhan, sell_call_sec_id, qty, sell_call_price)
    responses["buy_call"] = buy_option(dhan, buy_call_sec_id, qty, buy_call_price)

    return responses
```

---

## 10.13 WebSocket Skeleton

```python
import websocket
import json
import threading

class DhanWS:
    def __init__(self, client_id, access_token):
        self.client_id = client_id
        self.access_token = access_token
        self.ws_url = "wss://api-feed.dhan.co"
        self.ws = None
        self.ltp = {}

    def on_open(self, ws):
        print("WebSocket connected")

        subscription = {
            "RequestCode": 1,
            "InstrumentCount": 1,
            "InstrumentList": [
                {
                    "ExchangeSegment": 3,
                    "SecurityId": 13
                }
            ]
        }

        ws.send(json.dumps(subscription))

    def on_message(self, ws, message):
        data = json.loads(message)
        print(data)

    def on_error(self, ws, error):
        print("WS error:", error)

    def on_close(self, ws, close_status_code, close_msg):
        print("WS closed")

    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.ws_url,
            header={
                "access-token": self.access_token,
                "client-id": self.client_id
            },
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )

        thread = threading.Thread(target=self.ws.run_forever)
        thread.daemon = True
        thread.start()
```

---

# 11. Example Strategy Engines

---

## 11.1 ORB Engine

```python
class ORBEngine:
    def __init__(self):
        self.orb_high = None
        self.orb_low = None
        self.orb_done = False
        self.traded = False

    def update_range(self, price, current_time):
        # Assume market opens 9:15, ORB ends 9:30
        if current_time.hour == 9 and current_time.minute < 30:
            if self.orb_high is None or price > self.orb_high:
                self.orb_high = price

            if self.orb_low is None or price < self.orb_low:
                self.orb_low = price

        if current_time.hour == 9 and current_time.minute >= 30:
            self.orb_done = True

    def signal(self, price):
        if not self.orb_done or self.traded:
            return None

        if price > self.orb_high:
            self.traded = True
            return "BUY_CALL"

        if price < self.orb_low:
            self.traded = True
            return "BUY_PUT"

        return None
```

---

## 11.2 Iron Condor Selector

```python
def should_trade_iron_condor(iv_rank, trend_score, event_day):
    if event_day:
        return False

    if iv_rank < 55:
        return False

    if abs(trend_score) > 1:
        return False

    return True
```

---

## 11.3 Credit Spread Selector

```python
def should_trade_bull_put_spread(trend_score, iv_rank, pcr):
    if trend_score > 0 and iv_rank > 55 and pcr > 0.8:
        return True
    return False


def should_trade_bear_call_spread(trend_score, iv_rank, pcr):
    if trend_score < 0 and iv_rank > 55 and pcr < 1.2:
        return True
    return False
```

---

# 12. Backtesting Checklist

Before deploying any strategy, test:

---

## 12.1 Data Requirements

You need:

- Spot index historical data
- Futures data
- Option chain historical data
- IV data
- OI data
- Volume data
- Bid/ask if possible
- Corporate/event calendar

---

## 12.2 Costs to Include

Include:

- Brokerage
- STT
- Exchange transaction charges
- GST
- SEBI charges
- Stamp duty
- Slippage
- Impact cost
- Margin cost
- Roll cost

Without costs, many strategies look profitable but fail live.

---

## 12.3 Metrics to Track

Track:

| Metric | Good Target |
|---|---|
| Win rate | Depends on strategy |
| Expectancy per trade | Positive after costs |
| Profit factor | > 1.3 |
| Max drawdown | Acceptable to you |
| Average win / average loss | Stable |
| Recovery factor | > 1 |
| Sharpe ratio | > 1 preferred |
| Sortino ratio | Higher is better |
| Tail risk | Controlled |
| Margin utilization | Not excessive |

---

## 12.4 Walk-Forward Testing

Do not trust one backtest.

Use:

- In-sample period
- Out-of-sample period
- Different market regimes
- Trend year
- Sideways year
- Crash year
- High IV year
- Low IV year

---

# 13. Risk Management Rules

These matter more than strategy selection.

---

## 13.1 Per Trade Risk

For option buying:

- Risk 0.5% to 1% capital per trade initially
- Maximum 2% if experienced

For option selling:

- Risk 0.25% to 1% capital per defined-risk trade
- Never risk unlimited without hedge

---

## 13.2 Daily Loss Limit

Examples:

- Intraday: 2% to 3% daily stop
- Swing: 5% weekly stop
- Portfolio: 10% monthly drawdown stop

If limit hit, stop trading.

---

## 13.3 Max Open Risk

Do not over-concentrate.

Example:

- Max 3 strategies at a time
- Max 1 directional naked exposure
- Max 30% margin utilization for short strategies
- Keep buffer for volatility spikes

---

## 13.4 No Naked Shorts

For index options, avoid:

- Naked short straddle
- Naked short strangle
- Naked short call
- Naked short put

Unless:

- Very small size
- Strict stop-loss
- Real-time monitoring
- Emergency hedge plan

Better:

- Iron condor
- Iron butterfly
- Credit spread

---

## 13.5 Execution Rules

Use:

- Limit orders
- Liquid strikes only
- Near ATM strikes
- Avoid wide bid-ask strikes
- Avoid illiquid weekly strikes
- Avoid market orders in options

---

## 13.6 Event Rules

Before major events:

- Reduce position size
- Avoid naked short
- Avoid buying after IV spike
- Prefer defined-risk structures
- Have manual kill switch

---

# 14. Best Strategy Combinations for Different Trader Types

---

## 14.1 Beginner

Best starting strategies:

1. Bull call spread
2. Bear put spread
3. Bull put spread
4. Bear call spread
5. Iron condor

Avoid:

- Naked short
- OTM option buying
- Expiry scalping
- Hero-zero trades

---

## 14.2 Intraday Momentum Trader

Best strategies:

1. ORB ATM option buying
2. VWAP pullback option buying
3. Bull call spread for trend days
4. Bear put spread for downtrend days
5. Small ATM scalps on expiry

Key:

- Trade only first 2–3 hours
- Avoid sideways days
- Strict stop-loss

---

## 14.3 Income Trader

Best strategies:

1. Iron condor
2. Iron butterfly
3. Bull put spread
4. Bear call spread
5. Jade lizard

Key:

- Sell high IV
- Defined risk
- Small size
- Consistent exits

---

## 14.4 Volatility Trader

Best strategies:

1. Long straddle
2. Long strangle
3. Calendar spread
4. Diagonal spread
5. Backspread
6. Gamma scalping

Key:

- Track IV rank
- Track IV percentile
- Track event calendar
- Understand IV crush

---

## 14.5 Expiry Trader

Best strategies:

1. ATM momentum scalping
2. Small debit spreads
3. Hedged short straddle
4. Iron butterfly
5. Gamma breakout trades

Key:

- Very small size
- Fast exits
- No revenge trading

---

# 15. Practical “What Works” Playbook

If I had to build a robust index options system, I would use:

---

## Playbook A: High-Probability Defined Risk

Use when IV is high and market is range-bound.

### Strategy
Iron condor.

### Example

```text
Spot: 24,800

Sell 24,600 PE
Buy 24,400 PE

Sell 25,000 CE
Buy 25,200 CE
```

### Rules
- Enter when IV rank > 60
- No event nearby
- Trend score near zero
- Exit at 50% max profit
- Exit if range breached
- Stop if loss reaches 2x credit

---

## Playbook B: Directional Bullish

Use when trend is bullish and IV is not too high.

### Strategy
Bull call debit spread.

### Example

```text
Spot: 24,800

Buy 24,800 CE
Sell 25,000 CE
```

### Rules
- Enter above VWAP
- EMA20 > EMA50
- Call OI resistance weakening
- Exit at 50%–100% profit
- Stop at 35%–50% premium loss

---

## Playbook C: Directional Bearish

Use when trend is bearish and IV is not too high.

### Strategy
Bear put debit spread.

### Example

```text
Spot: 24,800

Buy 24,800 PE
Sell 24,600 PE
```

### Rules
- Enter below VWAP
- EMA20 < EMA50
- Put OI support weakening
- Exit at target or trend reversal

---

## Playbook D: High IV Bearish/Neutral

Use when market is near resistance.

### Strategy
Bear call credit spread.

### Example

```text
Spot: 24,800

Sell 24,900 CE
Buy 25,100 CE
```

### Rules
- Resistance above
- Negative reversal candle
- Call OI heavy above
- Exit at 50% profit
- Stop if strike breached

---

## Playbook E: High IV Bullish/Neutral

Use when market is near support.

### Strategy
Bull put credit spread.

### Example

```text
Spot: 24,800

Sell 24,700 PE
Buy 24,500 PE
```

### Rules
- Support below
- Positive reversal candle
- Put OI heavy below
- Exit at 50% profit
- Stop if support breaks

---

## Playbook F: Event Volatility

Use before event when IV is low.

### Strategy
Long straddle or long strangle.

### Example

```text
Buy 24,800 CE
Buy 24,800 PE
```

### Rules
- Enter 1–2 days before event
- IV must be low
- Exit before event or after initial move
- Do not hold through IV crush blindly

---

# 16. DhanHQ Automation Workflow

A full automated system should look like this:

```text
┌────────────────────────────┐
│ DhanHQ WebSocket Feed      │
│ Spot / Futures / Options   │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Feature Engine             │
│ VWAP, EMA, RSI, ATR, OI,   │
│ PCR, IV Rank, Max Pain     │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Regime Detection           │
│ Trend / Range / High IV /  │
│ Low IV / Event             │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Strategy Selector          │
│ Long / Short / Combo       │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Risk Engine                │
│ Size, Margin, Daily Loss   │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Order Execution            │
│ REST Orders / Super Orders │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Position Monitor           │
│ Trail SL, Hedge, Flatten   │
└────────────────────────────┘
```

---

# 17. Important DhanHQ Execution Notes

For multi-leg strategies:

1. **Do not use market orders for illiquid strikes.**
2. **Use limit orders near mid-price.**
3. **Check order status after placement.**
4. **If one leg fails, close the other leg.**
5. **Do not assume hedge margin instantly; verify from margin API.**
6. **Use Super Order for single-leg option buying with SL/target.**
7. **For spreads, manage legs manually or via your own execution engine.**
8. **Maintain reconciliation between broker positions and internal state.**

---

# 18. Strategy Risk Classification

| Strategy | Type | Risk Level | Best For |
|---|---|---|---|
| Long call | Buy | Medium | Strong bullish momentum |
| Long put | Buy | Medium | Strong bearish momentum |
| Bull call spread | Buy + Sell | Low/Medium | Moderate bullish |
| Bear put spread | Buy + Sell | Low/Medium | Moderate bearish |
| Bull put spread | Sell + Buy | Low/Medium | Neutral/bullish |
| Bear call spread | Sell + Buy | Low/Medium | Neutral/bearish |
| Iron condor | Sell + Buy | Medium | Range-bound |
| Iron butterfly | Sell + Buy | Medium | Strong range-bound |
| Short straddle | Sell | High | Experienced, hedged |
| Short strangle | Sell | High | Experienced, hedged |
| Long straddle | Buy | Medium | Event/volatility |
| Long strangle | Buy | Medium | Event/volatility |
| Calendar spread | Buy + Sell | Medium | IV term structure |
| Diagonal spread | Buy + Sell | Medium/High | Advanced |
| Ratio spread | Buy + Sell | High | Advanced |
| Backspread | Buy + Sell | Medium/High | Volatility expansion |
| Gamma scalping | Buy + Hedge | High | Professional |
| Expiry scalping | Buy/Sell | Very High | Scalpers |

---

# 19. My Practical Ranking for “What Works”

Not financial advice, just practical ranking by robustness.

---

## Tier 1 — Most Robust

1. Bull put credit spread
2. Bear call credit spread
3. Iron condor
4. Bull call debit spread
5. Bear put debit spread

Why:

- Defined risk
- Easier automation
- Lower blowup risk
- Works across market regimes if selected properly

---

## Tier 2 — Good With Skill

6. ORB momentum option buying
7. VWAP trend option buying
8. Iron butterfly
9. Calendar spread
10. Event straddle/strangle

Why:

- Requires timing
- Requires volatility understanding
- Can be profitable but less forgiving

---

## Tier 3 — Advanced

11. Diagonal spread
12. Ratio backspread
13. Jade lizard
14. Broken wing butterfly
15. Gamma scalping

Why:

- Complex Greeks
- Execution risk
- Requires active management

---

## Tier 4 — Dangerous for Most Traders

16. Naked short straddle
17. Naked short strangle
18. OTM hero-zero buying
19. Expiry gambling
20. Averaging losing naked shorts

Why:

- Tail risk
- Emotional errors
- Margin pressure
- Large drawdowns

---

# 20. Final Recommendation

If your goal is to build a working index options system using DhanHQ V2:

---

## Start With These 5 Strategies

### 1. Bull Call Spread
For bullish directional trades.

### 2. Bear Put Spread
For bearish directional trades.

### 3. Bull Put Spread
For bullish/neutral high-IV trades.

### 4. Bear Call Spread
For bearish/neutral high-IV trades.

### 5. Iron Condor
For range-bound high-IV trades.

These five cover most market conditions and keep risk defined.

---

## Add Later

Once stable:

- ORB momentum buying
- VWAP trend buying
- Calendar spreads
- Event straddles
- Iron butterflies
- Diagonal spreads

---

## Avoid Initially

- Naked option selling
- OTM expiry buying
- Martingale averaging
- Overtrading
- No-stop-loss positional shorts

---

# 21. Simple Final Strategy Map

| If Market Is... | Use This |
|---|---|
| Strong bullish | Bull call spread or long ATM call with SL |
| Strong bearish | Bear put spread or long ATM put with SL |
| Mild bullish | Bull put spread |
| Mild bearish | Bear call spread |
| Sideways | Iron condor |
| Very sideways near ATM | Iron butterfly |
| Big move expected | Long straddle/strangle |
| Event coming | Long straddle if IV low; credit spreads if IV high |
| Expiry momentum | Small ATM scalps or debit spreads |
| High IV crash fear | Bear put spread, not naked puts |
| Low IV breakout expected | Long call/put or backspread |

---

If you want, I can next give you a **ready-made DhanHQ V2 Python bot framework** with:

1. **Option chain scanner**
2. **PCR + OI + IV rank engine**
3. **ORB + VWAP strategy**
4. **Iron condor auto-selector**
5. **Credit spread executor**
6. **Risk manager + kill switch**

in one complete runnable architecture.

For **option buying**, your calculation is simple:

```text
Required funds = Premium × Quantity
Quantity = Lot size × Number of lots
```

Example:

```text
Nifty CE premium = ₹120
Lot size = 75
Lots = 1

Buying cost = 120 × 75 × 1 = ₹9,000
```

But for **option selling**, the money you receive as premium is **not** the margin requirement.

When you sell an option, you take on obligation/risk, so the exchange/broker blocks **margin** to cover potential adverse moves.

---

# 1. Option Selling Margin = SPAN + Exposure

In Indian F&O, the upfront margin for selling options is generally:

```text
Total Required Margin = SPAN Margin + Exposure Margin
```

This is often called:

- Initial margin
- Upfront margin
- Peak margin
- Required margin
- Block margin

---

## A. SPAN Margin

**SPAN** means Standard Portfolio Analysis of Risk.

It is calculated by the exchange/clearing corporation based on:

- Underlying index level
- Option strike
- Call or put
- Moneyness
- Time to expiry
- Implied volatility
- Portfolio risk
- Scenario shocks
- Open positions and hedges

SPAN is **not a simple formula** like premium × lot size.

It changes with:

- Market movement
- Volatility spikes
- Time decay
- Event risk
- Portfolio offsets

---

## B. Exposure Margin

Exposure margin is an additional margin to cover extreme moves beyond SPAN scenarios.

For index options, exposure margin is commonly around:

```text
Exposure Margin ≈ 3% of underlying contract value
```

But this can vary by exchange and current margin rules, so always verify from the broker/exchange margin calculator.

Example:

```text
Nifty spot = 25,000
Lot size = 75

Contract value = 25,000 × 75 = ₹18,75,000

Exposure margin ≈ 3% × 18,75,000
                = ₹56,250
```

---

# 2. Naked Option Selling Margin Example

Suppose you sell 1 lot Nifty ATM put.

```text
Nifty spot = 25,000
Lot size = 75
Sell 25,000 PE premium = ₹100
```

Premium received:

```text
Premium received = 100 × 75 = ₹7,500
```

But required margin is not ₹7,500.

Approx margin may be:

```text
SPAN margin     = ₹1,00,000   example only
Exposure margin = ₹56,250
--------------------------------
Total margin    = ₹1,56,250
```

So even though you receive only ₹7,500 premium, the broker may block around ₹1.5 lakh or more.

This is why option selling requires much more capital than option buying.

---

# 3. Why Selling Margin Is Much Higher Than Premium

When you buy an option:

```text
Max loss = Premium paid
```

When you sell a naked call:

```text
Theoretical loss = Unlimited
```

When you sell a naked put:

```text
Theoretical loss = Very large, up to strike price minus premium
```

So the exchange requires margin to protect against large adverse moves.

---

# 4. Approx Manual Formula for Naked Index Option Selling

For rough estimation only:

```text
Contract value = Spot price × Lot size

Approx SPAN margin = 8% to 15% of contract value
Approx exposure margin = 3% of contract value

Approx total margin = SPAN + Exposure
```

Example:

```text
Nifty = 25,000
Lot size = 75

Contract value = 25,000 × 75 = ₹18,75,000

Assume SPAN = 10%
SPAN = ₹1,87,500

Exposure = 3%
Exposure = ₹56,250

Total approximate margin = ₹2,43,750
```

But this is only a rough estimate.

Actual SPAN can be lower or higher depending on:

- Strike price
- IV
- Expiry
- Market conditions
- Existing hedges
- Broker buffer

---

# 5. Short Straddle Margin Example

Suppose you sell ATM straddle:

```text
Sell 25,000 CE
Sell 25,000 PE
```

Premium received:

```text
CE premium = ₹120
PE premium = ₹120

Total premium = ₹240 × 75 = ₹18,000
```

But margin required may be much higher.

Approx example:

```text
SPAN margin     = ₹1,30,000
Exposure margin = ₹1,10,000
--------------------------------
Total margin    = ₹2,40,000
```

Actual values depend heavily on volatility and exchange margin rules.

A short straddle is risky because if the market trends strongly, one side can produce large losses.

---

# 6. Short Strangle Margin Example

Suppose you sell OTM strangle:

```text
Sell 25,300 CE
Sell 24,700 PE
```

Because strikes are OTM, SPAN may be lower than ATM straddle, but margin is still large.

Example:

```text
Premium received = ₹10,000
Margin required  = ₹1,50,000 to ₹2,00,000
```

Again, exact margin must be checked from broker calculator.

---

# 7. Hedged Option Selling Margin Is Much Lower

If you hedge the short option with a long option, margin reduces significantly.

This is why practical option sellers use spreads instead of naked selling.

---

## A. Bull Put Spread

Example:

```text
Nifty spot = 25,000

Sell 24,900 PE @ ₹100
Buy  24,700 PE @ ₹40
```

Spread width:

```text
Width = 24,900 - 24,700 = 200 points
```

Net credit:

```text
Net credit = 100 - 40 = 60 points
```

Maximum loss:

```text
Max loss = Width - Net credit
         = 200 - 60
         = 140 points
```

In rupees:

```text
Max loss = 140 × 75 = ₹10,500
```

Approx margin required:

```text
Margin ≈ Max loss + buffer
```

Many brokers/exchanges require something like:

```text
Margin ≈ Max loss + 20% of max loss
```

So:

```text
Margin ≈ 10,500 + 20% × 10,500
       = 10,500 + 2,100
       = ₹12,600
```

This is much lower than naked put selling.

---

## B. Bear Call Spread

Example:

```text
Sell 25,100 CE @ ₹90
Buy  25,300 CE @ ₹30
```

Width:

```text
Width = 25,300 - 25,100 = 200 points
```

Net credit:

```text
Net credit = 90 - 30 = 60 points
```

Max loss:

```text
Max loss = 200 - 60 = 140 points
```

Rupee max loss:

```text
Max loss = 140 × 75 = ₹10,500
```

Approx margin:

```text
Margin ≈ 10,500 × 1.20 = ₹12,600
```

---

## C. Iron Condor

Example:

```text
Sell 24,800 PE @ ₹80
Buy  24,600 PE @ ₹30

Sell 25,200 CE @ ₹80
Buy  25,400 CE @ ₹30
```

Put spread width:

```text
24,800 - 24,600 = 200
```

Call spread width:

```text
25,400 - 25,200 = 200
```

Net credit:

```text
Net credit = 80 + 80 - 30 - 30
           = 100 points
```

Max loss:

```text
Max loss = Width - Net credit
         = 200 - 100
         = 100 points
```

Rupee max loss:

```text
Max loss = 100 × 75 = ₹7,500
```

Approx margin:

```text
Margin ≈ 7,500 × 1.20 = ₹9,000
```

So instead of blocking ₹1.5 lakh or more for naked selling, a hedged iron condor may require roughly ₹9,000 to ₹12,000 per lot, depending on broker/exchange rules.

---

# 8. General Formula for Defined-Risk Credit Spreads

For vertical credit spreads:

```text
Width = Difference between strikes
Net credit = Premium received - Premium paid
Max loss points = Width - Net credit
Max loss amount = Max loss points × Lot size × Lots
```

Approx margin:

```text
Approx margin = Max loss amount × 1.20
```

The 20% buffer is a common practical approximation, but the exact requirement depends on the broker/exchange.

---

## Bull Put Spread Formula

```text
Sell higher strike PE
Buy lower strike PE

Width = Higher strike - Lower strike
Net credit = Sell PE premium - Buy PE premium
Max loss = Width - Net credit
```

---

## Bear Call Spread Formula

```text
Sell lower strike CE
Buy higher strike CE

Width = Higher strike - Lower strike
Net credit = Sell CE premium - Buy CE premium
Max loss = Width - Net credit
```

---

## Iron Condor Formula

If both wings have the same width:

```text
Width = Strike difference on either side
Net credit = Total premium received - Total premium paid
Max loss = Width - Net credit
```

If wings have different widths:

```text
Max loss = Max(Call spread width, Put spread width) - Net credit
```

Then:

```text
Max loss amount = Max loss points × Lot size × Lots
```

---

# 9. Iron Butterfly Margin Example

Example:

```text
Sell 25,000 CE @ ₹150
Sell 25,000 PE @ ₹150

Buy 25,200 CE @ ₹70
Buy 24,800 PE @ ₹70
```

Net credit:

```text
Net credit = 150 + 150 - 70 - 70
           = 160 points
```

Wing width:

```text
Width = 200 points
```

Max loss:

```text
Max loss = Width - Net credit
         = 200 - 160
         = 40 points
```

Rupee max loss:

```text
Max loss = 40 × 75 = ₹3,000
```

Approx margin:

```text
Margin ≈ 3,000 × 1.20 = ₹3,600
```

If net credit is greater than wing width, theoretical max loss can become zero or negative, but brokers may still require some margin due to execution, settlement, and risk rules.

---

# 10. Important: Hedge Margin Benefit May Require Recognized Spread

If you place legs separately:

```text
Sell PE first
Buy PE later
```

The broker may initially block full naked margin for the short leg.

After the long hedge leg is executed, the system may recognize the spread and reduce margin.

But this depends on:

- Broker system
- Exchange recognition
- Product type
- Same underlying
- Same expiry
- Correct strike relationship
- Margin calculation method

So for automation, do not assume reduced margin unless:

1. Broker supports pre-trade spread margin, or
2. You verify margin after both legs are executed, or
3. You use a strategy/basket order that supports hedge margin benefit.

For safety, your bot should have enough margin to handle the worst leg until the hedge is placed.

---

# 11. How to Get Actual Margin Using DhanHQ V2

The correct way is to use DhanHQ’s margin calculator API.

Do not rely only on manual formulas for live trading.

---

## DhanHQ Margin Calculator Concept

You send:

- Client ID
- Exchange segment
- Security ID
- Buy/Sell
- Quantity
- Price
- Product type

Dhan returns:

- Required margin
- SPAN margin
- Exposure margin
- Available balance
- Utilized margin

Field names may vary, so check the latest DhanHQ V2 documentation.

---

## Example REST-style Payload

```json
{
  "dhanClientId": "YOUR_CLIENT_ID",
  "exchangeSegment": "IDX_I",
  "securityId": "OPTION_SECURITY_ID",
  "transactionType": "SELL",
  "quantity": 75,
  "price": 100,
  "productType": "MARGIN"
}
```

Example endpoint concept:

```text
POST https://api.dhan.co/v2/margincalculator
```

Headers:

```text
access-token: YOUR_ACCESS_TOKEN
client-id: YOUR_CLIENT_ID
Content-Type: application/json
```

---

## Example Python Using Requests

```python
import requests

client_id = "YOUR_CLIENT_ID"
access_token = "YOUR_ACCESS_TOKEN"

url = "https://api.dhan.co/v2/margincalculator"

headers = {
    "access-token": access_token,
    "client-id": client_id,
    "Content-Type": "application/json"
}

payload = {
    "dhanClientId": client_id,
    "exchangeSegment": "IDX_I",
    "securityId": "OPTION_SECURITY_ID",
    "transactionType": "SELL",
    "quantity": 75,
    "price": 100,
    "productType": "MARGIN"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

Illustrative response:

```json
{
  "data": {
    "totalMargin": 156250,
    "spanMargin": 100000,
    "exposureMargin": 56250,
    "availableBalance": 500000
  }
}
```

Use `totalMargin` as the required margin for that order.

---

## Example Using DhanHQ Python SDK

If the SDK version exposes a margin calculator method, it may look like this:

```python
from dhanhq import dhanhq

client_id = "YOUR_CLIENT_ID"
access_token = "YOUR_ACCESS_TOKEN"

dhan = dhanhq(client_id, access_token)

payload = {
    "dhanClientId": client_id,
    "exchangeSegment": "IDX_I",
    "securityId": "OPTION_SECURITY_ID",
    "transactionType": "SELL",
    "quantity": 75,
    "price": 100,
    "productType": "MARGIN"
}

margin_response = dhan.margin_calculator(payload)
print(margin_response)
```

If the SDK method name differs in your installed version, use the raw REST endpoint from DhanHQ V2 docs.

---

# 12. Margin Check Before Selling Option

Example:

```python
def get_required_margin(dhan, security_id, qty, price):
    payload = {
        "dhanClientId": client_id,
        "exchangeSegment": "IDX_I",
        "securityId": security_id,
        "transactionType": "SELL",
        "quantity": qty,
        "price": price,
        "productType": "MARGIN"
    }

    response = dhan.margin_calculator(payload)

    # Adjust key names based on actual Dhan response
    data = response.get("data", {})

    total_margin = data.get("totalMargin", 0)
    available_balance = data.get("availableBalance", 0)

    return total_margin, available_balance


def can_sell_option(dhan, security_id, qty, price, buffer_pct=0.20):
    required_margin, available_balance = get_required_margin(
        dhan, security_id, qty, price
    )

    safe_required = required_margin * (1 + buffer_pct)

    print("Required margin:", required_margin)
    print("Safe required margin:", safe_required)
    print("Available balance:", available_balance)

    if available_balance >= safe_required:
        return True

    return False
```

Usage:

```python
if can_sell_option(
    dhan=dhan,
    security_id="OPTION_SECURITY_ID",
    qty=75,
    price=100,
    buffer_pct=0.20
):
    print("Margin sufficient. Can place sell order.")
else:
    print("Margin insufficient. Do not trade.")
```

---

# 13. Approx Margin Calculator for Credit Spreads

For defined-risk spreads, you can estimate margin before placing the trade.

```python
def credit_spread_margin(
    width_points,
    net_credit_points,
    lot_size,
    lots=1,
    buffer_pct=0.20
):
    max_loss_points = width_points - net_credit_points

    if max_loss_points < 0:
        max_loss_points = 0

    max_loss_amount = max_loss_points * lot_size * lots
    estimated_margin = max_loss_amount * (1 + buffer_pct)

    return {
        "max_loss_points": max_loss_points,
        "max_loss_amount": max_loss_amount,
        "estimated_margin": estimated_margin
    }
```

Example:

```python
result = credit_spread_margin(
    width_points=200,
    net_credit_points=60,
    lot_size=75,
    lots=1,
    buffer_pct=0.20
)

print(result)
```

Output:

```text
{
  "max_loss_points": 140,
  "max_loss_amount": 10500,
  "estimated_margin": 12600.0
}
```

This is an estimate. Use broker margin calculator for final confirmation.

---

# 14. Approx Naked Index Option Margin Estimator

For rough planning only:

```python
def approx_naked_index_option_margin(
    spot_price,
    lot_size,
    lots=1,
    span_pct=0.10,
    exposure_pct=0.03
):
    contract_value = spot_price * lot_size * lots

    span_margin = contract_value * span_pct
    exposure_margin = contract_value * exposure_pct

    total_margin = span_margin + exposure_margin

    return {
        "contract_value": contract_value,
        "span_margin": span_margin,
        "exposure_margin": exposure_margin,
        "total_margin": total_margin
    }
```

Example:

```python
result = approx_naked_index_option_margin(
    spot_price=25000,
    lot_size=75,
    lots=1,
    span_pct=0.10,
    exposure_pct=0.03
)

print(result)
```

Output:

```text
{
  "contract_value": 1875000,
  "span_margin": 187500.0,
  "exposure_margin": 56250.0,
  "total_margin": 243750.0
}
```

Again, this is approximate. Actual SPAN comes from exchange risk calculation.

---

# 15. Margin Comparison Table

Assume:

```text
Nifty spot = 25,000
Lot size = 75
```

| Strategy | Premium Received | Approx Risk | Approx Margin Behavior |
|---|---:|---:|---|
| Buy ATM option | Paid ₹10,000 | ₹10,000 | Pay premium only |
| Naked short ATM option | Receive ₹10,000 | Very high | SPAN + exposure, often ₹1.5L+ |
| Short straddle | Receive ₹18,000 | Very high | SPAN + exposure, high |
| Short strangle | Receive ₹10,000 | High | SPAN + exposure, high |
| Bull put spread | Receive ₹6,000 | ₹10,500 | Around max loss + buffer |
| Bear call spread | Receive ₹6,000 | ₹10,500 | Around max loss + buffer |
| Iron condor | Receive ₹7,500 | ₹7,500 | Around max loss + buffer |
| Iron butterfly | Receive ₹12,000 | ₹3,000 | Around max loss + buffer |

Numbers are examples only.

---

# 16. Why You Should Not Use Premium as Margin for Selling

Many beginners think:

```text
I sold option and received ₹10,000 premium, so I only need ₹10,000.
```

This is wrong.

Premium received is your **maximum possible profit** in many short option trades, but your risk can be much larger.

Example:

```text
Sell Nifty 25,000 CE @ ₹100
Lot size = 75

Premium received = ₹7,500
```

If Nifty moves to 25,500:

```text
Option intrinsic value = 500
Loss per unit = 500 - 100 = 400
Loss = 400 × 75 = ₹30,000
```

If Nifty moves to 26,000:

```text
Option intrinsic value = 1,000
Loss per unit = 1,000 - 100 = 900
Loss = 900 × 75 = ₹67,500
```

So the exchange requires margin much larger than premium.

---

# 17. Margin Changes During the Day

Required margin is not fixed.

It can increase due to:

- Market moving against you
- Volatility increasing
- Event risk
- Broker increasing margin
- Exchange margin revision
- Low liquidity
- Near expiry gamma risk
- Large directional moves

Example:

You sell a put in the morning.

```text
Morning margin required = ₹1,40,000
```

Market falls sharply.

```text
Afternoon margin required = ₹1,90,000
```

If your available balance is low, the broker may:

- Ask for additional margin
- Auto square-off positions
- Restrict new orders
- Apply penalty/margin shortfall charges

So always keep buffer margin.

---

# 18. Practical Buffer Rule

Do not use 100% of available margin.

For option selling, keep buffer:

```text
Safe usable margin = 70% to 80% of available margin
```

Example:

```text
Available margin = ₹2,00,000
Use only 75% = ₹1,50,000
Keep ₹50,000 buffer
```

This protects you from:

- Margin spikes
- Slippage
- Volatility shocks
- Intraday drawdowns
- Broker margin changes

---

# 19. How to Calculate Margin for Multi-Leg Strategies in Bot

For a bot, use this workflow.

---

## Step 1: Get LTP or Limit Price

For each leg, get current price.

```python
legs = [
    {"securityId": "SEC_ID_1", "side": "SELL", "price": 100},
    {"securityId": "SEC_ID_2", "side": "BUY", "price": 40},
]
```

---

## Step 2: Check Margin for Each Leg Individually

This gives conservative margin.

```python
total_conservative_margin = 0

for leg in legs:
    required, available = get_required_margin(
        dhan,
        leg["securityId"],
        qty=75,
        price=leg["price"]
    )

    if leg["side"] == "SELL":
        total_conservative_margin += required
```

This is safe but may ignore hedge benefit.

---

## Step 3: Estimate Defined-Risk Margin

For spreads, calculate max loss.

```python
width = 200
net_credit = 60
lot_size = 75

estimated = credit_spread_margin(
    width_points=width,
    net_credit_points=net_credit,
    lot_size=lot_size,
    lots=1,
    buffer_pct=0.20
)

print(estimated["estimated_margin"])
```

---

## Step 4: Use Broker Strategy Margin if Available

If Dhan provides strategy/basket margin, use that.

Otherwise, be conservative:

```text
Use max(individual leg margin, estimated spread margin)
```

or simply require enough margin for the short leg before placing the hedge.

---

## Step 5: Place Orders and Verify Positions

After execution:

- Check order status
- Check positions
- Check utilized margin
- Confirm hedge is recognized
- If margin is unexpectedly high, flatten or adjust

---

# 20. Example: Safe Margin Check for Bull Put Spread

Suppose:

```text
Sell 24,900 PE @ ₹100
Buy  24,700 PE @ ₹40
Lot size = 75
```

Calculate max loss:

```text
Width = 200
Net credit = 60
Max loss = 140 points
Max loss amount = 140 × 75 = ₹10,500
```

Add buffer:

```text
Estimated margin = 10,500 × 1.20 = ₹12,600
```

But before placing the short leg, the broker may temporarily require naked margin.

So safer approach:

```text
Available margin should be enough for short leg naked margin
or
use broker-supported spread order/margin calculator
```

If you only have ₹15,000 available, the spread may eventually require only ₹12,600, but the short leg may initially be rejected because naked margin could be ₹1.5 lakh.

This is very important for automation.

---

# 21. Summary Formulas

---

## Option Buying

```text
Required amount = Premium × Lot size × Lots
```

---

## Naked Option Selling

```text
Required margin = SPAN margin + Exposure margin
```

Approx:

```text
Contract value = Spot × Lot size × Lots

SPAN ≈ 8% to 15% of contract value
Exposure ≈ around 3% of contract value

Total ≈ SPAN + Exposure
```

But actual SPAN must come from exchange/broker.

---

## Credit Spread / Defined-Risk Selling

```text
Width = Strike difference
Net credit = Premium received - Premium paid
Max loss points = Width - Net credit
Max loss amount = Max loss points × Lot size × Lots

Approx margin = Max loss amount × 1.20
```

---

## Iron Condor / Iron Butterfly

```text
Max loss = Max side loss - Net credit
Approx margin = Max loss amount × 1.20
```

Final margin should be verified from broker.

---

# 22. Best Practical Answer

For option selling, do not calculate final margin manually.

Use this logic:

```text
1. For naked short options:
   Required margin = SPAN + Exposure
   Get exact value from DhanHQ margin calculator API.

2. For hedged spreads:
   Approx margin = Max loss + buffer
   But confirm using broker margin calculator or after positions are recognized.

3. Always keep extra buffer because margin changes intraday.
```

---

# 23. Recommended Rule for Your Bot

For safety:

```python
def selling_margin_rule(required_margin, available_margin):
    # Use only 75% of available margin
    usable_margin = available_margin * 0.75

    if required_margin <= usable_margin:
        return True
    return False
```

Example:

```text
Available margin = ₹2,00,000
Usable margin = ₹1,50,000

If required margin = ₹1,20,000 → allowed
If required margin = ₹1,60,000 → not allowed
```

---

# 24. Final Simple Example

## Buying

```text
Buy 1 lot Nifty CE
Premium = ₹100
Lot size = 75

Cost = 100 × 75 = ₹7,500
```

## Naked Selling

```text
Sell 1 lot Nifty PE
Premium received = ₹100
Lot size = 75

Premium received = ₹7,500
But required margin may be ₹1,50,000+
```

## Hedged Selling

```text
Sell 1 lot Nifty PE @ ₹100
Buy 1 lot lower PE @ ₹40

Width = 200
Net credit = 60
Max loss = 140 points
Max loss amount = 140 × 75 = ₹10,500

Approx margin = ₹12,600
```

So:

```text
Option buying = pay premium
Option selling = block risk margin
Hedged selling = block approximately max loss plus buffer
Exact margin = use DhanHQ margin calculator API
```

Yes — **in the normal DhanHQ REST trading API, one `place_order` request usually places one order for one security only.**

So if you want to do a hedged option selling strategy like:

```text
Bull Put Spread:
Sell 24,900 PE
Buy  24,700 PE
```

you normally have to send **two separate orders**:

```text
Order 1: BUY  24,700 PE
Order 2: SELL 24,900 PE
```

There is no automatic “place both legs together as one spread” unless DhanHQ provides a specific **basket / strategy / multi-leg order endpoint** in your API version.

So the practical answer is:

> **Yes, standard REST order placement is usually one order at a time.
> Hedged selling is done by orchestrating multiple orders from your code, or by using a basket/strategy API if Dhan supports it.**

---

# 1. The Main Problem: Margin + Legging Risk

When you hedge by placing separate orders, you face two problems:

---

## Problem A: Margin Requirement

If you place the **short leg first**, Dhan may check margin as if you are doing a **naked short option**.

Example:

```text
Sell 24,900 PE first
```

Broker may require:

```text
SPAN + Exposure = ₹1,50,000+ per lot
```

Even though your final strategy is a bull put spread with max loss maybe only ₹10,000.

So if you do not have enough margin for naked selling, the short leg may get rejected.

---

## Problem B: Legging Risk

If you place one leg and the second leg does not fill, you may be left with an unintended position.

Example:

```text
Buy 24,700 PE filled
Sell 24,900 PE not filled
```

Now you are left with a naked long put.

Risk is limited to premium paid, but it is not the intended hedge.

Example:

```text
Sell 24,900 PE filled
Buy 24,700 PE not filled
```

Now you are left with a naked short put.

This is dangerous.

So the execution order matters.

---

# 2. Best Practical Approach: Buy Hedge First, Then Sell

For defined-risk credit spreads, the safer approach is often:

```text
1. Buy the long hedge leg first
2. Then sell the short leg
```

Why?

Because if the second leg fails, you are left with a **long option**, whose loss is limited to premium paid.

If you sell first and the hedge fails, you may be left with a **naked short option**, which can have large risk.

---

## Example: Bull Put Spread

Desired strategy:

```text
Sell 24,900 PE @ ₹100
Buy  24,700 PE @ ₹40
```

Net credit:

```text
100 - 40 = ₹60
```

Max loss:

```text
Spread width = 200
Max loss = 200 - 60 = 140 points
```

If lot size is 75:

```text
Max loss = 140 × 75 = ₹10,500
```

### Safer Execution

```text
Step 1: BUY 24,700 PE @ ₹40 limit
Step 2: Confirm fill
Step 3: SELL 24,900 PE @ ₹100 limit
Step 4: Confirm fill
```

If step 3 fails:

```text
Cancel pending sell order
Sell/close the 24,700 PE
```

This avoids naked short risk.

---

# 3. Example Execution Flow for Bull Put Spread

```text
Check margin / funds
        ↓
Place BUY long put leg
        ↓
Wait for fill
        ↓
If not filled → cancel and stop
        ↓
Place SELL short put leg
        ↓
Wait for fill
        ↓
If not filled → cancel sell order and close long put
        ↓
Both legs filled → spread complete
```

---

# 4. Python Example Using DhanHQ REST

Below is a practical skeleton.

Method names may vary slightly depending on your DhanHQ SDK version, but the logic is the important part.

---

## Basic Dhan Client

```python
from dhanhq import dhanhq

client_id = "YOUR_CLIENT_ID"
access_token = "YOUR_ACCESS_TOKEN"

dhan = dhanhq(client_id, access_token)
```

---

## Place Limit Order Helper

```python
def place_limit_order(
    dhan,
    security_id,
    transaction_type,
    quantity,
    price,
    product_type="MARGIN"
):
    payload = {
        "dhanClientId": client_id,
        "exchangeSegment": "IDX_I",
        "securityId": security_id,
        "transactionType": transaction_type,
        "productType": product_type,
        "orderType": "LIMIT",
        "quantity": quantity,
        "price": price,
        "validity": "DAY"
    }

    response = dhan.place_order(payload)
    return response
```

Example:

```python
buy_order = place_limit_order(
    dhan=dhan,
    security_id="LONG_PUT_SECURITY_ID",
    transaction_type="BUY",
    quantity=75,
    price=40
)

print(buy_order)
```

---

## Check Order Status Helper

You need to confirm whether the order is filled.

```python
def get_order_status(dhan, order_id):
    # Method name may vary by SDK version
    response = dhan.fetch_order_status(order_id)
    return response
```

Example response concept:

```json
{
  "data": {
    "orderId": "123456",
    "orderStatus": "FILLED",
    "tradedQuantity": 75,
    "averageTradedPrice": 40
  }
}
```

You need to adapt to the actual DhanHQ V2 response format.

---

## Wait Until Order Fills

```python
import time

def wait_for_fill(dhan, order_id, timeout_seconds=15, poll_interval=0.5):
    start_time = time.time()

    while time.time() - start_time < timeout_seconds:
        response = get_order_status(dhan, order_id)

        data = response.get("data", {})
        status = data.get("orderStatus")

        print(f"Order {order_id} status: {status}")

        if status == "FILLED":
            return True

        if status in ["CANCELLED", "REJECTED"]:
            return False

        time.sleep(poll_interval)

    return False
```

---

## Cancel Order Helper

```python
def cancel_order(dhan, order_id):
    response = dhan.cancel_order(order_id)
    return response
```

---

## Close Long Leg Helper

If you bought the hedge leg and the short leg failed, you need to close the long leg.

```python
def close_long_leg(dhan, security_id, quantity, price):
    response = place_limit_order(
        dhan=dhan,
        security_id=security_id,
        transaction_type="SELL",
        quantity=quantity,
        price=price
    )
    return response
```

---

# 5. Full Bull Put Spread Execution Example

```python
def execute_bull_put_spread(
    dhan,
    long_put_security_id,
    short_put_security_id,
    quantity,
    long_put_limit_price,
    short_put_limit_price,
    min_net_credit=50
):
    print("Starting bull put spread execution...")

    # Optional safety check
    expected_net_credit = short_put_limit_price - long_put_limit_price

    if expected_net_credit < min_net_credit:
        print("Net credit too low. Aborting.")
        return False

    # --------------------------------------------------
    # STEP 1: BUY long put hedge first
    # --------------------------------------------------
    long_order = place_limit_order(
        dhan=dhan,
        security_id=long_put_security_id,
        transaction_type="BUY",
        quantity=quantity,
        price=long_put_limit_price
    )

    print("Long leg order:", long_order)

    long_order_id = long_order.get("data", {}).get("orderId")

    if not long_order_id:
        print("Long leg order failed.")
        return False

    long_filled = wait_for_fill(dhan, long_order_id, timeout_seconds=15)

    if not long_filled:
        print("Long leg not filled. Cancelling long leg.")
        cancel_order(dhan, long_order_id)
        return False

    print("Long hedge leg filled.")

    # --------------------------------------------------
    # STEP 2: SELL short put leg
    # --------------------------------------------------
    short_order = place_limit_order(
        dhan=dhan,
        security_id=short_put_security_id,
        transaction_type="SELL",
        quantity=quantity,
        price=short_put_limit_price
    )

    print("Short leg order:", short_order)

    short_order_id = short_order.get("data", {}).get("orderId")

    if not short_order_id:
        print("Short leg order failed. Closing long leg.")

        close_long_leg(
            dhan=dhan,
            security_id=long_put_security_id,
            quantity=quantity,
            price=long_put_limit_price
        )

        return False

    short_filled = wait_for_fill(dhan, short_order_id, timeout_seconds=15)

    if not short_filled:
        print("Short leg not filled. Cancelling short leg and closing long leg.")

        cancel_order(dhan, short_order_id)

        close_long_leg(
            dhan=dhan,
            security_id=long_put_security_id,
            quantity=quantity,
            price=long_put_limit_price
        )

        return False

    print("Both legs filled. Bull put spread executed.")
    return True
```

Usage:

```python
execute_bull_put_spread(
    dhan=dhan,
    long_put_security_id="LONG_24700_PE_SEC_ID",
    short_put_security_id="SHORT_24900_PE_SEC_ID",
    quantity=75,
    long_put_limit_price=40,
    short_put_limit_price=100,
    min_net_credit=50
)
```

---

# 6. Bear Call Spread Execution

Same logic.

Desired strategy:

```text
Sell 25,100 CE
Buy  25,300 CE
```

Safer execution:

```text
1. BUY 25,300 CE first
2. SELL 25,100 CE second
```

If short leg fails:

```text
Cancel short leg
Sell/close long call
```

---

# 7. Iron Condor Execution

Iron condor has four legs:

```text
Sell put
Buy lower put

Sell call
Buy higher call
```

Example:

```text
Sell 24,800 PE
Buy  24,600 PE

Sell 25,200 CE
Buy  25,400 CE
```

You can execute it as two spreads:

---

## Put Spread

```text
Buy  24,600 PE
Sell 24,800 PE
```

---

## Call Spread

```text
Buy  25,400 CE
Sell 25,200 CE
```

---

## Safer Order Sequence

```text
1. Buy 24,600 PE
2. Sell 24,800 PE
3. Buy 25,400 CE
4. Sell 25,200 CE
```

Or:

```text
1. Buy both long wings
2. Sell both short strikes
```

But if you buy both wings first and short legs fail, you are left with a long strangle.

That is limited-risk, but not intended.

So for automation, it is often better to execute one complete spread at a time:

```text
Execute put spread
If successful, execute call spread
If call spread fails, decide whether to keep put spread or flatten everything
```

---

# 8. Can We Place Both Orders Simultaneously?

You can send two REST requests almost at the same time using threading or async.

Example:

```python
from concurrent.futures import ThreadPoolExecutor

def place_both_legs():
    with ThreadPoolExecutor(max_workers=2) as executor:

        future_long = executor.submit(
            place_limit_order,
            dhan,
            long_security_id,
            "BUY",
            75,
            40
        )

        future_short = executor.submit(
            place_limit_order,
            dhan,
            short_security_id,
            "SELL",
            75,
            100
        )

        long_response = future_long.result()
        short_response = future_short.result()

        print(long_response)
        print(short_response)
```

But important:

> **Concurrent placement is not atomic.**

It does not guarantee:

```text
Either both fill
or neither fills
```

You may get:

```text
Long filled, short rejected
Short filled, long rejected
Both rejected
Both filled
Partial fills
```

So you still need a leg-risk manager.

---

# 9. Does DhanHQ Have Basket Order?

You need to check the exact DhanHQ V2 documentation for your version.

Some brokers provide:

- Basket order API
- Strategy order API
- Multi-leg order API
- Spread order API
- Option strategy margin API

If DhanHQ provides a basket or multi-leg strategy endpoint, use that.

That is the best method because it may provide:

- Better leg handling
- Better margin calculation
- Possibly atomic or semi-atomic execution
- Reduced legging risk

But if DhanHQ only exposes normal `place_order`, then yes:

```text
One order per REST request.
```

And your bot must manage the legs.

---

# 10. Super Order Is Not Enough for Multi-Leg Hedging

DhanHQ has a **Super Order API** for things like:

```text
Entry + Target + Stop-loss
```

But that is generally for a **single instrument**.

It is useful for:

```text
Buy Nifty CE
Target = +30%
Stop-loss = -30%
```

But it is not the same as:

```text
Sell one option
Buy another option
Create a spread
```

So for hedged option selling, you usually need:

- Multiple normal orders, or
- Basket/strategy API if available

---

# 11. Margin Handling When Using Separate Orders

This is the most important part.

---

## Case 1: Sell First, Buy Hedge Later

```text
SELL short option first
BUY hedge later
```

Problem:

Broker may require naked short margin for the first order.

Example:

```text
Sell Nifty PE
Required margin = ₹1,50,000
```

Even though final spread max loss is ₹10,000.

So this approach may fail if you do not have large margin.

It also creates dangerous legging risk:

```text
Short filled
Hedge not filled
```

Now you have naked short exposure.

Not recommended unless you have enough margin and strong execution logic.

---

## Case 2: Buy Hedge First, Sell Later

```text
BUY hedge first
SELL short option later
```

Advantages:

- If short leg fails, you only own a long option
- Loss is limited to premium paid
- Safer from catastrophic legging risk

Disadvantages:

- You need money to buy the hedge first
- Market may move before you sell the short leg
- Short leg may not fill at desired price
- Broker may or may not give reduced margin immediately

This is usually safer for retail bots.

---

## Case 3: Use Existing Position for Hedge Margin

After you buy the long hedge leg, your account has a long option position.

Then when you place the short leg, the broker may recognize the hedge and require lower margin.

Example:

```text
Buy 24,700 PE
Now position: Long 24,700 PE

Then sell 24,900 PE
Broker may treat this as bull put spread
Required margin may become near max loss + buffer
```

But you must verify this with DhanHQ.

Some brokers:

- Automatically give hedge margin benefit
- Require positions to be in same account/segment/expiry
- Require manual conversion to hedge/strategy
- Give benefit only after end-of-day
- Give partial benefit intraday
- Require margin calculator check

Do not assume. Test with small quantity or paper trading.

---

# 12. How to Check Margin Before Placing Hedge Orders

Use DhanHQ margin calculator before trading.

For single leg:

```python
def check_margin(dhan, security_id, transaction_type, quantity, price):
    payload = {
        "dhanClientId": client_id,
        "exchangeSegment": "IDX_I",
        "securityId": security_id,
        "transactionType": transaction_type,
        "quantity": quantity,
        "price": price,
        "productType": "MARGIN"
    }

    response = dhan.margin_calculator(payload)
    return response
```

Example:

```python
margin_response = check_margin(
    dhan=dhan,
    security_id="SHORT_PUT_SECURITY_ID",
    transaction_type="SELL",
    quantity=75,
    price=100
)

print(margin_response)
```

But for hedged strategies, the margin calculator may only show single-leg margin unless it supports strategy margin.

So practical workflow:

```text
1. Check margin for long leg buy
2. Place long leg
3. Confirm long leg filled
4. Check margin for short leg after long position exists
5. If margin sufficient, place short leg
6. If not sufficient, close long leg
```

---

# 13. Example Margin-Safe Execution Logic

```python
def execute_credit_spread_safe(
    dhan,
    long_security_id,
    short_security_id,
    quantity,
    long_limit_price,
    short_limit_price,
    available_margin_required_for_short
):
    # Step 1: Buy long hedge
    long_order = place_limit_order(
        dhan=dhan,
        security_id=long_security_id,
        transaction_type="BUY",
        quantity=quantity,
        price=long_limit_price
    )

    long_order_id = long_order.get("data", {}).get("orderId")

    if not long_order_id:
        print("Long order placement failed.")
        return False

    if not wait_for_fill(dhan, long_order_id):
        cancel_order(dhan, long_order_id)
        print("Long order not filled. Aborting.")
        return False

    # Step 2: Check margin for short leg after long position exists
    margin_response = check_margin(
        dhan=dhan,
        security_id=short_security_id,
        transaction_type="SELL",
        quantity=quantity,
        price=short_limit_price
    )

    print("Margin response after long hedge:", margin_response)

    required_margin = margin_response.get("data", {}).get("totalMargin", 0)
    available_balance = margin_response.get("data", {}).get("availableBalance", 0)

    if required_margin > available_balance * 0.80:
        print("Not enough margin for short leg. Closing long leg.")

        close_long_leg(
            dhan=dhan,
            security_id=long_security_id,
            quantity=quantity,
            price=long_limit_price
        )

        return False

    # Step 3: Place short leg
    short_order = place_limit_order(
        dhan=dhan,
        security_id=short_security_id,
        transaction_type="SELL",
        quantity=quantity,
        price=short_limit_price
    )

    short_order_id = short_order.get("data", {}).get("orderId")

    if not short_order_id:
        print("Short order failed. Closing long leg.")

        close_long_leg(
            dhan=dhan,
            security_id=long_security_id,
            quantity=quantity,
            price=long_limit_price
        )

        return False

    if not wait_for_fill(dhan, short_order_id):
        print("Short order not filled. Cancelling and closing long leg.")

        cancel_order(dhan, short_order_id)

        close_long_leg(
            dhan=dhan,
            security_id=long_security_id,
            quantity=quantity,
            price=long_limit_price
        )

        return False

    print("Credit spread executed successfully.")
    return True
```

---

# 14. What If You Do Not Have Enough Margin Even for Buy-First?

Then you should reduce trade size or avoid the trade.

Example:

```text
Available margin = ₹20,000
Long put premium cost = ₹3,000
Short leg spread margin after hedge = ₹12,000
Buffer = ₹5,000

Total needed = ₹20,000
```

This may be okay.

But if:

```text
Available margin = ₹10,000
Long put premium cost = ₹3,000
Short leg margin = ₹12,000
```

Then you cannot safely execute.

Do not try to sell naked just because the final strategy is hedged.

If the hedge leg fails, you can be exposed.

---

# 15. Recommended Execution Rules for Hedged Selling

Use these rules in your bot:

---

## Rule 1: Prefer Buy-First for Credit Spreads

For bull put spread:

```text
Buy lower put first
Sell higher put second
```

For bear call spread:

```text
Buy higher call first
Sell lower call second
```

---

## Rule 2: Use Limit Orders Only

Do not use market orders for options.

Option spreads can have wide bid-ask spreads.

Use:

```text
orderType = LIMIT
```

---

## Rule 3: Define Minimum Net Credit

Example:

```text
Expected net credit = short premium - long premium
Minimum acceptable net credit = 40 points
```

If net credit falls below minimum, abort.

```python
if short_price - long_price < min_net_credit:
    abort_trade()
```

---

## Rule 4: Use Short Timeouts

Do not leave pending legs open too long.

Example:

```text
Timeout = 5 to 15 seconds
```

If not filled:

```text
Cancel pending leg
Flatten filled leg
```

---

## Rule 5: Never Leave Naked Short Exposure

If short leg filled and hedge leg failed:

```text
Immediately place hedge order or flatten short leg
```

This is critical.

---

## Rule 6: Keep Buffer Margin

Do not use 100% available margin.

Use:

```text
Usable margin = 70% to 80% of available margin
```

Because margin can change due to:

- Volatility
- Market movement
- Broker margin revision
- Slippage
- Partial fills

---

## Rule 7: Reconcile Positions

After execution, check positions API:

```python
positions = dhan.fetch_positions()
print(positions)
```

Confirm that both legs exist with correct quantity.

Example expected positions:

```text
LONG  24,700 PE  qty 75
SHORT 24,900 PE  qty 75
```

If quantity mismatch:

```text
Flatten incorrect exposure
```

---

# 16. State Machine for Multi-Leg Execution

For production bots, maintain state.

Example:

```text
INIT
LONG_LEG_SUBMITTED
LONG_LEG_FILLED
LONG_LEG_FAILED
SHORT_LEG_SUBMITTED
SHORT_LEG_FILLED
SHORT_LEG_FAILED
SPREAD_COMPLETE
FLATTENING
FLATTENED
ERROR
```

Example flow:

```text
INIT
  ↓
LONG_LEG_SUBMITTED
  ↓
LONG_LEG_FILLED
  ↓
SHORT_LEG_SUBMITTED
  ↓
SHORT_LEG_FILLED
  ↓
SPREAD_COMPLETE
```

If failure:

```text
SHORT_LEG_FAILED
  ↓
FLATTENING
  ↓
FLATTENED
```

This prevents your bot from getting confused if API responses are delayed.

---

# 17. Example State Machine Logic

```python
class SpreadExecutionState:
    INIT = "INIT"
    LONG_SUBMITTED = "LONG_SUBMITTED"
    LONG_FILLED = "LONG_FILLED"
    LONG_FAILED = "LONG_FAILED"
    SHORT_SUBMITTED = "SHORT_SUBMITTED"
    SHORT_FILLED = "SHORT_FILLED"
    SHORT_FAILED = "SHORT_FAILED"
    FLATTENING = "FLATTENING"
    DONE = "DONE"
    ERROR = "ERROR"
```

Simple state tracker:

```python
state = SpreadExecutionState.INIT

print("Current state:", state)
```

In real bot, store state in database so recovery is possible if program crashes.

---

# 18. What About Atomic Execution?

With separate REST calls, you do **not** get true atomic execution.

Atomic means:

```text
Either all legs fill
or no legs fill
```

Standard REST single-order APIs usually cannot guarantee this.

You need:

- Broker basket order
- Exchange strategy order
- Multi-leg spread order
- Algo execution engine with leg management

If DhanHQ does not provide atomic basket execution, then you must accept legging risk and build protection logic.

---

# 19. Best Production Architecture

```text
┌────────────────────────────┐
│ Strategy Signal Engine     │
│ PCR, OI, VWAP, IV, Trend   │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Strategy Selector          │
│ Bull Put / Bear Call /     │
│ Iron Condor / Butterfly    │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Margin Engine              │
│ Dhan Margin Calculator     │
│ Available Funds Check      │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Leg Execution Engine       │
│ Buy hedge first            │
│ Then sell short leg        │
│ Timeout + cancel + flatten │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Order Monitor              │
│ Poll order status or WS    │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Position Reconciliation    │
│ Confirm both legs          │
│ Check quantity mismatch    │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Risk Manager               │
│ Stop-loss, trail, exit     │
│ Daily loss limit           │
└────────────────────────────┘
```

---

# 20. Practical Recommendation

If you are building a hedged option selling bot with DhanHQ REST:

---

## For Credit Spreads

Use:

```text
Buy long hedge first
Then sell short leg
```

Example:

```text
Bull Put Spread:
Buy lower PE
Sell higher PE

Bear Call Spread:
Buy higher CE
Sell lower CE
```

---

## For Iron Condor

Execute as two spreads:

```text
1. Put spread
   Buy lower PE
   Sell higher PE

2. Call spread
   Buy higher CE
   Sell lower CE
```

If one spread fails, decide whether to:

- Keep the completed spread
- Flatten everything
- Retry with adjusted prices

For beginners, flatten everything if the full iron condor is not completed.

---

## For Naked Short Strategies

Avoid unless:

- You have enough margin for naked short
- You have real-time monitoring
- You have automatic stop-loss
- You have emergency hedge logic

Better to convert:

```text
Short straddle → Iron butterfly
Short strangle → Iron condor
Naked short put → Bull put spread
Naked short call → Bear call spread
```

---

# 21. Final Answer

Yes, your understanding is mostly correct:

```text
Normal DhanHQ REST place_order = one order at a time.
```

But you can still do hedge selling by:

```text
1. Placing multiple leg orders from your code
2. Managing fills, failures, timeouts, and flattening
3. Using buy-first execution to avoid naked short risk
4. Checking margin using Dhan margin calculator
5. Using basket/strategy API if Dhan provides it
```

The safest practical logic is:

```text
For credit spread:
    Buy the hedge leg first
    Confirm fill
    Then sell the short leg
    Confirm fill
    If short leg fails, close the hedge leg
```

And the most important rule:

```text
Never allow a failed hedge leg to leave you with unintended naked short exposure.
```