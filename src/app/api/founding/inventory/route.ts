import { getFoundingConfig, FoundingConfigError } from "@/lib/founding/config";
import { getFoundingInventory } from "@/lib/founding/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getFoundingConfig();
    if (!config.campaignEnabled || !config.checkoutEnabled) {
      return Response.json({ state: "FULL", purchased_count: 0, pending_count: 0, capacity: config.capacity });
    }
    const inventory = await getFoundingInventory(config.campaignKey);
    return Response.json(inventory);
  } catch (error) {
    if (!(error instanceof FoundingConfigError)) console.error("[founding-inventory] unavailable");
    return Response.json({ state: "FULL", purchased_count: 0, pending_count: 0, capacity: 0 }, { status: 503 });
  }
}
