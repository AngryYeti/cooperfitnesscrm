import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, signPayload } from "@/lib/utils/ip-session";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get current IP address
  const xForwardedFor = request.headers.get("x-forwarded-for");
  const ip = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (request.headers.get("x-real-ip") || "127.0.0.1");

  // Check if custom IP session is valid
  const customCookie = request.cookies.get("cooper_fitness_session")?.value;
  let hasValidIpSession = false;

  if (customCookie) {
    const session = await verifyToken(customCookie);
    if (session && session.ip === ip && session.expiresAt > Date.now()) {
      hasValidIpSession = true;
    }
  }

  // If standard Supabase session is valid, ensure custom IP session is set/refreshed
  if (user && user.email) {
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
    const token = await signPayload({ email: user.email, ip, expiresAt });
    supabaseResponse.cookies.set("cooper_fitness_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60, // 4 hours in seconds
      path: "/",
    });
  }

  const publicServerRoutes = new Set([
    "/api/founding/inventory",
    "/api/founding/checkout-session",
    "/api/founding/email-outbox",
    "/api/webhooks/stripe/founding",
    // Existing webhook and scheduled routes remain public; each validates
    // its own provider signature or cron secret.
    "/api/webhooks/stripe",
    "/api/webhooks/docuseal",
    "/api/webhooks/new-lead",
    "/api/webhooks/zoho",
    "/api/send-reminders",
    "/api/daily-calendar",
  ]);
  const isPublicRoute = publicServerRoutes.has(request.nextUrl.pathname);

  const isAuthenticated = !!user || hasValidIpSession;

  if (!isAuthenticated && !request.nextUrl.pathname.startsWith("/login") && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
