import { WebSocketServer, WebSocket } from "ws";
import { MarketDataService } from "./market-data.service";

export class WebSocketFeedService {
  public static attach(wss: WebSocketServer): void {
    wss.on("connection", (ws: WebSocket) => {
      console.log("🔌 React UI WebSocket client connected");

      let activeSymbol = "nifty";
      let activeConfig = MarketDataService.getSymbolConfig("nifty");

      ws.on("message", (message: any) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === "subscribe" && parsed.symbol) {
            const symKey = String(parsed.symbol).toLowerCase();
            activeSymbol = symKey;
            activeConfig = MarketDataService.getSymbolConfig(symKey);
          }
        } catch (e) {}
      });

      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const base = activeConfig.basePrice || 24250.70;
          const prevClose = activeConfig.prevClose || base * 0.994;

          const roundedLtp = Number(base.toFixed(2));
          const step = base * 0.0001;

          const dayChange = Number((roundedLtp - prevClose).toFixed(2));
          const dayPChange = Number(((dayChange / prevClose) * 100).toFixed(2));
          const dayVolume = activeConfig.dayVolume || 0;

          const bids = Array.from({ length: 10 }, (_, idx) => {
            const factor = (10 - idx) * 100;
            return {
              price: Number((roundedLtp - (idx + 1) * step).toFixed(2)),
              quantity: factor,
              orders: Math.max(1, Math.floor(factor / 50)),
            };
          });

          const asks = Array.from({ length: 10 }, (_, idx) => {
            const factor = (idx + 1) * 100;
            return {
              price: Number((roundedLtp + (idx + 1) * step).toFixed(2)),
              quantity: factor,
              orders: Math.max(1, Math.floor(factor / 50)),
            };
          });

          ws.send(
            JSON.stringify({
              type: "tick",
              symbol: activeConfig.name,
              securityId: activeConfig.id,
              ltp: roundedLtp,
              prevClose,
              change: dayChange,
              pChange: dayPChange,
              volume: dayVolume,
              bids,
              asks,
              timestamp: new Date().toISOString(),
            })
          );
        }
      }, 1000);

      ws.on("close", () => {
        clearInterval(interval);
        console.log("🔌 React UI WebSocket client disconnected");
      });
    });
  }
}
