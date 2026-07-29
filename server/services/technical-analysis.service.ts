import { TechnicalAnalysis, analyzeMultiTimeframe } from "@shubhamtaywade82/dhanhq-ts";
import { DhanAuthService } from "./dhan-auth.service";
import { MarketDataService } from "./market-data.service";

export class TechnicalAnalysisService {
  public static async computeMultiTimeframeBias(symbolKey: string): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    const config = MarketDataService.getSymbolConfig(symbolKey);

    const ta = new TechnicalAnalysis(client.charts);
    const indicatorData = await ta.compute({
      securityId: config.id,
      exchangeSegment: config.segment,
      instrument: config.instrument,
      intervals: [5, 15, 60],
    });

    const bias = analyzeMultiTimeframe(indicatorData);
    return bias;
  }
}
