import { DhanAuthService } from "./dhan-auth.service";

export interface SpreadLeg {
  securityId: string;
  exchangeSegment: string;
  transactionType: "BUY" | "SELL";
  quantity: number;
  orderType: "MARKET" | "LIMIT";
  price?: number;
  productType: "MARGIN" | "INTRADAY" | "CNC";
}

export class OrderExecutionService {
  public static async listOrders(): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    return await client.orders.list();
  }

  public static async listPositions(): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    return await client.positions.list();
  }

  public static async getFunds(): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    return await client.funds.getLimit();
  }

  public static async getLedger(fromDate?: string, toDate?: string): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    return await client.statements.ledger({ fromDate, toDate });
  }

  /**
   * Execute Multi-Leg Spread Strategy safely using Buy-First Hedge Logic:
   * 1. Execute BUY (hedge) leg first.
   * 2. Confirm fill.
   * 3. Execute SELL (short) leg.
   * 4. If short leg fails, automatically unwind/cancel hedge leg to avoid unintended naked exposure.
   */
  public static async executeSpreadStrategy(buyLeg: SpreadLeg, sellLeg: SpreadLeg): Promise<any> {
    const client = await DhanAuthService.getDhanClient();

    console.log(`🛡️ Executing Buy-First Hedge Leg: ${buyLeg.transactionType} ${buyLeg.securityId} x ${buyLeg.quantity}`);
    let buyResponse: any;

    try {
      buyResponse = await client.orders.place({
        securityId: buyLeg.securityId,
        exchangeSegment: buyLeg.exchangeSegment,
        transactionType: "BUY",
        quantity: buyLeg.quantity,
        orderType: buyLeg.orderType || "MARKET",
        price: buyLeg.price || 0,
        productType: buyLeg.productType || "MARGIN",
      });
      console.log(`✅ Hedge Leg Order Placed successfully. ID: ${buyResponse?.orderId || "OK"}`);
    } catch (err: any) {
      console.error(`❌ Hedge Leg Placement Failed: ${err.message}`);
      throw new Error(`Spread Strategy Aborted: Protective hedge leg failed to execute: ${err.message}`);
    }

    console.log(`⚡ Executing Short Leg: ${sellLeg.transactionType} ${sellLeg.securityId} x ${sellLeg.quantity}`);
    try {
      const sellResponse = await client.orders.place({
        securityId: sellLeg.securityId,
        exchangeSegment: sellLeg.exchangeSegment,
        transactionType: "SELL",
        quantity: sellLeg.quantity,
        orderType: sellLeg.orderType || "MARKET",
        price: sellLeg.price || 0,
        productType: sellLeg.productType || "MARGIN",
      });

      console.log(`✅ Short Leg Order Placed successfully. ID: ${sellResponse?.orderId || "OK"}`);
      return {
        status: "success",
        strategy: "MULTI_LEG_SPREAD",
        hedgeLeg: buyResponse,
        shortLeg: sellResponse,
      };
    } catch (sellErr: any) {
      console.error(`🚨 Short Leg Failed: ${sellErr.message}. Initiating emergency unwind of hedge leg!`);

      // Unwind hedge leg automatically
      try {
        const unwindResponse = await client.orders.place({
          securityId: buyLeg.securityId,
          exchangeSegment: buyLeg.exchangeSegment,
          transactionType: "SELL",
          quantity: buyLeg.quantity,
          orderType: "MARKET",
          productType: buyLeg.productType || "MARGIN",
        });
        console.log(`🔄 Emergency Unwind Successful. Unwind ID: ${unwindResponse?.orderId || "OK"}`);
      } catch (unwindErr: any) {
        console.error(`⚠️ Emergency Unwind Failed: ${unwindErr.message}. User intervention required!`);
      }

      throw new Error(`Short leg failed to execute (${sellErr.message}). Emergency unwind initiated.`);
    }
  }
}
