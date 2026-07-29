# DhanHQ Trading Dashboard Example

This is a rich, visual dashboard built using React, TypeScript, and the `@dhanhq/client` SDK.

## Features
- **NIFTY & SENSEX Pages:** Separate views for major Indian indices.
- **SMC (Smart Money Concepts):** Highlights Swing Highs (SH) and Swing Lows (SL).
- **Price Action:** Built-in indicators for price action analysis.
- **Dark Mode Charting:** High-performance TradingView-style charts using `lightweight-charts`.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your environment:**
   Create a `.env` file in the root directory (or this directory) with:
   ```env
   DHAN_TOKEN=your_token
   DHAN_CLIENT_ID=your_client_id
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5173`
