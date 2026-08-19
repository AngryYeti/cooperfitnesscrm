import { getFoundingConfig, FoundingConfigError } from "@/lib/founding/config";
import { getFoundingInventory } from "@/lib/founding/store";
import { hasValidBearer } from "@/lib/founding/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function GET(request: Request) {
  try {
    const config = getFoundingConfig();
    if (!hasValidBearer(request, config.internalApiSecret)) return noStore({ error: "Unauthorized" }, 401);
    if (!config.campaignEnabled || !config.checkoutEnabled) {
      return noStore({ state: "FULL", purchased_count: 0, pending_count: 0, capacity: config.capacity });
    }
    const inventory = await getFoundingInventory(config.campaignKey);
    return noStore(inventory);
  } catch (error) {
    if (!(error instanceof FoundingConfigError)) console.error("[founding-inventory] unavailable");
    return noStore({ state: "FULL", purchased_count: 0, pending_count: 0, capacity: 0 }, 503);
  }
}
