import { DhanClient } from "@shubhamtaywade82/dhanhq-ts";

export class DhanAuthService {
  private static client: any = null;
  private static clientInitPromise: Promise<any> | null = null;

  public static async getDhanClient(): Promise<any> {
    if (this.client) return this.client;
    if (this.clientInitPromise) return this.clientInitPromise;

    this.clientInitPromise = (async () => {
      try {
        const endpointBaseUrl = process.env.TOKEN_SERVICE_URL || process.env.DHAN_TOKEN_SERVICE_URL;
        const bearerToken = process.env.DHAN_TOKEN_ACCESS_TOKEN || process.env.BEARER_TOKEN;
        const staticToken = process.env.DHAN_TOKEN || process.env.VITE_DHAN_TOKEN;
        const staticClientId = process.env.DHAN_CLIENT_ID || process.env.VITE_DHAN_CLIENT_ID;

        if (endpointBaseUrl && bearerToken && endpointBaseUrl !== "DUMMY" && endpointBaseUrl !== "") {
          let cleanBaseUrl = endpointBaseUrl;
          if (cleanBaseUrl.endsWith("/auth/dhan/token")) {
            cleanBaseUrl = cleanBaseUrl.slice(0, -"/auth/dhan/token".length);
          } else if (cleanBaseUrl.endsWith("/auth/dhan/token/")) {
            cleanBaseUrl = cleanBaseUrl.slice(0, -"/auth/dhan/token/".length);
          }
          console.log(`🔑 Initializing DhanClient via Token Endpoint: ${cleanBaseUrl}`);
          this.client = await DhanClient.fromTokenEndpoint({
            endpointBaseUrl: cleanBaseUrl,
            bearerToken,
          });
        } else if (staticToken && staticClientId && staticToken !== "DUMMY" && staticToken !== "") {
          console.log("🔑 Initializing DhanClient via static ENV token");
          this.client = new DhanClient({
            token: staticToken,
            clientId: staticClientId,
          });
        } else {
          console.log("⚠️ No valid credentials found, initializing with DUMMY values");
          this.client = new DhanClient({
            token: "DUMMY",
            clientId: "DUMMY",
          });
        }
        console.log("✅ DhanClient successfully initialized!");
        return this.client;
      } catch (err: any) {
        console.error("⚠️ Failed to initialize DhanClient, falling back to static env credentials:", err.message);
        this.client = new DhanClient({
          token: process.env.DHAN_TOKEN || process.env.VITE_DHAN_TOKEN || "DUMMY",
          clientId: process.env.DHAN_CLIENT_ID || process.env.VITE_DHAN_CLIENT_ID || "DUMMY",
        });
        return this.client;
      }
    })();

    return this.clientInitPromise;
  }
}
