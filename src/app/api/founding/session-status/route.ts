import { getFoundingConfig, FoundingConfigError } from "@/lib/founding/config";
import { getFoundingSessionStatus } from "@/lib/founding/store";
import { hasValidBearer } from "@/lib/founding/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]+$/;

function noStoreJson(body: { state: "FULFILLED" | "PROCESSING" | "NOT_FOUND" }, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: Request) {
  let config;
  try {
    config = getFoundingConfig();
  } catch (error) {
    if (!(error instanceof FoundingConfigError)) console.error("[founding-session-status] configuration unavailable");
    return noStoreJson({ state: "NOT_FOUND" }, 503);
  }
  if (!hasValidBearer(request, config.internalApiSecret)) {
    return noStoreJson({ state: "NOT_FOUND" }, 401);
  }

  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() || "";
  if (sessionId.length > 200 || !SESSION_ID_PATTERN.test(sessionId)) return noStoreJson({ state: "NOT_FOUND" }, 400);

  try {
    const state = await getFoundingSessionStatus(config.campaignKey, sessionId);
    return noStoreJson({ state });
  } catch {
    console.error("[founding-session-status] lookup unavailable");
    return noStoreJson({ state: "NOT_FOUND" }, 503);
  }
}
