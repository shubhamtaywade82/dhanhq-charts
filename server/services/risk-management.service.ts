import { DhanAuthService } from "./dhan-auth.service";

export class RiskManagementService {
  public static async getTraderControlsStatus(): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    const killSwitch = await client.traderControls.getKillSwitchStatus();
    const pnlExit = await client.traderControls.getPnlExit();
    return { killSwitch, pnlExit };
  }

  public static async setKillSwitchStatus(action: "ACTIVATE" | "DEACTIVATE"): Promise<any> {
    const client = await DhanAuthService.getDhanClient();
    return await client.traderControls.setKillSwitch(action);
  }
}
