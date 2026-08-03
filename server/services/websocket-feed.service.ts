import { WebSocketServer, WebSocket } from "ws";
import { MarketDataService } from "./market-data.service";
import { DhanAuthService } from "./dhan-auth.service";

interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

interface DepthBook {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

interface TickPayload {
  securityId: string;
  exchangeSegment: string;
  type?: string;
  ltp?: number;
  previousClose?: number;
  timestamp?: number;
}

export class WebSocketFeedService {
  private static wsReady: Promise<any> | null = null;
  private static depthBySymbol: Map<string, DepthBook> = new Map();

  /** Lazily connect the Dhan market feed once; wire tick + depth handlers. */
  private static async getWiredClient(): Promise<any> {
    if (!this.wsReady) {
      this.wsReady = (async () => {
        const client = await DhanAuthService.getDhanClient();
        const ws = client.ws;

        ws.market.on("tick", (tick: TickPayload) => {
          const config = MarketDataService.getSymbolConfigById(tick.securityId);
          if (!config) return;
          if (typeof tick.ltp === "number" && tick.ltp > 0) {
            config.basePrice = tick.ltp;
          }
          if (typeof tick.previousClose === "number" && tick.previousClose > 0) {
            config.prevClose = tick.previousClose;
          }
        });

        if (!ws.depth) {
          ws.enableDepth("twenty");
        }
        ws.depth.on("depth20", (event: any) => {
          if (!event || !Array.isArray(event.levels)) return;
          const key = String(event.securityId);
          const levels = event.levels.map((l: any) => ({
            price: Number(l.price),
            quantity: Number(l.qty ?? l.quantity ?? 0),
            orders: Number(l.orders ?? 1),
          }));
          const book = this.depthBySymbol.get(key) || { bids: [], asks: [] };
          if (event.type === "depth-20-bid") {
            book.bids = levels;
          } else if (event.type === "depth-20-ask") {
            book.asks = levels;
          }
          this.depthBySymbol.set(key, book);
        });

        await ws.connect();
        return client;
      })();
      this.wsReady.catch(() => {
        this.wsReady = null;
      });
    }
    return this.wsReady;
  }

  private static async subscribeInstrument(instrument: { securityId: string; exchangeSegment: string }): Promise<void> {
    try {
      const client = await this.getWiredClient();
      client.ws.market.subscribe([instrument]);
      if (client.ws.depth) {
        client.ws.depth.subscribe([instrument]);
      }
    } catch (e) {}
  }

  private static async unsubscribeInstrument(instrument: { securityId: string; exchangeSegment: string }): Promise<void> {
    try {
      const client = await this.getWiredClient();
      client.ws.market.unsubscribe([instrument]);
      if (client.ws.depth) {
        client.ws.depth.unsubscribe([instrument]);
      }
    } catch (e) {}
  }

  public static attach(wss: WebSocketServer): void {
    wss.on("connection", (ws: WebSocket) => {
      console.log("🔌 React UI WebSocket client connected");

      let activeConfig = MarketDataService.getSymbolConfig("nifty");
      let activeInstrument: { securityId: string; exchangeSegment: string } | null = null;
      let lastSentPrice: number | null = null;
      let lastDepthSentAt = 0;

      const sendTick = () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!activeConfig.basePrice) return;
        const currentPrice = activeConfig.basePrice;
        const prevClose = activeConfig.prevClose || currentPrice;
        const depth = this.depthBySymbol.get(activeConfig.id);
        const now = Date.now();

        // Only push a tick when the real price changed, or when the order book
        // refreshed (so the depth panel stays live without moving the price line).
        const priceChanged = currentPrice !== lastSentPrice;
        const depthRefreshed = depth !== undefined && now - lastDepthSentAt > 1000;
        if (!priceChanged && !depthRefreshed) return;

        lastSentPrice = currentPrice;
        lastDepthSentAt = now;

        ws.send(
          JSON.stringify({
            type: "tick",
            symbol: activeConfig.name,
            securityId: activeConfig.id,
            ltp: currentPrice,
            prevClose,
            change: Number((currentPrice - prevClose).toFixed(2)),
            pChange: Number(((currentPrice - prevClose) / prevClose) * 100),
            volume: activeConfig.dayVolume,
            bids: depth?.bids || [],
            asks: depth?.asks || [],
            timestamp: new Date().toISOString(),
          })
        );
      };

      const interval = setInterval(sendTick, 100);

      ws.on("message", (message: any) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === "subscribe" && parsed.symbol) {
            const symKey = String(parsed.symbol).toLowerCase();
            activeConfig = MarketDataService.getSymbolConfig(symKey);
            const nextInstrument = { securityId: activeConfig.id, exchangeSegment: activeConfig.segment };
            console.log(`📡 WebSocket client subscribed to symbol: ${activeConfig.name} (${activeConfig.id})`);
            if (activeInstrument) {
              this.unsubscribeInstrument(activeInstrument);
            }
            activeInstrument = nextInstrument;
            this.subscribeInstrument(nextInstrument);
          }
        } catch (e) {}
      });

      ws.on("close", () => {
        clearInterval(interval);
        if (activeInstrument) {
          this.unsubscribeInstrument(activeInstrument);
          activeInstrument = null;
        }
        console.log("🔌 React UI WebSocket client disconnected");
      });
    });
  }
}
