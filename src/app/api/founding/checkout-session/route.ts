import { getFoundingConfig, FoundingConfigError } from "@/lib/founding/config";
import { expireUnattachedFoundingReservation, reserveFoundingCapacity, attachFoundingCheckout, releaseFoundingReservation } from "@/lib/founding/store";
import { createFoundingCheckoutSession, getFoundingStripe } from "@/lib/founding/stripe";
import { genericErrorResponse, hasValidBearer, parsePurchaser, splitName } from "@/lib/founding/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let config;
  try {
    config = getFoundingConfig();
  } catch (error) {
    if (!(error instanceof FoundingConfigError)) console.error("[founding-checkout] configuration unavailable");
    return genericErrorResponse();
  }
  if (!hasValidBearer(request, config.internalApiSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!config.campaignEnabled || !config.checkoutEnabled) return genericErrorResponse(404);

  let purchaser;
  try {
    purchaser = parsePurchaser(await request.json());
  } catch {
    return Response.json({ error: "Invalid purchaser" }, { status: 400 });
  }
  const { firstName, lastName } = splitName(purchaser.name);
  let reservation;
  try {
    reservation = await reserveFoundingCapacity({
      campaignKey: config.campaignKey,
      email: purchaser.email,
      firstName,
      lastName,
    });
  } catch {
    return genericErrorResponse(409);
  }

  let session;
  try {
    session = await createFoundingCheckoutSession({
      stripe: getFoundingStripe(),
      config,
      reservationId: reservation.reservation_id,
      email: purchaser.email,
    });
    if (!session.url || !session.id || !session.expires_at) throw new Error("Stripe did not return a hosted Checkout URL");
    const attached = await attachFoundingCheckout({
      reservationId: reservation.reservation_id,
      sessionId: session.id,
      customerId: typeof session.customer === "string" ? session.customer : null,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
    });
    return Response.json({
      checkout_url: session.url,
      reservation_expires_at: attached.hold_expires_at,
    });
  } catch {
    try {
      const released = session?.id
        ? await releaseFoundingReservation(reservation.reservation_id, session.id)
        : false;
      if (!released) await expireUnattachedFoundingReservation(reservation.reservation_id);
    } catch {
      console.error("[founding-checkout] reservation cleanup failed");
    }
    return genericErrorResponse();
  }
}
